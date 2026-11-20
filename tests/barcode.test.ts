import { describe, expect, it } from 'vitest';
import { cleanBarcode, isValidBarcode, normalizeBarcode, parseOffProduct } from '../src/lib/barcode';

describe('isValidBarcode', () => {
  it('accepts real-world valid codes', () => {
    expect(isValidBarcode('4006381333931')).toBe(true); // EAN-13 (Stabilo)
    expect(isValidBarcode('3017624010701')).toBe(true); // EAN-13 (Nutella, ตัวอย่างในเอกสาร OFF)
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
  });
  it('rejects a wrong check digit, wrong length, and junk', () => {
    expect(isValidBarcode('4006381333932')).toBe(false);
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
    expect(isValidBarcode('abcdefghijklm')).toBe(false);
  });
  it('tolerates spaces and dashes', () => {
    expect(cleanBarcode('4006 3813-33931')).toBe('4006381333931');
    expect(normalizeBarcode('4006 3813-33931')).toBe('4006381333931');
    expect(normalizeBarcode('4006381333932')).toBeNull();
  });
});

const off = (product: Record<string, unknown>, status = 1) => ({ code: '3017624010701', status, status_verbose: 'product found', product });

describe('parseOffProduct', () => {
  it('uses per-serving values when present', () => {
    const r = parseOffProduct(
      off({ product_name: 'Choco Bar', brands: 'Acme, Other', serving_size: '25 g', serving_quantity: '25', nutriments: { 'energy-kcal_100g': 500, 'energy-kcal_serving': 125, proteins_serving: 2.5, carbohydrates_serving: 14, fat_serving: 7 } }),
      '3017624010701',
    );
    expect(r.kind).toBe('found');
    if (r.kind !== 'found') return;
    expect(r.per).toBe('serving');
    expect(r.incomplete).toBe(false);
    expect(r.food).toMatchObject({ id: 'bc-3017624010701', name: 'Choco Bar', brand: 'Acme', kcal: 125, protein: 2.5, carb: 14, fat: 7, grams: 25, source: 'barcode', barcode: '3017624010701' });
    expect(r.food.serving).toBe('1 หน่วย (25 g)');
  });
  it('scales per-100g values by serving_quantity', () => {
    const r = parseOffProduct(off({ product_name: 'Snack', serving_quantity: 30, nutriments: { 'energy-kcal_100g': 540, proteins_100g: 6, carbohydrates_100g: 58, fat_100g: 31 } }), '3017624010701');
    if (r.kind !== 'found') throw new Error('expected found');
    expect(r.per).toBe('serving');
    expect(r.food).toMatchObject({ kcal: 162, protein: 1.8, carb: 17.4, fat: 9.3, grams: 30 });
  });
  it('falls back to 100 g when the serving size is unknown', () => {
    const r = parseOffProduct(off({ product_name: 'Milk', nutriments: { 'energy-kcal_100g': 64, proteins_100g: 3.3, carbohydrates_100g: 4.8, fat_100g: 3.6 } }), '3017624010701');
    if (r.kind !== 'found') throw new Error('expected found');
    expect(r.per).toBe('100g');
    expect(r.food).toMatchObject({ serving: '100 กรัม', grams: 100, kcal: 64 });
  });
  it('converts kJ when only energy in kJ is available', () => {
    const r = parseOffProduct(off({ product_name: 'Bar', nutriments: { 'energy-kj_100g': 2092 } }), '3017624010701');
    if (r.kind !== 'found') throw new Error('expected found');
    expect(r.food.kcal).toBe(500);
  });
  it('flags missing macros as incomplete (counted as 0)', () => {
    const r = parseOffProduct(off({ product_name: 'Drink', nutriments: { 'energy-kcal_100g': 42 } }), '3017624010701');
    if (r.kind !== 'found') throw new Error('expected found');
    expect(r.incomplete).toBe(true);
    expect(r.food).toMatchObject({ protein: 0, carb: 0, fat: 0 });
  });
  it('prefers the Thai product name', () => {
    const r = parseOffProduct(off({ product_name: 'Instant Noodles', product_name_th: 'บะหมี่กึ่งสำเร็จรูป', nutriments: { 'energy-kcal_100g': 450 } }), '3017624010701');
    if (r.kind !== 'found') throw new Error('expected found');
    expect(r.food.name).toBe('บะหมี่กึ่งสำเร็จรูป');
  });
  it('status 0 / missing product = not found', () => {
    expect(parseOffProduct({ code: '1', status: 0, status_verbose: 'product not found' }, '1').kind).toBe('notfound');
    expect(parseOffProduct({}, '1').kind).toBe('notfound');
    expect(parseOffProduct(null, '1').kind).toBe('notfound');
  });
  it('product without energy = nodata (keeps the name for prefill)', () => {
    const r = parseOffProduct(off({ product_name: 'Mystery', nutriments: { proteins_100g: 5 } }), '3017624010701');
    expect(r).toEqual({ kind: 'nodata', name: 'Mystery' });
  });
  it('ignores absurd energy values', () => {
    expect(parseOffProduct(off({ product_name: 'Bad', nutriments: { 'energy-kcal_100g': 99999 } }), '1').kind).toBe('nodata');
  });
  it('handles numeric strings with comma decimals and garbage', () => {
    const r = parseOffProduct(off({ product_name: 'X', serving_quantity: '33,5', nutriments: { 'energy-kcal_100g': '300', proteins_100g: 'n/a' } }), '1');
    if (r.kind !== 'found') throw new Error('expected found');
    expect(r.food.grams).toBe(34);
    expect(r.food.kcal).toBe(Math.round(300 * 0.335));
    expect(r.incomplete).toBe(true);
  });
});
