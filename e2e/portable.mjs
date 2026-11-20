// ทดสอบรุ่นดับเบิลคลิก (dist-portable เปิดผ่าน file://) ด้วยเบราว์เซอร์จริง
// ใช้: npm run build:portable && node e2e/portable.mjs   (ต้องมี e2e/fixtures/barcode.y4m สำหรับกล้องจำลอง)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { onboard } from './helpers.mjs';

// ใช้ playwright ที่ติดตั้งในโปรเจกต์ (npm install --no-save playwright && npx playwright install chromium)
// ถ้าไม่มี ลองตำแหน่งสำรองของเครื่องพัฒนาต้นทาง
const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    try {
      return createRequire('/opt/npm-tools/node_modules/playwright/index.js')('playwright');
    } catch {
      console.error('ไม่พบ playwright — ติดตั้งด้วย: npm install --no-save playwright && npx playwright install chromium');
      process.exit(2);
    }
  }
}
const { chromium } = loadPlaywright();

const root = fileURLToPath(new URL('../dist-portable/', import.meta.url));
const video = fileURLToPath(new URL('./fixtures/barcode.y4m', import.meta.url));
const URL0 = 'file://' + root + 'index.html';

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'], locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/openfoodfacts/.test(m.text()) && errors.push('console: ' + m.text()));

let failed = false;
const check = (cond, msg) => { console.log((cond ? '  ok  ' : ' FAIL ') + msg); if (!cond) failed = true; };

try {
  await onboard(page, URL0);
  check(true, 'เปิดจาก file:// และตั้งค่าโปรไฟล์ได้');

  await page.reload();
  await page.getByText('คำแนะนำวันนี้').waitFor({ timeout: 8000 });
  check(true, 'รีโหลดแล้วข้อมูลยังอยู่ (IndexedDB)');

  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').length; });
  check(fonts > 0, `ฟอนต์ไทยโหลดได้ (${fonts} ไฟล์)`);

  await page.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ status: 1, code: '8851001122336', product: { code: '8851001122336', product_name: 'นมจืดทดสอบ', serving_size: '200 ml', serving_quantity: 200, nutriments: { 'energy-kcal_serving': 130, proteins_serving: 6, carbohydrates_serving: 9, fat_serving: 7 } } }),
  }));
  await page.goto(URL0 + '#/scan?meal=lunch');
  await page.getByTestId('scan-name').waitFor({ timeout: 15000 });
  check((await page.getByTestId('scan-name').innerText()).includes('นมจืดทดสอบ'), 'สแกนบาร์โค้ดผ่านกล้องจำลองได้');

  await page.goto(URL0 + '#/share');
  await page.getByRole('button', { name: /สร้างลิงก์/ }).click();
  await page.getByTestId('file-warning').waitFor({ timeout: 5000 });
  const link = (await page.getByTestId('share-url').innerText()).trim();
  check(link.startsWith('file://') && !link.startsWith('null'), 'หน้าแชร์เตือนว่าลิงก์ใช้ได้เฉพาะเครื่องนี้ และลิงก์ไม่ขึ้นต้นด้วย null');
} catch (e) {
  failed = true;
  console.log(' FAIL ' + e.message.split('\n')[0]);
}
check(errors.length === 0, 'ไม่มี error ในคอนโซล' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(failed ? '✗ portable' : '✓ portable');
process.exit(failed ? 1 : 0);
