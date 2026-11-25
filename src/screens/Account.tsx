import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Cloud, CloudOff, Download, KeyRound, LogOut, RefreshCw, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { useApp } from '../app/context';
import { exportBackup } from '../db/backup';
import { downloadText } from '../lib/download';
import { locale, t } from '../i18n';
import { Button, Group, Header, ListRow, Sheet, TextField } from '../ui/kit';
import { useCloud } from '../sync/context';
import { PASSPHRASE_MIN } from '../sync/controller';
import type { ProviderId, RemoteMeta } from '../sync/types';

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook', apple: 'Apple', line: 'LINE' };
const PROVIDER_STYLE: Record<ProviderId, { bg: string; fg: string; badge: string; border?: string }> = {
  google: { bg: '#ffffff', fg: '#1f1f1f', badge: 'G', border: '1px solid var(--border)' },
  facebook: { bg: '#1877f2', fg: '#ffffff', badge: 'f' },
  apple: { bg: '#111111', fg: '#ffffff', badge: 'A' },
  line: { bg: '#06c755', fg: '#ffffff', badge: 'L' },
};

const when = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

export default function Account() {
  const { supported, providers, ctl, snap } = useCloud();
  const { toast, confirm } = useApp();
  const [encSheet, setEncSheet] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [unlock, setUnlock] = useState('');
  const busy = snap.busy !== null;

  async function saveBackupFile() {
    const file = await exportBackup();
    downloadText(`kindee-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file), 'application/json;charset=utf-8');
    toast(t('ดาวน์โหลดไฟล์สำรองแล้ว เก็บไว้ในที่ปลอดภัย'));
  }

  // ───── ยังไม่เปิดใช้ ─────
  if (!supported) {
    const nativeOrFile = (() => {
      try {
        return !Capacitor.isNativePlatform() && location.protocol === 'file:';
      } catch {
        return false;
      }
    })();
    return (
      <>
        <Header title={t('บัญชีและซิงก์')} />
        <main className="screen no-tabs">
          <section className="card tone-gray card-pad col gap12" aria-label={t('สถานะระบบบัญชี')}>
            <span className="row-flex" style={{ gap: 10 }}>
              <CloudOff size={22} aria-hidden />
              <h2 className="h3">{t('ยังไม่เปิดใช้ล็อกอินในเวอร์ชันนี้')}</h2>
            </span>
            <p className="body-m t2">
              {nativeOrFile
                ? t('ไฟล์ที่เปิดจากเครื่อง (file://) ยังไม่รองรับการล็อกอิน ใช้ผ่านเว็บเวอร์ชันออนไลน์หรือแอปมือถือได้ ส่วนข้อมูลของคุณยังเก็บในเครื่องและสำรองเป็นไฟล์ได้ตามปกติ')
                : t('เว็บนี้ยังไม่ได้ตั้งค่าบริการล็อกอิน แอปยังใช้งานได้ครบทุกอย่างโดยไม่ต้องมีบัญชี ถ้าคุณเป็นเจ้าของเว็บ ดูวิธีเปิดใช้ได้ใน docs/CLOUD.md')}
            </p>
          </section>
        </main>
      </>
    );
  }

  // ───── กำลังตรวจสถานะ ─────
  if (!snap.ready) {
    return (
      <>
        <Header title={t('บัญชีและซิงก์')} />
        <main className="screen no-tabs center" role="status">
          <span className="muted" style={{ paddingTop: '30dvh' }}>{t('กำลังโหลด…')}</span>
        </main>
      </>
    );
  }

  // ───── ยังไม่ล็อกอิน ─────
  if (!snap.user) {
    return (
      <>
        <Header title={t('บัญชีและซิงก์')} />
        <main className="screen no-tabs">
          <section className="card tone-sky card-pad col gap12">
            <span className="row-flex" style={{ gap: 10 }}>
              <Cloud size={22} aria-hidden />
              <h2 className="h3">{t('ล็อกอินเพื่อสำรองและใช้ข้ามเครื่อง')}</h2>
            </span>
            <p className="body-m">{t('ไม่บังคับ — ไม่ล็อกอินก็ใช้แอปได้ครบทุกอย่าง ล็อกอินแล้วข้อมูลของคุณจะมีสำเนาสำรอง และเปิดบนมือถือเครื่องอื่นหรือคอมพิวเตอร์ได้ข้อมูลชุดเดียวกัน')}</p>
          </section>

          <section className="col gap8" aria-label={t('เลือกวิธีล็อกอิน')}>
            {providers.map((p) => {
              const s = PROVIDER_STYLE[p];
              return (
                <button
                  key={p}
                  type="button"
                  className="btn btn-block"
                  disabled={busy}
                  onClick={() => ctl?.signIn(p)}
                  style={{ background: s.bg, color: s.fg, border: s.border ?? 'none', justifyContent: 'center', gap: 10 }}
                >
                  <span aria-hidden style={{ fontWeight: 800, width: 22, height: 22, borderRadius: 11, display: 'inline-grid', placeItems: 'center', background: p === 'google' ? '#f1f3f4' : 'rgba(255,255,255,.22)' }}>{s.badge}</span>
                  {t('ดำเนินการต่อด้วย {name}', { name: PROVIDER_LABEL[p] })}
                </button>
              );
            })}
            {snap.error && <p className="field-error" role="alert">{snap.error}</p>}
          </section>

          <section className="card card-pad col gap8">
            <b className="body-medium row-flex" style={{ gap: 8 }}><ShieldCheck size={18} aria-hidden />{t('ข้อมูลของคุณอยู่ที่ไหน')}</b>
            <p className="caption muted">{t('เมื่อล็อกอิน สำเนาสำรองของข้อมูล (โปรไฟล์ อาหาร น้ำหนัก กิจกรรม) จะถูกเก็บบนคลาวด์ของเจ้าของเว็บนี้ ไม่ใช่เซิร์ฟเวอร์ส่วนกลางของกินดี กฎความปลอดภัยให้เฉพาะบัญชีของคุณเข้าถึงผ่านแอปได้ แต่ผู้ดูแลคลาวด์ของเว็บนี้อ่านข้อมูลที่ไม่ได้เข้ารหัสได้ในทางเทคนิค จึงแนะนำให้เปิดเข้ารหัสด้วยรหัสผ่านของคุณเอง และคุณลบข้อมูลบนคลาวด์หรือบัญชีได้ทุกเมื่อ ผู้ให้บริการล็อกอิน (Google ฯลฯ) จะรู้เพียงว่าคุณล็อกอินเข้ามา ไม่เห็นข้อมูลสุขภาพของคุณ')}</p>
          </section>
        </main>
      </>
    );
  }

  // ───── ล็อกอินแล้ว ─────
  const u = snap.user;
  const st = snap.state;
  const remote: RemoteMeta | null = snap.remote;

  async function enableEncryption() {
    if (pw1.length < PASSPHRASE_MIN) return setPwErr(t('รหัสผ่านต้องยาวอย่างน้อย {n} ตัวอักษร', { n: PASSPHRASE_MIN }));
    if (pw1 !== pw2) return setPwErr(t('รหัสผ่านสองช่องไม่ตรงกัน'));
    setPwErr(null);
    setEncSheet(false);
    const r = await ctl!.setEncrypt(true, pw1);
    setPw1('');
    setPw2('');
    if (r === 'uploaded') toast(t('เข้ารหัสข้อมูลบนคลาวด์แล้ว'));
  }

  async function toggleEncryption(on: boolean) {
    if (on) {
      setPw1('');
      setPw2('');
      setPwErr(null);
      setEncSheet(true);
      return;
    }
    if (!(await confirm({ title: t('ปิดการเข้ารหัส?'), body: t('ข้อมูลบนคลาวด์จะถูกอัปโหลดใหม่แบบไม่เข้ารหัส (ผู้ดูแลคลาวด์ของเว็บนี้อ่านได้ในทางเทคนิค)'), confirmLabel: t('ปิดการเข้ารหัส'), danger: true }))) return;
    await ctl!.setEncrypt(false);
  }

  async function resolve(choice: 'cloud' | 'local') {
    const ok = await confirm(
      choice === 'cloud'
        ? { title: t('ใช้ข้อมูลบนคลาวด์?'), body: t('ข้อมูลในเครื่องนี้ทั้งหมดจะถูกแทนที่ด้วยข้อมูลบนคลาวด์ แนะนำให้ดาวน์โหลดไฟล์สำรองของเครื่องนี้ไว้ก่อน'), confirmLabel: t('ใช้ข้อมูลบนคลาวด์'), danger: true }
        : { title: t('ใช้ข้อมูลของเครื่องนี้?'), body: t('ข้อมูลบนคลาวด์จะถูกแทนที่ด้วยข้อมูลของเครื่องนี้ เครื่องอื่นจะได้ข้อมูลนี้ตอนซิงก์'), confirmLabel: t('ใช้ข้อมูลเครื่องนี้'), danger: true },
    );
    if (!ok) return;
    const r = await ctl!.resolve(choice);
    if (r === 'uploaded' || r === 'downloaded') toast(t('ซิงก์เรียบร้อย'));
  }

  const statusText = snap.busy === 'sync'
    ? t('กำลังซิงก์…')
    : snap.pending
      ? t('รอคุณเลือก')
      : snap.locked
        ? t('รอรหัสผ่านเข้ารหัส')
        : st.lastSyncAt
          ? t('ซิงก์ล่าสุด {time}', { time: when(st.lastSyncAt) })
          : t('ยังไม่เคยซิงก์');

  return (
    <>
      <Header title={t('บัญชีและซิงก์')} />
      <main className="screen no-tabs">
        <section className="card card-pad row-flex" style={{ gap: 14 }} aria-label={t('บัญชีที่ล็อกอินอยู่')}>
          {u.photoURL ? (
            <img src={u.photoURL} alt="" width={52} height={52} style={{ borderRadius: 26 }} referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 22 }} aria-hidden>{[...(u.name ?? u.email ?? '👤')][0]}</span>
          )}
          <div className="col grow">
            <b className="h3" data-testid="acct-name">{u.name ?? u.email ?? t('บัญชีของฉัน')}</b>
            {u.email && <span className="caption">{u.email}</span>}
            <span className="caption muted">{t('เข้าสู่ระบบด้วย {name}', { name: PROVIDER_LABEL[u.provider] ?? u.provider })}</span>
          </div>
        </section>

        <section className="card tone-mint card-pad col gap12" aria-label={t('สถานะการซิงก์')}>
          <div className="row-flex between">
            <span className="col">
              <b className="body-medium" data-testid="sync-status">{statusText}</b>
              <span className="caption" data-testid="sync-rev">{st.lastRev > 0 ? t('ข้อมูลสำรองรุ่นที่ {rev}', { rev: st.lastRev }) : t('ยังไม่มีข้อมูลสำรองบนคลาวด์')}</span>
            </span>
            <Button block={false} small disabled={busy} onClick={async () => {
              const r = await ctl!.sync('manual');
              if (r === 'uploaded' || r === 'downloaded') toast(r === 'uploaded' ? t('สำรองขึ้นคลาวด์แล้ว') : t('ดึงข้อมูลจากคลาวด์แล้ว'));
              else if (r === 'noop') toast(t('ข้อมูลตรงกับคลาวด์แล้ว'));
            }}>
              <RefreshCw size={16} />{' '}{t('ซิงก์ตอนนี้')}
            </Button>
          </div>
          {snap.error && <p className="field-error" role="alert" data-testid="sync-error">{snap.error}</p>}
        </section>

        {snap.pending?.kind === 'conflict' && (
          <section className="card tone-peach card-pad col gap12" role="alert" aria-label={t('ข้อมูลสองฝั่งไม่ตรงกัน')}>
            <h2 className="h3">{t('ข้อมูลสองฝั่งไม่ตรงกัน')}</h2>
            <p className="body-m">
              {t('เครื่องนี้และคลาวด์ต่างก็มีการแก้ไขที่อีกฝั่งยังไม่มี')}{' '}
              {snap.pending.remote ? t('(คลาวด์อัปเดตล่าสุด {time})', { time: when(snap.pending.remote.updatedAt) }) : ''}
              {' '}{t('ระบบจึงยังไม่ทับข้อมูลฝั่งใดให้ — เลือกว่าจะใช้ชุดไหน')}
            </p>
            <Button variant="outline" onClick={saveBackupFile}><Download size={16} />{' '}{t('ดาวน์โหลดไฟล์สำรองของเครื่องนี้ก่อน')}</Button>
            <Button disabled={busy} onClick={() => resolve('cloud')}>{t('ใช้ข้อมูลบนคลาวด์ (แทนที่เครื่องนี้)')}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => resolve('local')}>{t('ใช้ข้อมูลเครื่องนี้ (ทับคลาวด์)')}</Button>
          </section>
        )}

        {snap.pending?.kind === 'missing' && (
          <section className="card tone-peach card-pad col gap12" role="alert" aria-label={t('ไม่พบข้อมูลบนคลาวด์')}>
            <h2 className="h3">{t('ไม่พบข้อมูลสำรองบนคลาวด์')}</h2>
            <p className="body-m">{t('ข้อมูลบนคลาวด์ถูกลบไปแล้ว (อาจลบจากอีกเครื่อง) ระบบจึงไม่อัปโหลดกลับขึ้นไปเอง')}</p>
            <Button disabled={busy} onClick={() => resolve('local')}>{t('อัปโหลดข้อมูลเครื่องนี้ขึ้นใหม่')}</Button>
            <Button variant="outline" onClick={() => ctl!.signOut()}>{t('ไม่ต้อง ออกจากระบบ')}</Button>
          </section>
        )}

        {snap.locked && (
          <section className="card card-pad col gap12" aria-label={t('ใส่รหัสผ่านเข้ารหัส')}>
            <h2 className="h3 row-flex" style={{ gap: 8 }}><KeyRound size={18} aria-hidden />{t('ใส่รหัสผ่านเข้ารหัส')}</h2>
            <p className="caption muted">{t('ข้อมูลบนคลาวด์เข้ารหัสไว้ ใส่รหัสผ่านที่ตั้งไว้เพื่อซิงก์ต่อ (แอปไม่เก็บรหัสผ่านไว้ ปิดหน้าเว็บแล้วต้องใส่ใหม่)')}</p>
            <TextField label={t('รหัสผ่านเข้ารหัส')} type="password" autoComplete="current-password" value={unlock} onChange={(e) => setUnlock(e.target.value)} />
            <Button disabled={busy || !unlock} onClick={async () => {
              ctl!.setPassphrase(unlock);
              const r = await ctl!.sync('manual');
              if (r === 'uploaded' || r === 'downloaded' || r === 'noop') setUnlock('');
            }}>{t('ปลดล็อกและซิงก์')}</Button>
          </section>
        )}

        <Group title={t('ตั้งค่าการซิงก์')}>
          <ListRow icon={<RefreshCw size={20} />} title={t('ซิงก์อัตโนมัติ')} sub={t('อัปโหลดหลังแก้ข้อมูล และตรวจคลาวด์เป็นระยะขณะเปิดแอป')} toggle={{ checked: st.auto, onChange: (v) => ctl!.setAuto(v) }} />
          <ListRow icon={<KeyRound size={20} />} tone="water" title={t('เข้ารหัสด้วยรหัสผ่านของฉัน')} sub={st.encrypt ? t('เปิดอยู่ · ผู้ดูแลคลาวด์ก็อ่านข้อมูลไม่ออก') : t('ปิดอยู่ · เหมาะถ้าไม่อยากจำรหัสผ่านเพิ่ม')} toggle={{ checked: st.encrypt, onChange: toggleEncryption }} />
        </Group>

        {remote && (
          <p className="caption muted">{t('บนคลาวด์: รุ่นที่ {rev} · {kb} KB · อัปเดต {time}', { rev: remote.rev, kb: Math.max(1, Math.round(remote.size / 1024)), time: when(remote.updatedAt) })}</p>
        )}

        <Group title={t('บัญชี')}>
          <ListRow icon={<LogOut size={20} />} title={t('ออกจากระบบ')} sub={t('ข้อมูลในเครื่องและบนคลาวด์ยังอยู่ครบ')} onClick={async () => {
            await ctl!.signOut();
            toast(t('ออกจากระบบแล้ว'));
          }} />
          <ListRow icon={<Trash2 size={20} />} danger title={t('ลบข้อมูลสำรองบนคลาวด์')} sub={t('ข้อมูลในเครื่องนี้ไม่ถูกลบ')} onClick={async () => {
            if (!(await confirm({ title: t('ลบข้อมูลสำรองบนคลาวด์?'), body: t('ลบถาวร กู้คืนไม่ได้ ข้อมูลในเครื่องที่ซิงก์ไว้ยังอยู่ และจะปิดซิงก์อัตโนมัติ'), confirmLabel: t('ลบบนคลาวด์'), danger: true }))) return;
            if (await ctl!.deleteCloudData()) toast(t('ลบข้อมูลบนคลาวด์แล้ว'));
          }} />
          <ListRow icon={<UserX size={20} />} danger title={t('ลบบัญชี')} sub={t('ลบข้อมูลบนคลาวด์และบัญชีล็อกอินนี้ทั้งหมด')} onClick={async () => {
            if (!(await confirm({ title: t('ลบบัญชีนี้?'), body: t('ข้อมูลสำรองบนคลาวด์และบัญชีล็อกอินจะถูกลบถาวร ข้อมูลในเครื่องนี้ยังอยู่'), confirmLabel: t('ลบบัญชี'), danger: true }))) return;
            if (await ctl!.deleteAccount()) toast(t('ลบบัญชีแล้ว'));
          }} />
        </Group>
        <p className="caption muted">{t('การลบข้อมูลในเครื่อง (ตั้งค่า → ลบข้อมูลทั้งหมด) ไม่ลบข้อมูลบนคลาวด์')}</p>
      </main>

      <Sheet open={encSheet} onClose={() => setEncSheet(false)} title={t('ตั้งรหัสผ่านเข้ารหัส')}>
        <div className="col gap16">
          <p className="caption muted">{t('ข้อมูลจะถูกเข้ารหัสในเครื่องคุณก่อนส่งขึ้นคลาวด์ ถ้าลืมรหัสผ่านนี้ จะกู้ข้อมูลบนคลาวด์ไม่ได้ (ไม่มีใครรีเซ็ตให้ได้) แต่ข้อมูลในเครื่องยังอยู่')}</p>
          <TextField label={t('รหัสผ่านเข้ารหัส')} type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} hint={t('อย่างน้อย {n} ตัวอักษร', { n: PASSPHRASE_MIN })} />
          <TextField label={t('ยืนยันรหัสผ่าน')} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={pwErr} />
          <Button onClick={enableEncryption}>{t('เปิดการเข้ารหัส')}</Button>
        </div>
      </Sheet>
    </>
  );
}
