import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { SyncController, type SyncSnapshot } from './controller';
import { cloudSupported, loadBackend } from './index';
import { EMPTY_SYNC_STATE, type ProviderId } from './types';

const IDLE: SyncSnapshot = {
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
const noopSub = () => () => undefined;

interface CloudCtx {
  /** เว็บนี้เปิดใช้ระบบล็อกอิน/ซิงก์หรือไม่ */
  supported: boolean;
  providers: ProviderId[];
  ctl: SyncController | null;
  snap: SyncSnapshot;
}

const Ctx = createContext<CloudCtx>({ supported: false, providers: [], ctl: null, snap: IDLE });
export const useCloud = (): CloudCtx => useContext(Ctx);

/** โหลดหลังบ้านแบบ lazy (ไม่ทำให้แอปช้าหรือพังถ้าไม่ได้ตั้งค่า) แล้วเปิดตัวควบคุมการซิงก์ */
export function CloudProvider({ children }: { children: ReactNode }) {
  const supported = cloudSupported();
  const [ctl, setCtl] = useState<SyncController | null>(null);

  useEffect(() => {
    if (!supported) return;
    let c: SyncController | null = null;
    let cancelled = false;
    loadBackend()
      .then((b) => {
        if (cancelled || !b) return;
        c = new SyncController(b);
        c.start();
        setCtl(c);
      })
      .catch(() => undefined); // โหลดไม่สำเร็จ (เช่น ออฟไลน์ครั้งแรก) = ใช้งานแบบไม่ล็อกอินต่อได้
    return () => {
      cancelled = true;
      c?.stop();
    };
  }, [supported]);

  const snap = useSyncExternalStore(ctl ? ctl.subscribe : noopSub, ctl ? ctl.getSnapshot : () => IDLE);
  return <Ctx.Provider value={{ supported, providers: ctl?.providers ?? [], ctl, snap }}>{children}</Ctx.Provider>;
}
