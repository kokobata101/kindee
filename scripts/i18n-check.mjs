// ตรวจคำแปล:  node scripts/i18n-check.mjs         → รายงานข้อความที่ยังไม่มีคำแปล/คำแปลเกิน/ตัวแปรไม่ตรง
//             node scripts/i18n-check.mjs --list  → พิมพ์ข้อความที่ต้องแปลทั้งหมด (JSON)
import { check, collectCodeKeys, collectDynamicKeys } from './i18n-lib.mjs';

if (process.argv.includes('--list')) {
  console.log(JSON.stringify([...new Set([...collectCodeKeys(), ...collectDynamicKeys()])], null, 1));
  process.exit(0);
}
const r = await check();
const show = (title, arr) => arr.length && console.log(`\n${title} (${arr.length})\n` + arr.map((k) => '  ' + JSON.stringify(k)).join('\n'));
show('ยังไม่มีคำแปลภาษาอังกฤษ', r.missing);
show('ตัวแปร {…} ในคำแปลไม่ตรงกับข้อความไทย', r.badPlaceholders);
show('คำแปลมีตัวอักษรไทยหลงเหลือ', r.thaiLeft);
show('คำแปลที่ไม่ได้ใช้แล้ว (ลบได้)', r.unused);
console.log(`\nข้อความทั้งหมด ${r.used.size} · มีคำแปล ${r.used.size - r.missing.length}`);
process.exit(r.missing.length || r.badPlaceholders.length ? 1 : 0);
