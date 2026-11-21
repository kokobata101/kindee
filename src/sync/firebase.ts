// หลังบ้านจริงด้วย Firebase: Authentication (Google / Facebook / Apple / LINE) + Firestore (เก็บสแนปช็อตสำรอง)
// โหลดแบบ dynamic import เท่านั้น เมื่อเจ้าของเว็บตั้งค่า VITE_FIREBASE_* ไว้ (ดู docs/CLOUD.md)
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  deleteUser,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type AuthProvider,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, runTransaction, writeBatch, type Firestore } from 'firebase/firestore';
import { t } from '../i18n';
import { splitChunks } from './engine';
import { RevConflictError, SignInCancelled, type CloudBackend, type CloudUser, type ProviderId, type RemoteMeta, type RemoteStore } from './types';

const MAX_PAYLOAD = 8_000_000;

const PROVIDER_IDS: Record<string, ProviderId> = {
  'google.com': 'google',
  'facebook.com': 'facebook',
  'apple.com': 'apple',
  'oidc.line': 'line',
};

function makeProvider(p: ProviderId): AuthProvider {
  switch (p) {
    case 'google': {
      const g = new GoogleAuthProvider();
      g.setCustomParameters({ prompt: 'select_account' });
      return g;
    }
    case 'facebook': {
      const f = new FacebookAuthProvider();
      f.addScope('email');
      return f;
    }
    case 'apple': {
      const a = new OAuthProvider('apple.com');
      a.addScope('email');
      a.addScope('name');
      return a;
    }
    case 'line': {
      // LINE Login ใช้ผ่าน OpenID Connect ของ Firebase (Identity Platform) รหัสผู้ให้บริการต้องตั้งชื่อว่า "oidc.line"
      const l = new OAuthProvider('oidc.line');
      l.addScope('openid');
      l.addScope('profile');
      l.addScope('email');
      return l;
    }
  }
}

/** แปลงข้อผิดพลาดของ Firebase Auth เป็นข้อความที่คนอ่านรู้เรื่อง */
export function mapAuthError(e: unknown): Error {
  const code = (e as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return new SignInCancelled();
    case 'auth/network-request-failed':
      return new Error(t('เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง'));
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return new Error(t('ผู้ให้บริการนี้ยังไม่ได้เปิดใช้งานในโปรเจกต์ Firebase ของเว็บนี้'));
    case 'auth/unauthorized-domain':
      return new Error(t('โดเมนของเว็บนี้ยังไม่ได้เพิ่มใน Authorized domains ของ Firebase'));
    case 'auth/account-exists-with-different-credential':
      return new Error(t('อีเมลนี้เคยเข้าสู่ระบบด้วยผู้ให้บริการอื่นแล้ว ลองเข้าด้วยผู้ให้บริการเดิม'));
    case 'auth/too-many-requests':
      return new Error(t('ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่'));
    case 'auth/requires-recent-login':
      return new Error(t('เพื่อความปลอดภัย ต้องล็อกอินใหม่ก่อนจึงลบบัญชีได้'));
    default:
      return new Error(t('เข้าสู่ระบบไม่สำเร็จ ({code})', { code: code || 'unknown' }));
  }
}

class FirestoreStore implements RemoteStore {
  constructor(private fs: Firestore) {}
  private metaRef = (uid: string) => doc(this.fs, 'users', uid, 'backup', 'meta');
  private chunkRef = (uid: string, i: number) => doc(this.fs, 'users', uid, 'backup', `chunk_${i}`);

  async getMeta(uid: string): Promise<RemoteMeta | null> {
    const s = await getDoc(this.metaRef(uid));
    return s.exists() ? (s.data() as RemoteMeta) : null;
  }

  async getPayload(uid: string, meta: RemoteMeta): Promise<string> {
    const snaps = await Promise.all(Array.from({ length: meta.chunkCount }, (_, i) => getDoc(this.chunkRef(uid, i))));
    return snaps
      .map((s) => {
        const d = s.data() as { rev?: number; data?: string } | undefined;
        // ก้อนต้องเป็นรุ่นเดียวกับ meta ไม่งั้นแปลว่ามีเครื่องอื่นอัปโหลดแทรกระหว่างอ่าน
        if (!s.exists() || d?.rev !== meta.rev || typeof d.data !== 'string') throw new Error('stale chunk');
        return d.data;
      })
      .join('');
  }

  async put(uid: string, a: { payload: string; encrypted: boolean; deviceId: string; hash: string; expectedRev: number }): Promise<RemoteMeta> {
    if (a.payload.length > MAX_PAYLOAD) throw new Error(t('ข้อมูลใหญ่เกินกว่าจะสำรองขึ้นคลาวด์'));
    const parts = splitChunks(a.payload);
    return runTransaction(this.fs, async (tx) => {
      const cur = await tx.get(this.metaRef(uid));
      const old = cur.exists() ? (cur.data() as RemoteMeta) : null;
      if ((old?.rev ?? 0) !== a.expectedRev) throw new RevConflictError(old?.rev ?? 0);
      const rev = (old?.rev ?? 0) + 1;
      parts.forEach((data, i) => tx.set(this.chunkRef(uid, i), { rev, data }));
      for (let i = parts.length; i < (old?.chunkCount ?? 0); i++) tx.delete(this.chunkRef(uid, i));
      const meta: RemoteMeta = { rev, updatedAt: Date.now(), deviceId: a.deviceId, encrypted: a.encrypted, chunkCount: parts.length, hash: a.hash, size: a.payload.length };
      tx.set(this.metaRef(uid), meta);
      return meta;
    });
  }

  async remove(uid: string): Promise<void> {
    const m = await this.getMeta(uid);
    if (!m) return;
    const b = writeBatch(this.fs);
    for (let i = 0; i < m.chunkCount; i++) b.delete(this.chunkRef(uid, i));
    b.delete(this.metaRef(uid));
    await b.commit();
  }
}

function toUser(u: User): CloudUser {
  const info = u.providerData[0];
  return {
    uid: u.uid,
    name: u.displayName ?? info?.displayName ?? null,
    email: u.email ?? info?.email ?? null,
    photoURL: u.photoURL ?? info?.photoURL ?? null,
    provider: PROVIDER_IDS[info?.providerId ?? ''] ?? info?.providerId ?? 'unknown',
  };
}

export function createFirebaseBackend(config: FirebaseOptions, providers: ProviderId[]): CloudBackend {
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth: Auth = getAuth(app);
  const store = new FirestoreStore(getFirestore(app));

  return {
    providers,
    store,
    onUser(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
    },
    async signIn(p) {
      const provider = makeProvider(p);
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code;
        // เบราว์เซอร์บางตัว (เช่น PWA บน iOS) บล็อกหน้าต่างป๊อปอัป → ใช้วิธีเปลี่ยนหน้าแทน
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw mapAuthError(e);
      }
    },
    async completeRedirect() {
      try {
        await getRedirectResult(auth);
      } catch (e) {
        throw mapAuthError(e);
      }
    },
    async signOut() {
      await auth.signOut();
    },
    async deleteAccount() {
      const user = auth.currentUser;
      if (!user) return;
      await store.remove(user.uid);
      try {
        await deleteUser(user);
      } catch (e) {
        if ((e as { code?: string }).code !== 'auth/requires-recent-login') throw mapAuthError(e);
        // ต้องยืนยันตัวตนอีกครั้งด้วยผู้ให้บริการเดิม แล้วลองลบใหม่
        const pid = PROVIDER_IDS[user.providerData[0]?.providerId ?? ''];
        if (!pid) throw mapAuthError(e);
        try {
          await reauthenticateWithPopup(user, makeProvider(pid));
          await deleteUser(user);
        } catch (e2) {
          throw mapAuthError(e2);
        }
      }
    },
  };
}
