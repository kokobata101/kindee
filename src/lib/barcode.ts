// บาร์โค้ดสินค้าและการแปลงข้อมูลจาก Open Food Facts (ODbL) → อาหารของแอป
// โครงสร้างข้อมูลอ้างอิงเอกสาร Open Food Facts API v2: { code, status, product: { nutriments: { 'energy-kcal_100g', ... } } }

import type { Food } from '../db/types';

import { t } from '../i18n';
/** ลบทุกอย่างที่ไม่ใช่ตัวเลข (ช่องว่าง ขีด) */
export const cleanBarcode = (s: string) => s.replace(/\D/g, '');

/** ตรวจ check digit แบบ GS1 (EAN-8, UPC-A 12, EAN-13, GTIN-14) */
export function isValidBarcode(raw: string): boolean {
  const code = cleanBarcode(raw);
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // นับจากขวา: ตำแหน่งแรกถัดจาก check digit น้ำหนัก 3 สลับกับ 1
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}

/** ใช้ UPC-E 8 หลัก/ EAN ที่ผ่าน check digit เท่านั้น */
export function normalizeBarcode(raw: string): string | null {
  const code = cleanBarcode(raw);
  return isValidBarcode(code) ? code : null;
}

type Json = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const r1 = (n: number) => Math.round(n * 10) / 10;

export type OffParse =
  | { kind: 'found'; food: Food; per: 'serving' | '100g'; incomplete: boolean }
  | { kind: 'notfound' }
  | { kind: 'nodata'; name: string };

/**
 * แปลงคำตอบ Open Food Facts เป็น Food (ค่าต่อ 1 หน่วยบริโภค)
 * - ใช้ค่า *_serving ถ้ามี, ไม่งั้นคำนวณจาก *_100g × น้ำหนักต่อหน่วย (serving_quantity)
 * - ถ้าไม่รู้น้ำหนักต่อหน่วย ใช้ "100 กรัม" เป็น 1 หน่วย
 * - ไม่มีพลังงาน = ใช้ไม่ได้ (nodata) ส่วนโปรตีน/คาร์บ/ไขมันที่ขาดนับเป็น 0 และแจ้ง incomplete
 */
export function parseOffProduct(json: unknown, code: string): OffParse {
  const root = (json ?? {}) as Json;
  const p = root.product as Json | undefined;
  if (!p || typeof p !== 'object' || (root.status !== undefined && num(root.status) === 0)) return { kind: 'notfound' };

  const n = ((p.nutriments as Json | undefined) ?? {}) as Json;
  const brand = str(p.brands).split(',')[0].trim();
  const rawName = str(p.product_name_th) || str(p.product_name) || str(p.generic_name);
  const name = rawName || (brand ? t('{brand} (สินค้า)', { brand }) : '');

  const servingG = num(p.serving_quantity);
  const hasServing = servingG !== null && servingG > 0;

  // พลังงานต่อ 100 g (kcal) จากหลายคีย์ที่ OFF ใช้; ถ้ามีแต่ kJ แปลงด้วย 4.184
  const kcal100 =
    num(n['energy-kcal_100g']) ?? num(n['energy-kcal']) ?? ((x) => (x === null ? null : x / 4.184))(num(n['energy-kj_100g']) ?? num(n['energy_100g']));
  const kcalServing = num(n['energy-kcal_serving']);

  const factor = hasServing ? servingG! / 100 : 1;
  let kcal: number | null = null;
  let per: 'serving' | '100g' = '100g';
  if (kcalServing !== null && hasServing) {
    kcal = kcalServing;
    per = 'serving';
  } else if (kcal100 !== null) {
    kcal = kcal100 * factor;
    per = hasServing ? 'serving' : '100g';
  }
  if (kcal === null || kcal < 0 || kcal > 5000) return { kind: 'nodata', name };

  const macro = (key: string): number | null => {
    const s = num(n[`${key}_serving`]);
    if (s !== null && hasServing) return s;
    const h = num(n[`${key}_100g`]) ?? num(n[key]);
    return h === null ? null : h * factor;
  };
  const protein = macro('proteins');
  const carb = macro('carbohydrates');
  const fat = macro('fat');
  const incomplete = protein === null || carb === null || fat === null;

  const grams = hasServing ? servingG! : 100;
  const servingText = str(p.serving_size);
  const serving = per === 'serving' ? t('1 หน่วย{v1}', { v1: servingText ? ` (${servingText})` : ` (${Math.round(grams)} g)` }) : t('100 กรัม');

  return {
    kind: 'found',
    per,
    incomplete,
    food: {
      id: `bc-${code}`,
      name: name || t('สินค้า {code}', { code }),
      emoji: '🛒',
      serving,
      grams: Math.round(grams),
      kcal: Math.round(kcal),
      protein: r1(protein ?? 0),
      carb: r1(carb ?? 0),
      fat: r1(fat ?? 0),
      source: 'barcode',
      category: 'packaged',
      barcode: code,
      brand: brand || undefined,
    },
  };
}
