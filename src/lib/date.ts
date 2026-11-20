
import { lang, t } from '../i18n';
// ฟังก์ชันวันที่ทั้งหมดใช้เวลาท้องถิ่นของเครื่อง และเก็บวันเป็นสตริง 'YYYY-MM-DD'

export const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** a - b เป็นจำนวนวัน */
export function diffDays(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  return Math.round(
    (Date.UTC(da.getFullYear(), da.getMonth(), da.getDate()) -
      Date.UTC(db.getFullYear(), db.getMonth(), db.getDate())) /
      86400000,
  );
}

/** 0 = จันทร์ ... 6 = อาทิตย์ */
export function dowIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

/** วันจันทร์ของสัปดาห์ที่ iso อยู่ */
export function weekStart(iso: string): string {
  return addDays(iso, -dowIndex(iso));
}

export function nowHM(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function rangeDays(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startIso, i));
}

export const THAI_DOW_SHORT = [t('จ'), t('อ'), t('พ'), t('พฤ'), t('ศ'), t('ส'), t('อา')] as const;
export const THAI_DOW_FULL = [
  t('วันจันทร์'),
  t('วันอังคาร'),
  t('วันพุธ'),
  t('วันพฤหัสบดี'),
  t('วันศุกร์'),
  t('วันเสาร์'),
  t('วันอาทิตย์'),
] as const;
export const THAI_MONTH_SHORT = [
  t('ม.ค.'),
  t('ก.พ.'),
  t('มี.ค.'),
  t('เม.ย.'),
  t('พ.ค.'),
  t('มิ.ย.'),
  t('ก.ค.'),
  t('ส.ค.'),
  t('ก.ย.'),
  t('ต.ค.'),
  t('พ.ย.'),
  t('ธ.ค.'),
] as const;

/** ไทย: 24 ต.ค. 2569 (ปี พ.ศ.) · อังกฤษ: 24 Oct 2026 (ชื่อฟังก์ชันคงไว้เพื่อไม่ต้องแก้ทุกจุดที่เรียก) */
export function formatThaiDate(iso: string, withYear = true): string {
  const d = parseISO(iso);
  const base = `${d.getDate()} ${THAI_MONTH_SHORT[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear() + (lang === 'th' ? 543 : 0)}` : base;
}

/** วันเสาร์ที่ 24 ต.ค. */
export function formatThaiLong(iso: string): string {
  const d = parseISO(iso);
  return t('{weekday}ที่ {day} {month}', { weekday: THAI_DOW_FULL[dowIndex(iso)], day: d.getDate(), month: THAI_MONTH_SHORT[d.getMonth()] });
}

export function greetingFor(hour: number): string {
  if (hour < 5) return t('ดึกแล้ว');
  if (hour < 12) return t('สวัสดีตอนเช้า');
  if (hour < 17) return t('สวัสดีตอนบ่าย');
  if (hour < 20) return t('สวัสดีตอนเย็น');
  return t('สวัสดีตอนค่ำ');
}
