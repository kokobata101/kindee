// ระบบล็อกอิน + สำรอง/ซิงก์ข้ามเครื่อง (ไม่บังคับ: ไม่ล็อกอินแอปก็ใช้ได้ครบเหมือนเดิม)
// ส่วนนี้แยกเป็นอินเทอร์เฟซ เพื่อให้เปลี่ยนผู้ให้บริการหลังบ้านได้ (ตอนนี้มี Firebase และตัวจำลองสำหรับเทสต์)

export type ProviderId = 'google' | 'facebook' | 'apple' | 'line';
export const ALL_PROVIDERS: ProviderId[] = ['google', 'facebook', 'apple', 'line'];

export interface CloudUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  provider: string;
}

/** ข้อมูลกำกับสแนปช็อตบนคลาวด์ */
export interface RemoteMeta {
  /** เลขรุ่น เพิ่มทีละ 1 ทุกครั้งที่อัปโหลด ใช้ตรวจว่ามีเครื่องอื่นอัปโหลดแทรกหรือไม่ */
  rev: number;
  updatedAt: number;
  deviceId: string;
  encrypted: boolean;
  chunkCount: number;
  /** แฮชของข้อมูลในเครื่องตอนอัปโหลด (ไม่ใช่ข้อมูลจริง) */
  hash: string;
  size: number;
}

export class RevConflictError extends Error {
  constructor(public remoteRev: number) {
    super('remote revision changed');
  }
}

export interface RemoteStore {
  getMeta(uid: string): Promise<RemoteMeta | null>;
  getPayload(uid: string, meta: RemoteMeta): Promise<string>;
  /** อัปโหลดสแนปช็อตใหม่ ถ้า rev บนคลาวด์ไม่ตรงกับ expectedRev ต้องโยน RevConflictError (ห้ามเขียนทับ) */
  put(uid: string, args: { payload: string; encrypted: boolean; deviceId: string; hash: string; expectedRev: number }): Promise<RemoteMeta>;
  remove(uid: string): Promise<void>;
}

export interface CloudBackend {
  providers: ProviderId[];
  store: RemoteStore;
  /** แจ้งผู้ใช้ปัจจุบัน (null = ยังไม่ล็อกอิน) คืนฟังก์ชันยกเลิกการติดตาม */
  onUser(cb: (u: CloudUser | null) => void): () => void;
  signIn(p: ProviderId): Promise<void>;
  signOut(): Promise<void>;
  /** ลบบัญชีล็อกอินของผู้ใช้ (ไม่ลบข้อมูลในเครื่อง) */
  deleteAccount(): Promise<void>;
  /** เรียกครั้งเดียวตอนเริ่ม: ถ้ากลับมาจากหน้าล็อกอินแบบ redirect แล้วมีข้อผิดพลาด ให้โยนออกมา */
  completeRedirect?(): Promise<void>;
}

/** ผู้ใช้ปิดหน้าต่างล็อกอินเอง (ไม่ใช่ข้อผิดพลาด ไม่ต้องแสดงอะไร) */
export class SignInCancelled extends Error {}

/** สถานะซิงก์ต่อเครื่อง เก็บใน localStorage (ไม่ใส่ในฐานข้อมูล เพราะจะถูกสำรอง/กู้คืนข้ามเครื่องไปด้วย) */
export interface SyncState {
  lastRev: number;
  lastHash: string;
  lastSyncAt: number;
  auto: boolean;
  encrypt: boolean;
}
export const EMPTY_SYNC_STATE: SyncState = { lastRev: 0, lastHash: '', lastSyncAt: 0, auto: true, encrypt: false };

/** missing = เคยซิงก์แล้วแต่ข้อมูลบนคลาวด์หายไป (ถูกลบจากเครื่องอื่น) ต้องให้ผู้ใช้ตัดสินใจ ไม่อัปโหลดทับเอง */
export type SyncAction = 'noop' | 'upload' | 'download' | 'conflict' | 'missing';
