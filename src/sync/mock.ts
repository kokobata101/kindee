// หลังบ้านจำลองสำหรับทดสอบอัตโนมัติ (build ด้วย --mode cloudmock เท่านั้น ไม่มีในรุ่นที่ปล่อยจริง)
// ปุ่มล็อกอินจะ "สร้างผู้ใช้ปลอม" ทันทีโดยไม่ผ่านผู้ให้บริการจริง ส่วนที่เก็บข้อมูลคุยผ่าน fetch ไปยังโฮสต์ปลอม
// ซึ่งสคริปต์ e2e ดักไว้ (page.route) เพื่อจำลองเซิร์ฟเวอร์ที่ใช้ร่วมกันระหว่าง "สองเครื่อง"
import { ALL_PROVIDERS, RevConflictError, type CloudBackend, type CloudUser, type ProviderId, type RemoteMeta, type RemoteStore } from './types';

export const MOCK_BASE = 'https://mock-cloud.invalid/';
const USER_KEY = 'kindee.mock.user';

class HttpStore implements RemoteStore {
  private async call(path: string, init?: RequestInit): Promise<Response> {
    return fetch(MOCK_BASE + path, init);
  }
  async getMeta(uid: string): Promise<RemoteMeta | null> {
    const r = await this.call(`meta/${uid}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as RemoteMeta;
  }
  async getPayload(uid: string, meta: RemoteMeta): Promise<string> {
    const r = await this.call(`payload/${uid}?rev=${meta.rev}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }
  async put(uid: string, args: Parameters<RemoteStore['put']>[1]): Promise<RemoteMeta> {
    const r = await this.call(`put/${uid}`, { method: 'POST', body: JSON.stringify(args) });
    if (r.status === 409) throw new RevConflictError(((await r.json()) as { rev: number }).rev);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as RemoteMeta;
  }
  async remove(uid: string): Promise<void> {
    const r = await this.call(`remove/${uid}`, { method: 'POST' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  }
}

export function createMockBackend(providers: ProviderId[] = ALL_PROVIDERS): CloudBackend {
  const listeners = new Set<(u: CloudUser | null) => void>();
  const read = (): CloudUser | null => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as CloudUser) : null;
    } catch {
      return null;
    }
  };
  const emit = () => listeners.forEach((l) => l(read()));
  const store = new HttpStore();
  return {
    providers,
    store,
    onUser(cb) {
      listeners.add(cb);
      queueMicrotask(() => cb(read()));
      return () => listeners.delete(cb);
    },
    async signIn(p) {
      const u: CloudUser = { uid: `mock-${p}`, name: `ผู้ใช้ทดสอบ (${p})`, email: `${p}@example.test`, photoURL: null, provider: p };
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      emit();
    },
    async signOut() {
      localStorage.removeItem(USER_KEY);
      emit();
    },
    async deleteAccount() {
      const u = read();
      if (u) await store.remove(u.uid);
      localStorage.removeItem(USER_KEY);
      emit();
    },
  };
}
