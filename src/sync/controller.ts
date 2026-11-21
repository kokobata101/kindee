import { ALL_TABLES, db } from '../db/db';
import { t } from '../i18n';
import { unpackText } from '../lib/share';
import { decideSync, downloadSnapshot, localSnapshot, SyncError, uploadSnapshot } from './engine';
import {
  EMPTY_SYNC_STATE,
  RevConflictError,
  SignInCancelled,
  type CloudBackend,
  type CloudUser,
  type ProviderId,
  type RemoteMeta,
  type SyncState,
} from './types';

export type SyncOutcome = 'noop' | 'uploaded' | 'downloaded' | 'pending' | 'locked' | 'error' | 'busy' | 'signedout';

export interface SyncSnapshot {
  /** โหลดผู้ให้บริการและตรวจสถานะล็อกอินเสร็จแล้ว */
  ready: boolean;
  user: CloudUser | null;
  state: SyncState;
  busy: 'sync' | 'signin' | null;
  error: string | null;
  /** เจอสถานการณ์ที่ต้องให้ผู้ใช้เลือก: conflict = สองฝั่งต่างเปลี่ยน, missing = คลาวด์ถูกลบ */
  pending: { kind: 'conflict' | 'missing'; remote: RemoteMeta | null } | null;
  remote: RemoteMeta | null;
  /** ต้องใส่รหัสผ่านเข้ารหัสก่อนจึงซิงก์ต่อได้ */
  locked: boolean;
  hasPassphrase: boolean;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** localStorage ที่ไม่พังเมื่อใช้ไม่ได้ (โหมดส่วนตัว ฯลฯ) ถอยไปเก็บในหน่วยความจำ */
export function safeStorage(): KV {
  const mem = new Map<string, string>();
  const ls = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  };
  return {
    getItem: (k) => {
      try {
        return ls()?.getItem(k) ?? mem.get(k) ?? null;
      } catch {
        return mem.get(k) ?? null;
      }
    },
    setItem: (k, v) => {
      try {
        ls()?.setItem(k, v);
      } catch {
        /* ใช้หน่วยความจำแทน */
      }
      mem.set(k, v);
    },
    removeItem: (k) => {
      try {
        ls()?.removeItem(k);
      } catch {
        /* เงียบไว้ */
      }
      mem.delete(k);
    },
  };
}

export const PASSPHRASE_MIN = 8;
const stateKey = (uid: string) => `kindee.sync.${uid}`;
const SIGNIN_FLAG = 'kindee.signin.pending';

export function getDeviceId(kv: KV): string {
  let id = kv.getItem('kindee.deviceId');
  if (!id) {
    id = crypto.randomUUID();
    kv.setItem('kindee.deviceId', id);
  }
  return id;
}

export function loadState(kv: KV, uid: string): SyncState {
  try {
    const raw = kv.getItem(stateKey(uid));
    if (raw) {
      const o = JSON.parse(raw) as Partial<SyncState>;
      return {
        lastRev: Number.isFinite(o.lastRev) ? (o.lastRev as number) : 0,
        lastHash: typeof o.lastHash === 'string' ? o.lastHash : '',
        lastSyncAt: Number.isFinite(o.lastSyncAt) ? (o.lastSyncAt as number) : 0,
        auto: o.auto !== false,
        encrypt: o.encrypt === true,
      };
    }
  } catch {
    /* ใช้ค่าเริ่มต้น */
  }
  return { ...EMPTY_SYNC_STATE };
}

const errMsg = (e: unknown): string => (e instanceof Error && e.message ? e.message : t('เกิดข้อผิดพลาดที่ไม่คาดคิด'));

/**
 * ตัวควบคุมการซิงก์ (ไม่ผูกกับ React): ล็อกอิน/ออก, ซิงก์, แก้ conflict, เข้ารหัส, ซิงก์อัตโนมัติ
 * หลักการ: ไม่ทับข้อมูลฝั่งใดเงียบๆ — ถ้าสองฝั่งต่างเปลี่ยนจะหยุดและให้ผู้ใช้เลือก
 */
export class SyncController {
  private snap: SyncSnapshot;
  private listeners = new Set<() => void>();
  private running = false;
  private pass = '';
  /** รหัสผ่านนี้ตรวจแล้วว่าถอดรหัสข้อมูลบนคลาวด์ได้ (กันอัปโหลดทับด้วยรหัสผ่านผิด) */
  private passOk = false;
  private offUser: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private dirtyTimer: ReturnType<typeof setTimeout> | null = null;
  private teardown: (() => void)[] = [];

  constructor(
    private backend: CloudBackend,
    private kv: KV = safeStorage(),
    private now: () => number = () => Date.now(),
    private dirtyDelayMs = 8000,
  ) {
    this.snap = {
      ready: false,
      user: null,
      state: { ...EMPTY_SYNC_STATE },
      busy: null,
      error: null,
      pending: null,
      remote: null,
      locked: false,
      hasPassphrase: false,
    };
  }

  // ── สถานะสำหรับ React (useSyncExternalStore) ──
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): SyncSnapshot => this.snap;
  private patch(p: Partial<SyncSnapshot>) {
    this.snap = { ...this.snap, ...p };
    this.listeners.forEach((l) => l());
  }
  private setState(s: SyncState) {
    const uid = this.snap.user?.uid;
    if (uid) this.kv.setItem(stateKey(uid), JSON.stringify(s));
    this.patch({ state: s });
  }

  get providers(): ProviderId[] {
    return this.backend.providers;
  }
  get deviceId(): string {
    return getDeviceId(this.kv);
  }

  // ── วงจรชีวิต ──
  start(): void {
    if (this.offUser) return;
    this.offUser = this.backend.onUser((u) => this.onUser(u));
    void this.backend.completeRedirect?.().catch((e) => {
      this.kv.removeItem(SIGNIN_FLAG);
      if (!(e instanceof SignInCancelled)) this.patch({ error: errMsg(e) });
    });
    this.watchLocal();
    this.interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.autoSync();
    }, 120_000);
    if (typeof window !== 'undefined') {
      const wake = () => {
        if (document.visibilityState === 'visible') void this.autoSync();
      };
      document.addEventListener('visibilitychange', wake);
      window.addEventListener('online', wake);
      this.teardown.push(() => {
        document.removeEventListener('visibilitychange', wake);
        window.removeEventListener('online', wake);
      });
    }
  }

  stop(): void {
    this.offUser?.();
    this.offUser = null;
    if (this.interval) clearInterval(this.interval);
    if (this.timer) clearTimeout(this.timer);
    if (this.dirtyTimer) clearTimeout(this.dirtyTimer);
    this.interval = this.timer = this.dirtyTimer = null;
    this.teardown.forEach((f) => f());
    this.teardown = [];
  }

  private onUser(u: CloudUser | null) {
    this.pass = '';
    this.passOk = false;
    if (!u) {
      this.patch({ ready: true, user: null, state: { ...EMPTY_SYNC_STATE }, pending: null, remote: null, locked: false, hasPassphrase: false, error: null });
      return;
    }
    const first = this.snap.user?.uid !== u.uid;
    this.patch({ ready: true, user: u, state: loadState(this.kv, u.uid), pending: null, locked: false, hasPassphrase: false, ...(first ? { remote: null } : {}) });
    if (!first) return;
    // ล็อกอินที่ผู้ใช้เพิ่งกดเอง (แม้จะกลับมาจากหน้า redirect) ดึงข้อมูลลงเครื่องเปล่าได้เลย
    // ส่วนเปิดแอปแล้วมีเซสชันเดิมค้างอยู่ ถือเป็นซิงก์อัตโนมัติ (ไม่ดึงทับเครื่องที่เพิ่งลบข้อมูล)
    const explicit = this.kv.getItem(SIGNIN_FLAG) === '1';
    this.kv.removeItem(SIGNIN_FLAG);
    void (explicit ? this.sync('signin') : this.autoSync());
  }

  /** เมื่อข้อมูลในเครื่องเปลี่ยน ให้รอสักครู่แล้วซิงก์ (รวมการแก้หลายครั้งติดกันเป็นรอบเดียว) */
  private watchLocal() {
    const onChange = () => {
      if (this.running || !this.snap.user || !this.snap.state.auto) return;
      if (this.dirtyTimer) clearTimeout(this.dirtyTimer);
      this.dirtyTimer = setTimeout(() => void this.autoSync(), this.dirtyDelayMs);
    };
    for (const name of ALL_TABLES) {
      const tbl = db[name] as unknown as { hook: (ev: string, fn?: (...a: unknown[]) => void) => { subscribe?: unknown; unsubscribe: (fn: unknown) => void } };
      for (const ev of ['creating', 'updating', 'deleting']) {
        tbl.hook(ev, onChange as never);
        this.teardown.push(() => tbl.hook(ev).unsubscribe(onChange));
      }
    }
  }

  private async autoSync() {
    const { user, state } = this.snap;
    if (!user || !state.auto || this.snap.pending || this.snap.locked) return;
    await this.sync('auto');
  }

  // ── ล็อกอิน/ออก ──
  async signIn(p: ProviderId): Promise<void> {
    if (this.snap.busy) return;
    this.patch({ busy: 'signin', error: null });
    this.kv.setItem(SIGNIN_FLAG, '1');
    try {
      await this.backend.signIn(p);
    } catch (e) {
      this.kv.removeItem(SIGNIN_FLAG);
      if (!(e instanceof SignInCancelled)) this.patch({ error: errMsg(e) });
    } finally {
      this.patch({ busy: null });
    }
  }

  async signOut(): Promise<void> {
    await this.backend.signOut();
  }

  // ── รหัสผ่านเข้ารหัส (เก็บในหน่วยความจำเท่านั้น ปิดแอปแล้วต้องใส่ใหม่) ──
  setPassphrase(p: string): void {
    this.pass = p;
    this.passOk = false;
    this.patch({ hasPassphrase: !!p, locked: false, error: null });
  }

  setAuto(auto: boolean): void {
    this.setState({ ...this.snap.state, auto });
  }

  /** เปิด/ปิดการเข้ารหัสข้อมูลบนคลาวด์ (เปิดต้องมีรหัสผ่านอย่างน้อย 8 ตัว) แล้วอัปโหลดใหม่ทันที */
  async setEncrypt(on: boolean, passphrase?: string): Promise<SyncOutcome> {
    if (on) {
      const pw = passphrase ?? this.pass;
      if (pw.length < PASSPHRASE_MIN) {
        this.patch({ error: t('รหัสผ่านต้องยาวอย่างน้อย {n} ตัวอักษร', { n: PASSPHRASE_MIN }) });
        return 'error';
      }
      this.setPassphrase(pw);
    }
    // ล้างแฮชที่จำไว้ เพื่อให้รอบถัดไปอัปโหลดใหม่ในรูปแบบที่เปลี่ยนไป
    this.setState({ ...this.snap.state, encrypt: on, lastHash: '' });
    return this.sync('manual');
  }

  // ── ซิงก์ ──
  async sync(reason: 'manual' | 'auto' | 'signin' = 'manual'): Promise<SyncOutcome> {
    if (!this.snap.user) return 'signedout';
    if (this.running) return 'busy';
    return this.guarded(() => this.syncOnce(reason, 0));
  }

  private async guarded(fn: () => Promise<SyncOutcome>): Promise<SyncOutcome> {
    this.running = true;
    this.patch({ busy: 'sync', error: null });
    try {
      return await fn();
    } catch (e) {
      this.patch({ error: errMsg(e) });
      return 'error';
    } finally {
      this.running = false;
      this.patch({ busy: null });
    }
  }

  private async fetchMeta(uid: string): Promise<RemoteMeta | null> {
    try {
      return await this.backend.store.getMeta(uid);
    } catch {
      throw new SyncError(t('เชื่อมต่อคลาวด์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'));
    }
  }

  private async syncOnce(reason: 'manual' | 'auto' | 'signin', attempt: number): Promise<SyncOutcome> {
    const user = this.snap.user!;
    const local = await localSnapshot();
    // ซิงก์อัตโนมัติไม่ดึงข้อมูลลงเครื่องที่ว่างเปล่า (เช่นเพิ่งกดลบข้อมูล) ต้องสั่งเองหรือเพิ่งล็อกอิน
    if (reason === 'auto' && local.empty) return 'noop';
    const remote = await this.fetchMeta(user.uid);
    let st = this.snap.state;
    if (remote && remote.rev !== st.lastRev && remote.encrypted !== st.encrypt) {
      // เครื่องใหม่ หรือเครื่องอื่นเปลี่ยนการเข้ารหัส: ทำตามที่คลาวด์เก็บอยู่ ไม่งั้นอัปโหลดครั้งหน้าจะถอดการเข้ารหัสเงียบๆ
      st = { ...st, encrypt: remote.encrypted };
      this.setState(st);
    }
    this.patch({ remote });

    const action = decideSync({ state: st, localHash: local.hash, localEmpty: local.empty, remote });
    switch (action) {
      case 'noop': {
        if (remote) this.setState({ ...st, lastRev: remote.rev, lastHash: local.hash, lastSyncAt: this.now() });
        if (st.encrypt && !this.pass) {
          // ข้อมูลเท่ากันแล้ว แต่ต้องใส่รหัสผ่านก่อนจึงจะอัปโหลดครั้งต่อไปได้
          this.patch({ pending: null, locked: true });
          return 'locked';
        }
        if (remote?.encrypted && !this.passOk) {
          // ตรวจว่ารหัสผ่านที่ใส่ถอดข้อมูลบนคลาวด์ได้จริง (ไม่งั้นรหัสผิดจะผ่านเงียบๆ แล้วไปพังตอนอัปโหลด)
          try {
            await unpackText(await this.backend.store.getPayload(user.uid, remote), this.pass);
          } catch {
            this.patch({ locked: true });
            throw new SyncError(t('รหัสผ่านไม่ตรงกับข้อมูลที่เข้ารหัสไว้บนคลาวด์'));
          }
          this.passOk = true;
        }
        this.patch({ pending: null, locked: false });
        return 'noop';
      }
      case 'conflict':
      case 'missing':
        this.patch({ pending: { kind: action, remote } });
        return 'pending';
      case 'upload':
        return this.doUpload(user, remote, attempt, reason);
      case 'download':
        return this.doDownload(user, remote!);
    }
  }

  private async doUpload(user: CloudUser, remote: RemoteMeta | null, attempt: number, reason: 'manual' | 'auto' | 'signin' | 'resolve' = 'manual'): Promise<SyncOutcome> {
    const st = this.snap.state;
    const pw = st.encrypt ? this.pass : '';
    if (st.encrypt && !pw) {
      this.patch({ locked: true });
      return 'locked';
    }
    if (pw && remote?.encrypted && !this.passOk) {
      // กันอัปโหลดทับด้วยรหัสผ่านที่ไม่ตรงกับของเดิมบนคลาวด์
      try {
        await unpackText(await this.backend.store.getPayload(user.uid, remote), pw);
      } catch {
        this.patch({ locked: true });
        throw new SyncError(t('รหัสผ่านไม่ตรงกับข้อมูลที่เข้ารหัสไว้บนคลาวด์'));
      }
      this.passOk = true;
    }
    try {
      const r = await uploadSnapshot({
        store: this.backend.store,
        uid: user.uid,
        state: st,
        deviceId: this.deviceId,
        expectedRev: remote?.rev ?? 0,
        password: pw || undefined,
        now: this.now(),
      });
      this.setState(r.state);
      if (pw) this.passOk = true;
      this.patch({ remote: r.meta, pending: null, locked: false });
      return 'uploaded';
    } catch (e) {
      if (e instanceof RevConflictError) {
        // มีเครื่องอื่นอัปโหลดแทรก: ตัดสินใจใหม่ด้วยข้อมูลล่าสุด (ครั้งเดียว กันวนไม่รู้จบ)
        if (attempt < 1 && reason !== 'resolve') return this.syncOnce(reason === 'auto' ? 'auto' : 'manual', attempt + 1);
        throw new SyncError(t('มีอีกเครื่องกำลังอัปโหลดอยู่ ลองซิงก์อีกครั้ง'));
      }
      throw e;
    }
  }

  private async doDownload(user: CloudUser, remote: RemoteMeta): Promise<SyncOutcome> {
    if (remote.encrypted && !this.pass) {
      this.patch({ locked: true });
      return 'locked';
    }
    try {
      const r = await downloadSnapshot({
        store: this.backend.store,
        uid: user.uid,
        meta: remote,
        state: this.snap.state,
        password: remote.encrypted ? this.pass : undefined,
        now: this.now(),
      });
      this.setState({ ...r.state, encrypt: remote.encrypted });
      if (remote.encrypted) this.passOk = true;
      this.patch({ pending: null, locked: false, remote });
      return 'downloaded';
    } catch (e) {
      if (remote.encrypted) this.patch({ locked: true });
      throw e;
    }
  }

  /** แก้ conflict/missing: 'cloud' = ใช้ข้อมูลบนคลาวด์แทนเครื่องนี้, 'local' = ใช้ข้อมูลเครื่องนี้ทับคลาวด์ */
  async resolve(choice: 'cloud' | 'local'): Promise<SyncOutcome> {
    const user = this.snap.user;
    if (!user) return 'signedout';
    if (this.running) return 'busy';
    return this.guarded(async () => {
      const remote = await this.fetchMeta(user.uid);
      this.patch({ remote });
      if (choice === 'cloud') {
        if (!remote) throw new SyncError(t('ไม่มีข้อมูลบนคลาวด์ให้ดึง'));
        return this.doDownload(user, remote);
      }
      // 'local': เครื่องนี้ชนะ — คำนวณ rev ใหม่จากสถานะปัจจุบันของคลาวด์
      return this.doUpload(user, remote, 1, 'resolve');
    });
  }

  /** ลบข้อมูลสำรองบนคลาวด์ (ข้อมูลในเครื่องไม่ถูกแตะ) แล้วปิดซิงก์อัตโนมัติ กันอัปโหลดกลับขึ้นไปเอง */
  async deleteCloudData(): Promise<boolean> {
    const user = this.snap.user;
    if (!user || this.running) return false;
    let ok = false;
    await this.guarded(async () => {
      try {
        await this.backend.store.remove(user.uid);
      } catch {
        throw new SyncError(t('ลบข้อมูลบนคลาวด์ไม่สำเร็จ ลองใหม่อีกครั้ง'));
      }
      this.setState({ ...EMPTY_SYNC_STATE, auto: false });
      this.patch({ remote: null, pending: null, locked: false });
      ok = true;
      return 'noop';
    });
    return ok;
  }

  /** ลบข้อมูลบนคลาวด์และบัญชีล็อกอิน (ข้อมูลในเครื่องยังอยู่) */
  async deleteAccount(): Promise<boolean> {
    const user = this.snap.user;
    if (!user || this.running) return false;
    let ok = false;
    await this.guarded(async () => {
      await this.backend.deleteAccount();
      this.kv.removeItem(stateKey(user.uid));
      ok = true;
      return 'noop';
    });
    return ok;
  }
}
