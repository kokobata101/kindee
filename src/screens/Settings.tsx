import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Download, Trash2, Upload } from 'lucide-react';
import { useApp, useProfile } from '../app/context';
import { BackupError, exportBackup, importBackup } from '../db/backup';
import { resetAll, updateProfile } from '../db/repo';
import { downloadText } from '../lib/download';
import { Group, Header, ListRow, Segmented } from '../ui/kit';
import { APP_VERSION } from '../app/meta';
import type { Profile } from '../db/types';

import { t } from '../i18n';
import { LanguageSwitch } from '../ui/LanguageSwitch';
const THEMES: { value: Profile['theme']; label: string }[] = [
  { value: 'system', label: t('ตามระบบ') },
  { value: 'light', label: t('สว่าง') },
  { value: 'dark', label: t('มืด') },
];

export default function Settings() {
  const p = useProfile();
  const nav = useNavigate();
  const { toast, confirm, today } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function backup() {
    const file = await exportBackup();
    downloadText(`kindee-backup-${today}.json`, JSON.stringify(file), 'application/json;charset=utf-8');
    toast(t('ดาวน์โหลดไฟล์สำรองแล้ว เก็บไว้ในที่ปลอดภัย'));
  }

  async function restore(file: File) {
    if (!(await confirm({ title: t('กู้คืนข้อมูลจากไฟล์สำรอง?'), body: t('ข้อมูลปัจจุบันในเครื่องนี้ทั้งหมดจะถูกแทนที่ด้วยข้อมูลในไฟล์'), confirmLabel: t('กู้คืน'), danger: true }))) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const s = await importBackup(await file.text());
      toast(t('กู้คืนสำเร็จ: อาหาร {entries} รายการ น้ำหนัก {weights} ครั้ง กิจกรรม {activities} ครั้ง', { entries: s.entries, weights: s.weights, activities: s.activities }) + (s.combos ? ' ' + t('มื้อประจำ {combos} ชุด', { combos: s.combos }) : ''));
      nav('/', { replace: true });
    } catch (err) {
      toast(err instanceof BackupError ? err.message : t('กู้คืนไม่สำเร็จ ข้อมูลเดิมไม่ถูกเปลี่ยน'), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function wipe() {
    if (!(await confirm({ title: t('ลบข้อมูลทั้งหมด?'), body: t('โปรไฟล์ อาหาร น้ำหนัก กิจกรรม และรายการที่สร้างเองจะถูกลบถาวร กู้คืนไม่ได้ ถ้ายังไม่ได้สำรองข้อมูล แนะนำให้สำรองก่อน'), confirmLabel: t('ลบทั้งหมด'), danger: true }))) return;
    await resetAll();
    toast(t('ลบข้อมูลทั้งหมดแล้ว'));
    nav('/welcome', { replace: true });
  }

  return (
    <>
      <Header title={t('ตั้งค่า')} />
      <main className="screen no-tabs">
        <section className="col gap8" aria-label={t('ธีม')}>
          <h2 className="group-title">{t('หน้าตาแอป')}</h2>
          <Segmented value={p.theme} onChange={(theme) => updateProfile({ theme })} options={THEMES} />
        </section>

        <section className="col gap8" aria-label={t('ภาษา')}>
          <h2 className="group-title">{t('ภาษา')} / Language</h2>
          <LanguageSwitch />
        </section>

        <Group title={t('อาหาร')}>
          <ListRow icon={<CalendarClock size={20} />} title={t('ตั้งเวลาบันทึกอาหารอัตโนมัติ')} sub={t('ทำงานเมื่อเปิดแอปอยู่เท่านั้น')} chevron onClick={() => nav('/schedules')} />
        </Group>

        <Group title={t('สำรองและกู้คืนข้อมูล')}>
          <ListRow icon={<Download size={20} />} title={t('สำรองข้อมูล')} sub={t('ดาวน์โหลดเป็นไฟล์ .json')} chevron onClick={backup} />
          <ListRow icon={<Upload size={20} />} tone="water" title={t('กู้คืนจากไฟล์สำรอง')} sub={busy ? t('กำลังกู้คืน…') : t('แทนที่ข้อมูลปัจจุบันทั้งหมด')} chevron onClick={() => fileRef.current?.click()} />
        </Group>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label={t('เลือกไฟล์สำรอง')}
          data-testid="restore-input"
          onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
        />
        <p className="caption muted">{t('ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น หากล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหายถ้าไม่ได้สำรองไว้ ควรสำรองเป็นประจำ')}</p>

        <Group title={t('โซนอันตราย')}>
          <ListRow icon={<Trash2 size={20} />} danger title={t('ลบข้อมูลทั้งหมด')} sub={t('ลบถาวร กู้คืนไม่ได้')} onClick={wipe} />
        </Group>
        <p className="caption muted center">{t('กินดี เวอร์ชัน {APP_VERSION}', { APP_VERSION })}</p>
      </main>
    </>
  );
}
