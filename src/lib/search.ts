import type { Food } from '../db/types';

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').normalize('NFC');
}

/**
 * ค้นหาอาหารจากชื่อไทย/อังกฤษ/แบรนด์
 * ลำดับ: ขึ้นต้นด้วยคำค้น > มีคำค้นในชื่อ > ชื่ออังกฤษ/แบรนด์
 */
export function searchFoods(foods: Food[], query: string, limit = 60): Food[] {
  const q = normalize(query);
  if (!q) return foods.slice(0, limit);
  const scored: { f: Food; s: number }[] = [];
  for (const f of foods) {
    const n = normalize(f.name);
    const en = f.nameEn ? normalize(f.nameEn) : '';
    const brand = f.brand ? normalize(f.brand) : '';
    let s = 0;
    if (n.startsWith(q)) s = 4;
    else if (n.includes(q)) s = 3;
    else if (en.startsWith(q)) s = 2;
    else if (en.includes(q) || brand.includes(q)) s = 1;
    if (s > 0) scored.push({ f, s });
  }
  scored.sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length);
  return scored.slice(0, limit).map((x) => x.f);
}
