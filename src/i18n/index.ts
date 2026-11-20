// ระบบแปลภาษาแบบเบา ไม่ต้องใช้ไลบรารี
//
// - ข้อความต้นฉบับคือ "ภาษาไทย" และใช้เป็นคีย์ตรง ๆ: t('เพิ่มอาหาร')
// - ภาษาอื่นอยู่ในพจนานุกรม src/i18n/en.ts (ถ้าไม่มีคำแปล จะแสดงข้อความไทยแทน)
// - แทนค่าตัวแปรด้วย {ชื่อ}: t('เพิ่ม {n} รายการ', { n: 3 })
// - รูปเอกพจน์/พหูพจน์ (อังกฤษ): "{n} {n?item:items}" เลือกคำแรกเมื่อ n เป็น 1
// - เปลี่ยนภาษาแล้วโหลดหน้าใหม่ จึงไม่ต้องทำให้ทุกคอมโพเนนต์ติดตามภาษา
import { en } from './en';

export type Lang = 'th' | 'en';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
];

const KEY = 'kindee.lang';

function detect(): Lang {
  // ตัวช่วยสำหรับเทสต์: กำหนดภาษาผ่านตัวแปรสากลได้ (Node 22 มี navigator ของตัวเองด้วย)
  const forced = (globalThis as { __KINDEE_LANG__?: string }).__KINDEE_LANG__;
  if (forced === 'th' || forced === 'en') return forced;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    /* เข้าถึง localStorage ไม่ได้ (โหมดส่วนตัว ฯลฯ) */
  }
  // ไม่มีเบราว์เซอร์ (เช่น รันเทสต์/สคริปต์ใน Node) ใช้ภาษาต้นฉบับคือไทย
  if (typeof navigator === 'undefined') return 'th';
  return (navigator.language ?? '').toLowerCase().startsWith('th') ? 'th' : 'en';
}

export const lang: Lang = detect();
export const locale = lang === 'th' ? 'th-TH' : 'en-US';
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export type Params = Record<string, string | number | null | undefined>;

export function interpolate(msg: string, params?: Params): string {
  if (!params) return msg;
  return msg.replace(/\{(\w+)(?:\?([^:}]*):([^}]*))?\}/g, (whole, name: string, one?: string, many?: string) => {
    if (!(name in params)) return whole;
    const v = params[name];
    if (one !== undefined) return Number(v) === 1 ? one : (many ?? '');
    return v == null ? '' : String(v);
  });
}

export function translate(l: Lang, msg: string, params?: Params): string {
  const out = l === 'en' ? (en[msg] ?? msg) : msg;
  return interpolate(out, params);
}

export const t = (msg: string, params?: Params): string => translate(lang, msg, params);

/**
 * แปลโดยระบุบริบท เมื่อคำไทยเดียวกันแปลเป็นอังกฤษต่างกันตามที่ใช้
 * (เช่น "ปี" = อายุ → "yrs" แต่ "ปี" = ช่วงเวลา → "Year") คีย์ในพจนานุกรมคือ 'บริบท|ข้อความ'
 */
export const tc = (ctx: string, msg: string, params?: Params): string => {
  const k = `${ctx}|${msg}`;
  return interpolate(lang === 'en' ? (en[k] ?? en[msg] ?? msg) : msg, params);
};

/** ข้อความมีคำแปลหรือไม่ (ใช้ในเทสต์และสคริปต์ตรวจ) */
export const hasTranslation = (msg: string) => msg in en;

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ไม่เป็นไร ครั้งหน้าจะกลับไปใช้ภาษาของเบราว์เซอร์ */
  }
  location.reload();
}
