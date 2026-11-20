// รวบรวมข้อความที่ต้องแปลจากซอร์สโค้ด และตรวจพจนานุกรม src/i18n/en.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THAI = /[฀-๿]/;

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const unescape = (s) => s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));

/** ข้อความในโค้ดที่เรียก t('...') (ข้ามไฟล์พจนานุกรมและโค้ดข้อมูล) */
export function collectCodeKeys() {
  const keys = new Set();
  for (const f of walk(join(ROOT, 'src'))) {
    if (/src\/i18n\/|src\/data\//.test(f)) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?<![\w.])t\('((?:[^'\\]|\\.)*)'/g)) keys.add(unescape(m[1]));
    for (const m of src.matchAll(/(?<![\w.])tc\('([^']*)',\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(`${m[1]}|${unescape(m[2])}`);
  }
  return keys;
}

/** ข้อความที่แปลตอนแสดงผลผ่านตัวแปร t(name) จึงจับจากการเรียกตรง ๆ ไม่ได้ */
export function collectDynamicKeys() {
  const keys = new Set();
  const read = (p) => readFileSync(join(ROOT, p), 'utf8');
  for (const m of read('src/lib/activities.ts').matchAll(/name: '([^']+)'/g)) keys.add(m[1]);
  for (const m of read('src/lib/quick.ts').matchAll(/export const QUICK_\w+ = '([^']+)'/g)) {
    if (THAI.test(m[1])) keys.add(m[1].replace(/^\d+(?:\.\d+)?(?:\/\d+)?\s*/, ''));
  }
  keys.add('แคลอรี่ด่วน');
  // หน่วยบริโภคของอาหารตั้งต้น (ส่วนหลังตัวเลข)
  for (const m of read('src/data/foods.ts').matchAll(/^\s*\['b\d+', '[^']+', '[^']+', '[^']+', '([^']+)'/gm)) {
    const unit = m[1].replace(/^\d+(?:\.\d+)?(?:\/\d+)?\s*/, '');
    if (unit) keys.add(unit);
  }
  return keys;
}

/** อ่าน en.ts เป็นออบเจ็กต์ (ไฟล์เป็น TS แต่เป็นข้อมูลล้วน) */
export async function loadEn() {
  const raw = readFileSync(join(ROOT, 'src/i18n/en.ts'), 'utf8');
  const body = raw.slice(raw.indexOf('{', raw.indexOf('export const en'))).replace(/;\s*$/, '');
  return new Function(`return ${body}`)();
}

const placeholders = (s) => [...new Set([...s.matchAll(/\{(\w+)(?:\?[^:}]*:[^}]*)?\}/g)].map((m) => m[1]))].sort().join(',');

export async function check() {
  const used = new Set([...collectCodeKeys(), ...collectDynamicKeys()]);
  const en = await loadEn();
  const missing = [...used].filter((k) => THAI.test(k) && !(k in en));
  const unused = Object.keys(en).filter((k) => !used.has(k));
  const badPlaceholders = Object.keys(en).filter((k) => placeholders(k) !== placeholders(en[k]));
  const thaiLeft = Object.entries(en).filter(([, v]) => THAI.test(v)).map(([k]) => k);
  return { used, en, missing, unused, badPlaceholders, thaiLeft };
}
