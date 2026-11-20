// ชื่อที่แสดงตามภาษา: ข้อมูลในฐานข้อมูลเก็บเป็นไทย (ต้นฉบับ) แล้วแปลตอนแสดงผล
import { BUILTIN_BY_ID } from '../data/foods';
import { lang, t } from '../i18n';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** ชื่ออาหาร: อาหารตั้งต้นใช้ชื่ออังกฤษเมื่อเปิดภาษาอังกฤษ ส่วนอาหารที่ผู้ใช้เพิ่มเองแสดงตามที่พิมพ์ */
export function foodName(f: { name: string; nameEn?: string; foodId?: string }): string {
  if (lang === 'en') {
    const en = f.nameEn ?? (f.foodId ? BUILTIN_BY_ID.get(f.foodId)?.nameEn : undefined);
    if (en) return cap(en);
  }
  return t(f.name);
}

/** หน่วยบริโภคตามจำนวน: unit ที่มีรูป "เอกพจน์|พหูพจน์" (อังกฤษ) เลือกตามจำนวน */
export function unitLabel(unit: string, total: number): string {
  const x = t(unit);
  if (!x.includes('|')) return x;
  const [one, many] = x.split('|');
  return total === 1 ? one : many;
}
