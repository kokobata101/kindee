import { exportBackup, importBackup, type ImportSummary } from '../db/backup';
import { packText, ShareError, unpackText, isEncrypted } from '../lib/share';
import { t } from '../i18n';
import { RevConflictError, type RemoteMeta, type RemoteStore, type SyncAction, type SyncState } from './types';

export class SyncError extends Error {}

/** ขนาดต่อก้อนบน Firestore (เอกสารละไม่เกิน 1 MiB) เผื่อส่วนหัวไว้ */
export const CHUNK_SIZE = 700_000;

export function splitChunks(payload: string, size = CHUNK_SIZE): string[] {
  const out: string[] = [];
  for (let i = 0; i < payload.length; i += size) out.push(payload.slice(i, i + size));
  return out.length ? out : [''];
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export interface LocalSnapshot {
  /** JSON ของข้อมูลทั้งหมด (ยังไม่บีบอัด/เข้ารหัส) */
  json: string;
  hash: string;
  /** ไม่มีโปรไฟล์ = เครื่องนี้ยังไม่เคยตั้งค่า */
  empty: boolean;
}

/** ถ่ายภาพข้อมูลในเครื่อง + แฮช (แฮชไม่รวมเวลา export จึงคงที่ถ้าข้อมูลไม่เปลี่ยน) */
export async function localSnapshot(): Promise<LocalSnapshot> {
  const b = await exportBackup(new Date(0));
  const json = JSON.stringify(b);
  const hash = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(b.data))));
  return { json, hash, empty: b.data.profile.length === 0 };
}

/**
 * ตัดสินว่าควรทำอะไร (ฟังก์ชันล้วน ทดสอบได้)
 * - noop: ตรงกันแล้ว
 * - upload: เครื่องนี้เปลี่ยนไปและคลาวด์ยังเป็นรุ่นที่เราเคยซิงก์ → อัปโหลดได้ปลอดภัย
 * - download: คลาวด์ใหม่กว่าและเครื่องนี้ไม่ได้แก้อะไร (หรือเป็นเครื่องเปล่า) → ดึงมาใช้
 * - conflict: ทั้งสองฝั่งเปลี่ยน ให้ผู้ใช้เลือกเอง (ห้ามทับเงียบๆ)
 * - missing: เคยซิงก์แล้วแต่คลาวด์ว่างเปล่า (ถูกลบ) ให้ผู้ใช้ตัดสินใจ ไม่อัปโหลดคืนเอง
 */
export function decideSync(args: { state: SyncState; localHash: string; localEmpty: boolean; remote: RemoteMeta | null }): SyncAction {
  const { state, localHash, localEmpty, remote } = args;
  const localChanged = localHash !== state.lastHash;
  if (!remote) {
    if (state.lastRev > 0) return 'missing';
    return localEmpty ? 'noop' : 'upload';
  }
  if (remote.rev === state.lastRev) return localEmpty ? 'download' : localChanged ? 'upload' : 'noop';
  // คลาวด์เปลี่ยนจากที่เคยซิงก์
  if (localEmpty) return 'download';
  if (remote.hash === localHash) return 'noop'; // สองฝั่งเหมือนกันอยู่แล้ว
  if (state.lastRev > 0 && !localChanged) return 'download';
  return 'conflict';
}

export async function uploadSnapshot(args: {
  store: RemoteStore;
  uid: string;
  state: SyncState;
  deviceId: string;
  /** rev ของคลาวด์ที่เราเห็นตอนตัดสินใจ (ไม่มีข้อมูลบนคลาวด์ = 0) */
  expectedRev: number;
  password?: string;
  now?: number;
}): Promise<{ meta: RemoteMeta; state: SyncState }> {
  const snap = await localSnapshot();
  if (snap.empty) throw new SyncError(t('ยังไม่มีข้อมูลในเครื่องนี้ให้สำรอง'));
  const payload = await packText(snap.json, args.password || undefined);
  let meta: RemoteMeta;
  try {
    meta = await args.store.put(args.uid, {
      payload,
      encrypted: !!args.password,
      deviceId: args.deviceId,
      hash: snap.hash,
      expectedRev: args.expectedRev,
    });
  } catch (e) {
    if (e instanceof RevConflictError) throw e;
    throw new SyncError(t('สำรองขึ้นคลาวด์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'));
  }
  return { meta, state: { ...args.state, lastRev: meta.rev, lastHash: snap.hash, lastSyncAt: args.now ?? Date.now() } };
}

export async function downloadSnapshot(args: {
  store: RemoteStore;
  uid: string;
  meta: RemoteMeta;
  state: SyncState;
  password?: string;
  now?: number;
}): Promise<{ summary: ImportSummary; state: SyncState }> {
  let payload: string;
  try {
    payload = await args.store.getPayload(args.uid, args.meta);
  } catch {
    throw new SyncError(t('ดึงข้อมูลจากคลาวด์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'));
  }
  if (isEncrypted(payload) && !args.password) throw new SyncError(t('ข้อมูลบนคลาวด์ถูกเข้ารหัส ใส่รหัสผ่านก่อน'));
  let text: string;
  try {
    text = await unpackText(payload, args.password || undefined);
  } catch (e) {
    if (e instanceof ShareError) throw new SyncError(t('ถอดรหัสไม่ได้ รหัสผ่านไม่ถูกต้องหรือข้อมูลเสียหาย'));
    throw e;
  }
  // importBackup ตรวจโครงสร้างและเขียนในทรานแซกชันเดียว ถ้าไฟล์เสียจะไม่แตะข้อมูลเดิม
  const summary = await importBackup(text);
  const snap = await localSnapshot();
  return { summary, state: { ...args.state, lastRev: args.meta.rev, lastHash: snap.hash, lastSyncAt: args.now ?? Date.now() } };
}

