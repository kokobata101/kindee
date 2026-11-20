import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Heart, Leaf, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/kit';
import { importBackup, BackupError } from '../db/backup';
import { useApp } from '../app/context';
import { APP_NAME, APP_NAME_EN, APP_VERSION } from '../app/meta';

import { t } from '../i18n';
import { LanguageSwitch } from '../ui/LanguageSwitch';
export default function Welcome() {
  const nav = useNavigate();
  const { toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function restore(file: File) {
    setBusy(true);
    try {
      const s = await importBackup(await file.text());
      toast(t('กู้คืนสำเร็จ: อาหาร {entries} รายการ น้ำหนัก {weights} ครั้ง', { entries: s.entries, weights: s.weights }));
      nav('/', { replace: true });
    } catch (err) {
      toast(err instanceof BackupError ? err.message : t('กู้คืนไม่สำเร็จ'), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <main className="screen no-tabs" style={{ minHeight: '100dvh', gap: 20, paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div className="row-flex" style={{ gap: 12 }}>
        <span className="logo-mark" aria-hidden><Leaf size={26} /></span>
        <div className="col">
          <span className="h2">{APP_NAME}</span>
          <span className="caption muted">{APP_NAME_EN} · Open Source</span>
        </div>
      </div>
      <LanguageSwitch />

      <div
        aria-hidden
        style={{
          position: 'relative',
          height: 250,
          borderRadius: 28,
          background: 'var(--brand-soft)',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 178, height: 178, transform: 'translate(-50%,-50%)', borderRadius: 999, background: 'var(--bg-card)', display: 'grid', placeItems: 'center', fontSize: 84 }}>🍱</div>
        <span className="pill" style={{ position: 'absolute', top: 14, left: 12, background: 'var(--bg-card)', color: 'var(--text)', boxShadow: 'var(--shadow)' }}>{t('🍗 ข้าวมันไก่ 585 kcal')}</span>
        <span className="pill" style={{ position: 'absolute', top: 70, right: 12, background: 'var(--bg-card)', color: 'var(--text)', boxShadow: 'var(--shadow)' }}>{t('🔥 ต่อเนื่อง 12 วัน')}</span>
        <span className="pill" style={{ position: 'absolute', bottom: 14, left: 22, background: 'var(--bg-card)', color: 'var(--text)', boxShadow: 'var(--shadow)' }}>{t('💧 น้ำ 1.8 / 2.6 ลิตร')}</span>
      </div>

      <div className="col gap8">
        <h1 className="h1">{t('นับแคลอรี่ง่ายๆ')}<br />{t('สำหรับอาหารไทย')}</h1>
        <p className="body-m t2">{t('แอปโอเพนซอร์สสำหรับคนไทย ใช้ฟรี 100% ไม่มีโฆษณา ไม่ล็อกฟีเจอร์')}<br />{t('ข้อมูลทั้งหมดอยู่ในเครื่องของคุณเท่านั้น')}</p>
      </div>

      <div className="row-flex wrap" style={{ gap: 8 }}>
        <span className="pill" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}><Heart size={14} />{' '}{t('ฟรี 100%')}</span>
        <span className="pill" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}><Code2 size={14} />{' '}{t('โอเพนซอร์ส')}</span>
        <span className="pill" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}><ShieldCheck size={14} />{' '}{t('ไม่มีโฆษณา')}</span>
      </div>

      <div className="grow" />
      <div className="col gap12">
        <Button onClick={() => nav('/setup')}>{t('เริ่มต้นใช้งาน')}</Button>
        <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>{t('กู้คืนจากไฟล์สำรอง')}</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label={t('เลือกไฟล์สำรอง')}
          onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
        />
        <p className="caption center muted">{t('เวอร์ชัน {APP_VERSION} · ซอร์สโค้ดเปิดให้ทุกคน', { APP_VERSION })}</p>
      </div>
    </main>
  );
}
