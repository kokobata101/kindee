// เครื่องมือตรวจค่าอาหารเทียบกับตารางอ้างอิง (เช่น ตารางองค์ประกอบอาหารไทย Thai FCD 2015)
//
//   node scripts/food-check.mjs worksheet > food-worksheet.csv
//       สร้างใบงาน CSV จาก src/data/foods.ts (ช่อง ref_* ว่างไว้ให้กรอกจากตารางอ้างอิง ต่อ 100 กรัม)
//   node scripts/food-check.mjs compare food-worksheet.csv [เกณฑ์%=20]
//       เทียบเฉพาะแถวที่กรอก ref_kcal แล้ว แสดงรายการที่ต่างเกินเกณฑ์ เรียงจากต่างมากไปน้อย
//
// หมายเหตุ: ใบงานเทียบ "ต่อ 100 กรัม" เพื่อไม่ให้ปนกับข้อสมมติเรื่องน้ำหนักต่อหน่วยของแอป
// ถ้าจะนำค่าจากตารางที่มีลิขสิทธิ์ไปใส่ในโค้ด ต้องตรวจเงื่อนไขการใช้ก่อน (ดู docs/food-verification.md)
import { readFileSync } from 'node:fs';

const BOM = '﻿';
const ROW = /^\s*\['(b\d+)', '([^']+)', '([^']+)', '[^']+', '([^']+)', ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), '(\w+)'\],/;

function loadFoods() {
  const src = readFileSync(new URL('../src/data/foods.ts', import.meta.url), 'utf8');
  return src.split('\n').flatMap((line) => {
    const m = line.match(ROW);
    if (!m) return [];
    const [, id, name, nameEn, serving, g, k, p, c, f, category] = m;
    return [{ id, name, nameEn, serving, grams: +g, kcal: +k, protein: +p, carb: +c, fat: +f, category }];
  });
}

const per100 = (v, grams) => Math.round((v / grams) * 1000) / 10;
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const HEAD = ['id', 'ชื่อ', 'หน่วย', 'กรัม/หน่วย', 'kcal/หน่วย', 'P', 'C', 'F', 'kcal/100g', 'ref_ชื่อในตาราง', 'ref_kcal/100g', 'ref_protein/100g', 'ref_carb/100g', 'ref_fat/100g', 'ref_แหล่ง/หมายเหตุ'];

function worksheet() {
  const lines = [HEAD, ...loadFoods().map((f) => [f.id, f.name, f.serving, f.grams, f.kcal, f.protein, f.carb, f.fat, per100(f.kcal, f.grams), '', '', '', '', '', ''])];
  process.stdout.write(BOM + lines.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
}

function compare(file, threshold = 20) {
  const foods = new Map(loadFoods().map((f) => [f.id, f]));
  const rows = parseCSV(readFileSync(file, 'utf8'));
  const idx = Object.fromEntries(rows[0].map((h, i) => [h.trim(), i]));
  for (const need of ['id', 'ref_kcal/100g']) if (!(need in idx)) throw new Error(`ไม่พบคอลัมน์ ${need}`);
  const out = [];
  let filled = 0;
  for (const r of rows.slice(1)) {
    const f = foods.get(r[idx.id]);
    const ref = parseFloat(r[idx['ref_kcal/100g']]);
    if (!f || !Number.isFinite(ref) || ref <= 0) continue;
    filled++;
    const ours = per100(f.kcal, f.grams);
    const diff = ((ours - ref) / ref) * 100;
    out.push({ f, ours, ref, diff, refServing: Math.round((ref * f.grams) / 100), name: r[idx['ref_ชื่อในตาราง']] ?? '' });
  }
  out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  console.log(`เทียบแล้ว ${filled} รายการ (จาก ${foods.size}) เกณฑ์ต่างเกิน ±${threshold}%\n`);
  const bad = out.filter((x) => Math.abs(x.diff) > threshold);
  for (const x of bad) {
    console.log(`${x.f.id} ${x.f.name} [${x.f.serving} ${x.f.grams} g]  แอป ${x.ours} vs ตาราง ${x.ref} kcal/100g (${x.diff > 0 ? '+' : ''}${x.diff.toFixed(0)}%)  → ต่อหน่วยตามตาราง ≈ ${x.refServing} kcal (แอป ${x.f.kcal})${x.name ? `  ตาราง: ${x.name}` : ''}`);
  }
  console.log(bad.length ? `\nเกินเกณฑ์ ${bad.length} รายการ` : '\nไม่มีรายการที่ต่างเกินเกณฑ์');
  if (filled < foods.size) console.log(`ยังไม่ได้กรอกอีก ${foods.size - filled} รายการ`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'worksheet') worksheet();
else if (cmd === 'compare' && a) compare(a, b ? Number(b) : 20);
else {
  console.error('ใช้: node scripts/food-check.mjs worksheet > ใบงาน.csv\n     node scripts/food-check.mjs compare ใบงาน.csv [เกณฑ์%]');
  process.exit(1);
}
