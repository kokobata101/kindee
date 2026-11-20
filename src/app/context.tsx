import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Profile } from '../db/types';
import { toISO } from '../lib/date';
import { runDueSchedules } from '../db/scheduler';
import { Button } from '../ui/kit';

import { t } from '../i18n';
type ToastKind = 'ok' | 'error';
interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface AppCtx {
  /** undefined = กำลังโหลด, null = ยังไม่มีโปรไฟล์ */
  profile: Profile | null | undefined;
  today: string;
  /** วันที่กำลังดู/บันทึก (ค่าเริ่มต้น = วันนี้ และเลื่อนตามเมื่อข้ามเที่ยงคืน) */
  date: string;
  setDate: (d: string) => void;
  toast: (msg: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error(t('useApp ต้องอยู่ใน <AppProvider>'));
  return c;
}

/** โปรไฟล์ที่การันตีว่ามีอยู่ (ใช้ในหน้าที่อยู่หลังด่าน onboarding) */
export function useProfile(): Profile {
  const { profile } = useApp();
  if (!profile) throw new Error(t('ยังไม่มีโปรไฟล์'));
  return profile;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(async () => (await db.profile.get(1)) ?? null, []);
  const [today, setToday] = useState(() => toISO());
  const [selected, setSelected] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  // เปลี่ยนวันอัตโนมัติ + รันรายการตั้งเวลาเมื่อเปิดแอป/กลับมาที่แอป/ทุกนาที
  useEffect(() => {
    const tick = () => {
      setToday(toISO());
      runDueSchedules().catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
    };
  }, []);

  // ธีม
  const themePref = profile?.theme ?? 'system';
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = themePref === 'dark' || (themePref === 'system' && !!mq?.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1612' : '#1FA971');
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [themePref]);

  const toast = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, msg, kind }].slice(-3)); // แสดงไม่เกิน 3 ข้อความพร้อมกัน
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })),
    [],
  );

  const date = selected ?? today;
  const setDate = useCallback((d: string) => setSelected(d === toISO() ? null : d), []);

  const value = useMemo<AppCtx>(
    () => ({ profile, today, date, setDate, toast, confirm }),
    [profile, today, date, setDate, toast, confirm],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            {t.msg}
          </div>
        ))}
      </div>
      {dialog && (
        <div className="dialog-overlay" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
          <div className="dialog">
            <h2 className="h3">{dialog.title}</h2>
            {dialog.body && <p className="caption" style={{ marginTop: 8 }}>{dialog.body}</p>}
            <div className="col gap8" style={{ marginTop: 20 }}>
              <Button
                variant={dialog.danger ? 'danger-solid' : 'primary'}
                onClick={() => {
                  dialog.resolve(true);
                  setDialog(null);
                }}
              >
                {dialog.confirmLabel ?? t('ตกลง')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  dialog.resolve(false);
                  setDialog(null);
                }}
              >{t('ยกเลิก')}</Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
