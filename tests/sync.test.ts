// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import * as repo from '../src/db/repo';
import { exportBackup, importBackup } from '../src/db/backup';
import { CHUNK_SIZE, SyncError, decideSync, downloadSnapshot, localSnapshot, splitChunks, uploadSnapshot } from '../src/sync/engine';
import { MemoryStore } from '../src/sync/memory';
import { SyncController, type KV } from '../src/sync/controller';
import {
  EMPTY_SYNC_STATE,
  RevConflictError,
  SignInCancelled,
  type CloudBackend,
  type CloudUser,
  type ProviderId,
  type RemoteMeta,
  type SyncState,
} from '../src/sync/types';
import type { Profile } from '../src/db/types';

const profile: Omit<Profile, 'id' | 'createdAt'> = {
  name: 'มะนาว', sex: 'male', birthYear: 1998, heightCm: 172, startWeightKg: 76.8, targetWeightKg: 70, goal: 'lose', pace: 0.5,
  activity: 'light', presetKey: 'balanced', split: { protein: 30, carb: 40, fat: 30 }, kcalGoal: 1760, kcalManual: false,
  waterGoalMl: 2600, waterManual: false, autoAdjust: true, theme: 'system',
};

const meta = (o: Partial<RemoteMeta> = {}): RemoteMeta => ({ rev: 3, updatedAt: 1, deviceId: 'other', encrypted: false, chunkCount: 1, hash: 'R', size: 10, ...o });
const st = (o: Partial<SyncState> = {}): SyncState => ({ ...EMPTY_SYNC_STATE, ...o });

beforeEach(async () => {
  await repo.resetAll();
});

describe('decideSync (ตารางตัดสินใจ)', () => {
  const d = (state: SyncState, localHash: string, localEmpty: boolean, remote: RemoteMeta | null) => decideSync({ state, localHash, localEmpty, remote });

  it('คลาวด์ว่าง: เครื่องมีข้อมูล → อัปโหลด, เครื่องเปล่า → ไม่ทำอะไร', () => {
    expect(d(st(), 'A', false, null)).toBe('upload');
    expect(d(st(), '', true, null)).toBe('noop');
  });
  it('เคยซิงก์แล้วแต่คลาวด์ว่าง (ถูกลบ) → ถามผู้ใช้ ไม่อัปโหลดคืนเอง', () => {
    expect(d(st({ lastRev: 2, lastHash: 'A' }), 'A', false, null)).toBe('missing');
  });
  it('รุ่นตรงกัน: เครื่องแก้ → อัปโหลด, ไม่แก้ → ไม่ทำอะไร', () => {
    expect(d(st({ lastRev: 3, lastHash: 'A' }), 'B', false, meta())).toBe('upload');
    expect(d(st({ lastRev: 3, lastHash: 'A' }), 'A', false, meta())).toBe('noop');
  });
  it('คลาวด์ใหม่กว่า: เครื่องไม่ได้แก้ → ดึงลงมา', () => {
    expect(d(st({ lastRev: 2, lastHash: 'A' }), 'A', false, meta())).toBe('download');
  });
  it('คลาวด์ใหม่กว่าและเครื่องก็แก้ → ขัดแย้ง (ห้ามทับเงียบๆ)', () => {
    expect(d(st({ lastRev: 2, lastHash: 'A' }), 'B', false, meta())).toBe('conflict');
  });
  it('เครื่องใหม่ที่มีข้อมูลอยู่แล้ว + คลาวด์มีข้อมูล → ขัดแย้ง', () => {
    expect(d(st(), 'B', false, meta())).toBe('conflict');
  });
  it('เครื่องเปล่า + คลาวด์มีข้อมูล → ดึงลงมา (กู้คืน)', () => {
    expect(d(st(), '', true, meta())).toBe('download');
    expect(d(st({ lastRev: 3, lastHash: 'A' }), '', true, meta())).toBe('download');
  });
  it('สองฝั่งมีเนื้อหาเหมือนกันอยู่แล้ว (แฮชตรงกัน) → ไม่ทำอะไร แม้รุ่นต่างกัน', () => {
    expect(d(st(), 'R', false, meta({ hash: 'R' }))).toBe('noop');
  });
});

describe('แบ่งก้อนข้อมูล', () => {
  it('ต่อกลับได้เท่าเดิม และไม่เกินขนาดก้อน', () => {
    const s = 'x'.repeat(CHUNK_SIZE * 2 + 17);
    const parts = splitChunks(s);
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.length <= CHUNK_SIZE)).toBe(true);
    expect(parts.join('')).toBe(s);
    expect(splitChunks('')).toEqual(['']);
  });
});

describe('MemoryStore (ตรวจรุ่นก่อนเขียน)', () => {
  it('เขียนครั้งแรกต้องคาดว่ารุ่น 0, รุ่นผิด = RevConflictError และไม่เขียนทับ', async () => {
    const s = new MemoryStore();
    const a = { payload: 'AAA', encrypted: false, deviceId: 'd1', hash: 'h1' };
    const m1 = await s.put('u', { ...a, expectedRev: 0 });
    expect(m1.rev).toBe(1);
    await expect(s.put('u', { ...a, payload: 'BBB', expectedRev: 0 })).rejects.toBeInstanceOf(RevConflictError);
    expect(s.raw('u')).toBe('AAA');
    const m2 = await s.put('u', { ...a, payload: 'CCC', expectedRev: 1 });
    expect(m2.rev).toBe(2);
    expect(await s.getPayload('u', m2)).toBe('CCC');
  });
  it('ข้อมูลของผู้ใช้แต่ละคนแยกกัน', async () => {
    const s = new MemoryStore();
    await s.put('u1', { payload: 'A', encrypted: false, deviceId: 'd', hash: 'h', expectedRev: 0 });
    expect(await s.getMeta('u2')).toBeNull();
  });
});

describe('อัปโหลด/ดาวน์โหลดสแนปช็อต', () => {
  async function seed() {
    await repo.createProfile(profile, '2026-10-01');
    await repo.addWater(500, '2026-10-01', '08:00');
  }

  it('ไม่มีข้อมูลในเครื่อง = ไม่อัปโหลด (กันเอาของว่างไปทับของจริง)', async () => {
    const store = new MemoryStore();
    await expect(uploadSnapshot({ store, uid: 'u', state: st(), deviceId: 'd', expectedRev: 0 })).rejects.toBeInstanceOf(SyncError);
    expect(await store.getMeta('u')).toBeNull();
  });

  it('อัปโหลดแล้วดาวน์โหลดลงเครื่องเปล่า ได้ข้อมูลครบ และแฮชตรงกัน', async () => {
    await seed();
    const store = new MemoryStore();
    const before = await localSnapshot();
    const up = await uploadSnapshot({ store, uid: 'u', state: st(), deviceId: 'd1', expectedRev: 0 });
    expect(up.meta.rev).toBe(1);
    expect(up.meta.hash).toBe(before.hash);
    expect(up.state.lastRev).toBe(1);
    await repo.resetAll();
    const down = await downloadSnapshot({ store, uid: 'u', meta: up.meta, state: st() });
    expect(down.summary.weights).toBe(1);
    expect(down.summary.water).toBe(1);
    expect((await repo.getProfile())?.name).toBe('มะนาว');
    expect((await localSnapshot()).hash).toBe(before.hash);
  });

  it('เข้ารหัส: ข้อมูลบนคลาวด์อ่านไม่ออก, รหัสถูกกู้คืนได้, รหัสผิดแล้วข้อมูลในเครื่องไม่เปลี่ยน', async () => {
    await seed();
    const store = new MemoryStore();
    const up = await uploadSnapshot({ store, uid: 'u', state: st(), deviceId: 'd1', expectedRev: 0, password: 'รหัส-ลับ-1234' });
    expect(up.meta.encrypted).toBe(true);
    const raw = store.raw('u')!;
    expect(raw).not.toContain('มะนาว');
    expect(atob(raw.slice(0, 4).replace(/-/g, '+').replace(/_/g, '/'))).toBeTruthy();

    await repo.resetAll();
    await repo.createProfile({ ...profile, name: 'เครื่องนี้' }, '2026-10-02');
    await expect(downloadSnapshot({ store, uid: 'u', meta: up.meta, state: st() })).rejects.toThrow(/เข้ารหัส/);
    await expect(downloadSnapshot({ store, uid: 'u', meta: up.meta, state: st(), password: 'ผิด' })).rejects.toBeInstanceOf(SyncError);
    expect((await repo.getProfile())?.name).toBe('เครื่องนี้');

    await downloadSnapshot({ store, uid: 'u', meta: up.meta, state: st(), password: 'รหัส-ลับ-1234' });
    expect((await repo.getProfile())?.name).toBe('มะนาว');
  });

  it('เครือข่ายล้มเหลว = โยน SyncError และไม่แตะข้อมูลในเครื่อง', async () => {
    await seed();
    const store = new MemoryStore();
    const up = await uploadSnapshot({ store, uid: 'u', state: st(), deviceId: 'd', expectedRev: 0 });
    store.failNext = true;
    await expect(downloadSnapshot({ store, uid: 'u', meta: up.meta, state: st() })).rejects.toBeInstanceOf(SyncError);
    store.failNext = true;
    await expect(uploadSnapshot({ store, uid: 'u', state: st(), deviceId: 'd', expectedRev: 1 })).rejects.toBeInstanceOf(SyncError);
    expect((await repo.getProfile())?.name).toBe('มะนาว');
  });

  it('ข้อมูลใหญ่กว่าหนึ่งก้อนก็ส่งไปกลับครบ', async () => {
    await seed();
    const store = new MemoryStore();
    store.chunkSize = 100;
    const before = await localSnapshot();
    const up = await uploadSnapshot({ store, uid: 'u', state: st(), deviceId: 'd', expectedRev: 0 });
    expect(up.meta.chunkCount).toBeGreaterThan(3);
    await repo.resetAll();
    await downloadSnapshot({ store, uid: 'u', meta: up.meta, state: st() });
    expect((await localSnapshot()).hash).toBe(before.hash);
  });
});

// ───────── ตัวควบคุม: จำลอง "สองเครื่อง" โดยสลับเนื้อหา IndexedDB ไปมา ─────────
class FakeBackend implements CloudBackend {
  providers: ProviderId[] = ['google', 'facebook', 'apple', 'line'];
  private cbs = new Set<(u: CloudUser | null) => void>();
  user: CloudUser | null = null;
  deleted = false;
  cancelNext = false;
  constructor(public store: MemoryStore) {}
  onUser(cb: (u: CloudUser | null) => void) {
    this.cbs.add(cb);
    cb(this.user);
    return () => this.cbs.delete(cb);
  }
  async signIn(p: ProviderId) {
    if (this.cancelNext) {
      this.cancelNext = false;
      throw new SignInCancelled();
    }
    this.user = { uid: 'uid-1', name: 'ทดสอบ', email: `${p}@x.test`, photoURL: null, provider: p };
    this.cbs.forEach((c) => c(this.user));
  }
  async signOut() {
    this.user = null;
    this.cbs.forEach((c) => c(null));
  }
  async deleteAccount() {
    await this.store.remove('uid-1');
    this.deleted = true;
    await this.signOut();
  }
}

function memKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

/** อุปกรณ์จำลอง: มีฐานข้อมูลของตัวเอง (เก็บเป็นไฟล์สำรอง) และตัวควบคุมของตัวเอง */
class Device {
  data: string | null = null;
  kv = memKV();
  ctl: SyncController;
  backend: FakeBackend;
  constructor(store: MemoryStore, dirtyDelayMs = 600_000) {
    this.backend = new FakeBackend(store);
    // ทุกเครื่องในเทสต์ใช้ฐานข้อมูลก้อนเดียวกัน ถ้าให้ซิงก์อัตโนมัติทำงานเร็วจะแย่งกันเอง จึงตั้งดีเลย์ยาวไว้ก่อน
    this.ctl = new SyncController(this.backend, this.kv, () => Date.now(), dirtyDelayMs);
  }
}

const settle = () => new Promise((r) => setTimeout(r, 10));
let current: Device | null = null;
async function use(dev: Device) {
  if (current === dev) return;
  if (current) current.data = JSON.stringify(await exportBackup());
  await repo.resetAll();
  if (dev.data) await importBackup(dev.data);
  current = dev;
}

describe('SyncController (สองเครื่อง)', () => {
  let store: MemoryStore;
  let A: Device;
  let B: Device;
  beforeEach(() => {
    store = new MemoryStore();
    A = new Device(store);
    B = new Device(store);
    current = null;
  });
  afterEach(() => {
    A.ctl.stop();
    B.ctl.stop();
  });

  /** ล็อกอินแบบที่ผู้ใช้กดเอง แล้วรอให้ซิงก์รอบแรกจบ */
  async function login(d: Device) {
    await use(d);
    d.ctl.start();
    await d.ctl.signIn('google');
    await settle();
    while (d.ctl.getSnapshot().busy) await settle();
  }
  const sync = async (d: Device) => {
    await use(d);
    return d.ctl.sync('manual');
  };

  it('ล็อกอินครั้งแรกบนเครื่องที่มีข้อมูล → อัปโหลดเป็นข้อมูลสำรองรุ่นที่ 1', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    const s = A.ctl.getSnapshot();
    expect(s.user?.uid).toBe('uid-1');
    expect(s.state.lastRev).toBe(1);
    expect(s.error).toBeNull();
    expect((await store.getMeta('uid-1'))?.rev).toBe(1);
  });

  it('เครื่องใหม่ล็อกอินแล้วได้ข้อมูลลงมาเอง และรอบถัดไปไม่มีอะไรต้องทำ', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await repo.addWater(750, '2026-10-01', '09:00');
    await login(A);
    await login(B); // เครื่อง B ว่างเปล่า
    expect((await repo.getProfile())?.name).toBe('มะนาว');
    expect((await db.water.toArray()).map((w) => w.ml)).toEqual([750]);
    expect(await sync(B)).toBe('noop');
  });

  it('แก้ที่เครื่อง A → ซิงก์ → เครื่อง B ดึงไปได้ (ไม่มี conflict)', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await login(B);
    await use(A);
    await repo.addWater(300, '2026-10-02', '10:00');
    expect(await sync(A)).toBe('uploaded');
    expect(await sync(B)).toBe('downloaded');
    expect((await db.water.toArray()).map((w) => w.ml)).toEqual([300]);
    expect(B.ctl.getSnapshot().state.lastRev).toBe(2);
  });

  it('สองเครื่องแก้พร้อมกัน → หยุดรอผู้ใช้เลือก ไม่ทับข้อมูลใครเงียบๆ', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await login(B);
    await use(A);
    await repo.addWater(100, '2026-10-02', '10:00');
    await sync(A);
    await use(B);
    await repo.addWater(999, '2026-10-02', '11:00');
    expect(await sync(B)).toBe('pending');
    expect(B.ctl.getSnapshot().pending?.kind).toBe('conflict');
    // เครื่อง B ยังมีของตัวเอง และคลาวด์ยังเป็นของ A
    expect((await db.water.toArray()).map((w) => w.ml)).toEqual([999]);
    expect((await store.getMeta('uid-1'))?.deviceId).toBe(A.ctl.deviceId);
    // ซิงก์อัตโนมัติต้องไม่ฝ่าฝืนระหว่างรอเลือก
    expect((await B.ctl.sync('auto')).valueOf()).toBeTruthy();
    expect((await db.water.toArray()).map((w) => w.ml)).toEqual([999]);
  });

  it('แก้ conflict: เลือกใช้คลาวด์ → เครื่องนี้ถูกแทนที่', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await login(B);
    await use(A);
    await repo.addWater(100, '2026-10-02', '10:00');
    await sync(A);
    await use(B);
    await repo.addWater(999, '2026-10-02', '11:00');
    await sync(B);
    expect(await B.ctl.resolve('cloud')).toBe('downloaded');
    expect((await db.water.toArray()).map((w) => w.ml)).toEqual([100]);
    expect(B.ctl.getSnapshot().pending).toBeNull();
    expect(await sync(B)).toBe('noop');
  });

  it('แก้ conflict: เลือกใช้เครื่องนี้ → คลาวด์ถูกแทนที่ และเครื่องอีกฝั่งดึงไปได้', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await login(B);
    await use(A);
    await repo.addWater(100, '2026-10-02', '10:00');
    await sync(A);
    await use(B);
    await repo.addWater(999, '2026-10-02', '11:00');
    await sync(B);
    expect(await B.ctl.resolve('local')).toBe('uploaded');
    expect(await sync(A)).toBe('downloaded');
    expect((await db.water.toArray()).map((w) => w.ml)).toEqual([999]);
  });

  it('เครื่องที่มีข้อมูลอยู่แล้วเพิ่งล็อกอินเข้าบัญชีที่มีข้อมูล → conflict (ไม่ทับ)', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await use(B);
    await repo.createProfile({ ...profile, name: 'คนละชุด' }, '2026-10-05');
    await login(B);
    expect(B.ctl.getSnapshot().pending?.kind).toBe('conflict');
    expect((await repo.getProfile())?.name).toBe('คนละชุด');
  });

  it('ข้อมูลบนคลาวด์ถูกลบจากอีกเครื่อง → missing ไม่อัปโหลดคืนเอง', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await login(B);
    await use(A);
    expect(await A.ctl.deleteCloudData()).toBe(true);
    expect(A.ctl.getSnapshot().state.auto).toBe(false);
    expect(await store.getMeta('uid-1')).toBeNull();
    expect(await sync(B)).toBe('pending');
    expect(B.ctl.getSnapshot().pending?.kind).toBe('missing');
    expect(await store.getMeta('uid-1')).toBeNull();
    expect(await B.ctl.resolve('local')).toBe('uploaded');
    expect((await store.getMeta('uid-1'))?.rev).toBe(1);
  });

  it('เข้ารหัส: เครื่องใหม่ต้องใส่รหัสผ่านจึงเปิดได้, รหัสผิดไม่ทำให้ข้อมูลเปลี่ยน', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    expect(await A.ctl.setEncrypt(true, 'correct-horse-battery')).toBe('uploaded');
    expect((await store.getMeta('uid-1'))?.encrypted).toBe(true);
    expect(store.raw('uid-1')).not.toContain('มะนาว');

    await login(B);
    expect(B.ctl.getSnapshot().locked).toBe(true);
    expect(await repo.getProfile()).toBeUndefined();
    B.ctl.setPassphrase('wrong-passphrase');
    expect(await sync(B)).toBe('error');
    expect(await repo.getProfile()).toBeUndefined();
    B.ctl.setPassphrase('correct-horse-battery');
    expect(await sync(B)).toBe('downloaded');
    expect((await repo.getProfile())?.name).toBe('มะนาว');
    expect(B.ctl.getSnapshot().state.encrypt).toBe(true);
  });

  it('เข้ารหัส: รหัสสั้นเกินไปถูกปฏิเสธ และถ้าไม่ได้ใส่รหัสจะไม่อัปโหลดแบบไม่เข้ารหัสเงียบๆ', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    expect(await A.ctl.setEncrypt(true, 'short')).toBe('error');
    expect(A.ctl.getSnapshot().state.encrypt).toBe(false);
    await A.ctl.setEncrypt(true, 'long-enough-pass');
    // จำลองเปิดแอปใหม่: ตัวควบคุมใหม่ ไม่มีรหัสในหน่วยความจำ
    const A2 = new SyncController(A.backend, A.kv);
    A2.start();
    await settle();
    await repo.addWater(1, '2026-10-02', '10:00');
    expect(await A2.sync('manual')).toBe('locked');
    expect((await store.getMeta('uid-1'))?.rev).toBe(2);
    A2.stop();
  });

  it('เข้ารหัส: รหัสไม่ตรงกับของเดิมบนคลาวด์ → ไม่อัปโหลดทับ', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await A.ctl.setEncrypt(true, 'long-enough-pass');
    const before = store.raw('uid-1');
    await repo.addWater(1, '2026-10-02', '10:00');
    const A2 = new SyncController(A.backend, A.kv);
    A2.start();
    await settle();
    A2.setPassphrase('another-pass-123');
    expect(await A2.sync('manual')).toBe('error');
    expect(A2.getSnapshot().error).toMatch(/รหัสผ่าน/);
    expect(store.raw('uid-1')).toBe(before);
    A2.stop();
  });

  it('ซิงก์อัตโนมัติไม่ดึงข้อมูลลงเครื่องที่ถูกลบจนว่าง แต่กดซิงก์เองกู้คืนได้', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await repo.resetAll();
    expect(await A.ctl.sync('auto')).toBe('noop');
    expect(await repo.getProfile()).toBeUndefined();
    expect(await A.ctl.sync('manual')).toBe('downloaded');
    expect((await repo.getProfile())?.name).toBe('มะนาว');
  });

  it('ล้มเหลวด้านเครือข่าย: แจ้งข้อผิดพลาด ไม่เปลี่ยนข้อมูล และลองใหม่ได้', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await repo.addWater(5, '2026-10-02', '10:00');
    store.failNext = true;
    expect(await A.ctl.sync('manual')).toBe('error');
    expect(A.ctl.getSnapshot().error).toMatch(/คลาวด์/);
    expect(await A.ctl.sync('manual')).toBe('uploaded');
    expect(A.ctl.getSnapshot().error).toBeNull();
  });

  it('ยกเลิกหน้าต่างล็อกอินเอง = ไม่ใช่ข้อผิดพลาด', async () => {
    A.ctl.start();
    A.backend.cancelNext = true;
    await A.ctl.signIn('facebook');
    expect(A.ctl.getSnapshot().error).toBeNull();
    expect(A.ctl.getSnapshot().user).toBeNull();
  });

  it('ออกจากระบบ: ข้อมูลในเครื่องอยู่ครบ และล็อกอินกลับมาไม่ต้องอัปโหลดซ้ำ', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await A.ctl.signOut();
    expect(A.ctl.getSnapshot().user).toBeNull();
    expect(await sync(A)).toBe('signedout');
    expect((await repo.getProfile())?.name).toBe('มะนาว');
    await A.ctl.signIn('google');
    await settle();
    expect(A.ctl.getSnapshot().state.lastRev).toBe(1);
    expect((await store.getMeta('uid-1'))?.rev).toBe(1);
  });

  it('ลบบัญชี: ข้อมูลบนคลาวด์หาย แต่ข้อมูลในเครื่องยังอยู่', async () => {
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    expect(await A.ctl.deleteAccount()).toBe(true);
    expect(A.backend.deleted).toBe(true);
    expect(await store.getMeta('uid-1')).toBeNull();
    expect((await repo.getProfile())?.name).toBe('มะนาว');
  });

  it('แก้ข้อมูลในเครื่อง → ซิงก์อัตโนมัติอัปโหลดเองภายในไม่กี่วินาที', async () => {
    A = new Device(store, 40);
    await use(A);
    await repo.createProfile(profile, '2026-10-01');
    await login(A);
    await repo.addWater(250, '2026-10-02', '10:00');
    await new Promise((r) => setTimeout(r, 150)); // รอให้ดีเลย์รวมการแก้ไข (40 มิลลิวินาทีในเทสต์) หมดแล้วซิงก์ทำงาน
    await settle();
    while (A.ctl.getSnapshot().busy) await settle();
    expect((await store.getMeta('uid-1'))?.rev).toBe(2);
  });
});
