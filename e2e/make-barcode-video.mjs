// สร้างวิดีโอกล้องจำลอง (.y4m) ที่มีบาร์โค้ด EAN-13 จริงอยู่กลางภาพ ไว้ป้อนให้ Chromium ผ่าน --use-file-for-fake-video-capture
// ใช้: node e2e/make-barcode-video.mjs <รหัส 12 หลักไม่รวม check digit> <ไฟล์.y4m>
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const bwipjs = require('bwip-js');

export function checkDigit(body12) {
  let sum = 0;
  [...body12].reverse().forEach((c, i) => (sum += Number(c) * (i % 2 === 0 ? 3 : 1)));
  return String((10 - (sum % 10)) % 10);
}

export async function makeVideo(body12, outFile) {
  const code = body12 + checkDigit(body12);
  const png = await bwipjs.toBuffer({ bcid: 'ean13', text: code, scale: 4, height: 18, includetext: true, textxalign: 'center', backgroundcolor: 'FFFFFF' });
  const dir = mkdtempSync(join(tmpdir(), 'bc-'));
  const pngPath = join(dir, 'bc.png');
  writeFileSync(pngPath, png);
  // วางบนพื้นขาว 640x480 (เหมือนถือกล่องสินค้าตรงหน้ากล้อง)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=640x480:r=10', '-i', pngPath,
    '-filter_complex', '[1:v]scale=420:-1[b];[0:v][b]overlay=(W-w)/2:(H-h)/2', '-t', '3', '-pix_fmt', 'yuv420p', outFile]);
  return code;
}

if (process.argv[2]) {
  console.log(await makeVideo(process.argv[2], process.argv[3]));
}
