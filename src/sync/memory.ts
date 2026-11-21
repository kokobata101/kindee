import { splitChunks } from './engine';
import { RevConflictError, type RemoteMeta, type RemoteStore } from './types';

/** ที่เก็บในหน่วยความจำ: ใช้ในเทสต์ และเป็นต้นแบบพฤติกรรมเดียวกับ Firestore (แบ่งก้อน + ตรวจ rev ก่อนเขียน) */
export class MemoryStore implements RemoteStore {
  private metas = new Map<string, RemoteMeta>();
  private chunks = new Map<string, string[]>();
  /** ตั้งให้ล้มเหลวเพื่อทดสอบกรณีเครือข่ายขัดข้อง */
  failNext = false;
  chunkSize?: number;

  private check() {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('network');
    }
  }

  async getMeta(uid: string): Promise<RemoteMeta | null> {
    this.check();
    const m = this.metas.get(uid);
    return m ? { ...m } : null;
  }

  async getPayload(uid: string, meta: RemoteMeta): Promise<string> {
    this.check();
    const c = this.chunks.get(uid);
    const cur = this.metas.get(uid);
    if (!c || !cur || cur.rev !== meta.rev) throw new Error('stale');
    return c.join('');
  }

  async put(uid: string, a: { payload: string; encrypted: boolean; deviceId: string; hash: string; expectedRev: number }): Promise<RemoteMeta> {
    this.check();
    const cur = this.metas.get(uid)?.rev ?? 0;
    if (cur !== a.expectedRev) throw new RevConflictError(cur);
    const parts = splitChunks(a.payload, this.chunkSize);
    const meta: RemoteMeta = {
      rev: cur + 1,
      updatedAt: Date.now(),
      deviceId: a.deviceId,
      encrypted: a.encrypted,
      chunkCount: parts.length,
      hash: a.hash,
      size: a.payload.length,
    };
    this.chunks.set(uid, parts);
    this.metas.set(uid, meta);
    return { ...meta };
  }

  async remove(uid: string): Promise<void> {
    this.check();
    this.metas.delete(uid);
    this.chunks.delete(uid);
  }

  /** ตัวช่วยเทสต์: ดูข้อความที่เก็บจริงบนคลาวด์ */
  raw(uid: string): string | undefined {
    return this.chunks.get(uid)?.join('');
  }
}
