import { db } from './db';
import type { Food } from './types';
import { parseOffProduct } from '../lib/barcode';

import { t } from '../i18n';
export const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'code,product_name,product_name_th,generic_name,brands,serving_size,serving_quantity,nutriments';

export type LookupResult =
  | { kind: 'found'; food: Food; per: 'serving' | '100g'; incomplete: boolean; cached: boolean }
  | { kind: 'notfound' }
  | { kind: 'nodata'; name: string }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

/** หาจากอาหารในเครื่องก่อน (สินค้าที่เคยสแกน/ที่ผู้ใช้สร้างเองพร้อมบาร์โค้ด) แล้วค่อยถาม Open Food Facts */
export async function lookupBarcode(
  code: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<LookupResult> {
  const local = (await db.foods.get(`bc-${code}`)) ?? (await db.foods.filter((f) => f.barcode === code).first());
  if (local) return { kind: 'found', food: local, per: local.serving.startsWith('100') ? '100g' : 'serving', incomplete: false, cached: true };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${OFF_ENDPOINT}/${encodeURIComponent(code)}?fields=${FIELDS}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) return { kind: 'notfound' };
    if (!res.ok) return { kind: 'error', message: t('เซิร์ฟเวอร์ตอบกลับผิดปกติ ({status})', { status: res.status }) };
    const parsed = parseOffProduct(await res.json(), code);
    if (parsed.kind !== 'found') return parsed;
    await db.foods.put(parsed.food); // เก็บไว้ใช้ซ้ำแบบออฟไลน์
    return { ...parsed, cached: false };
  } catch (e) {
    // ไม่มีเน็ต / หมดเวลา / ถูกบล็อก (CORS)
    if (e instanceof SyntaxError) return { kind: 'error', message: t('ข้อมูลที่ได้รับไม่ถูกต้อง') };
    return { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
