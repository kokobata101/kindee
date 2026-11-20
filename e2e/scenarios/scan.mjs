import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { expectRemaining, expectTestId, onboard } from '../helpers.mjs';

const VIDEO = fileURLToPath(new URL('../fixtures/barcode.y4m', import.meta.url));
const CODE = '8851001122336'; // ตรงกับภาพบาร์โค้ดในวิดีโอ (สร้างด้วย e2e/make-barcode-video.mjs 885100112233)

// กล้องจำลอง: Chromium ป้อนวิดีโอบาร์โค้ดให้ getUserMedia เหมือนกล้องจริงที่ส่องไปที่สินค้า
export const options = {
  launchArgs: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${VIDEO}`],
  permissions: ['camera'],
};

// เครือข่ายล่ม/404 ที่จำลองขึ้นตั้งใจ ทำให้เบราว์เซอร์พิมพ์ข้อความนี้ใน console (แอปจัดการแล้ว)
export const ignoreConsole = [/Failed to load resource/];

// คำตอบจำลองตามโครงสร้างที่เอกสาร Open Food Facts v2 ระบุ (ไม่ได้เรียกเซิร์ฟเวอร์จริง)
const OFF_PRODUCT = {
  code: CODE,
  status: 1,
  status_verbose: 'product found',
  product: {
    product_name: 'Test Chocolate Bar',
    product_name_th: 'ช็อกโกแลตบาร์ทดสอบ',
    brands: 'KinDee Test',
    serving_size: '30 g',
    serving_quantity: 30,
    nutriments: { 'energy-kcal_100g': 500, proteins_100g: 6, carbohydrates_100g: 60, fat_100g: 26 },
  },
};

export default async function ({ page, shot, BASE }) {
  const calls = [];
  let mode = 'found';
  await page.route('https://world.openfoodfacts.org/api/v2/product/**', async (route) => {
    const code = route.request().url().split('/product/')[1].split('?')[0];
    calls.push(code);
    const cors = { 'access-control-allow-origin': '*' };
    if (mode === 'down') return route.abort('failed');
    if (code === CODE) return route.fulfill({ status: 200, headers: cors, json: OFF_PRODUCT });
    return route.fulfill({ status: 404, headers: cors, json: { code, status: 0, status_verbose: 'product not found' } });
  });

  await onboard(page, BASE); // เป้า 1,760 kcal
  await expectRemaining(page, 1760);

  // ───────── สแกนด้วยกล้อง → พบสินค้า ─────────
  await page.getByRole('button', { name: 'สแกน', exact: true }).click();
  await page.getByTestId('scan-result').waitFor({ timeout: 20000 }); // ZXing อ่านภาพจากกล้องจำลอง
  await expectTestId(page, 'scan-name', 'ช็อกโกแลตบาร์ทดสอบ');
  assert.deepEqual(calls, [CODE], 'ต้องเรียก Open Food Facts ด้วยเลขที่สแกนได้');
  await expectTestId(page, 'scan-kcal', '150 kcal'); // 500 kcal/100g × 30 g
  await shot('80-scan-result');
  await page.getByRole('button', { name: 'เพิ่มจำนวน' }).click(); // 1 → 1.5 หน่วย
  await expectTestId(page, 'scan-kcal', '225 kcal');
  await page.getByRole('radio', { name: /ของว่าง/ }).click();
  await page.getByRole('button', { name: 'เพิ่มลงของว่าง' }).click();
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 1760 - 225);
  assert(await page.getByText('ช็อกโกแลตบาร์ทดสอบ').first().isVisible(), 'ต้องเห็นรายการในมื้อของว่าง');

  // ───────── สแกนซ้ำ: ใช้ข้อมูลในเครื่อง ไม่เรียกเซิร์ฟเวอร์ (ใช้ได้ตอนออฟไลน์) ─────────
  mode = 'down';
  await page.getByRole('button', { name: 'สแกน', exact: true }).click();
  await page.getByTestId('scan-result').waitFor({ timeout: 20000 });
  await page.getByText('จากเครื่องของคุณ', { exact: false }).waitFor();
  assert.equal(calls.length, 1, 'สินค้าที่เคยสแกนต้องไม่เรียกเซิร์ฟเวอร์ซ้ำ');
  await page.getByRole('button', { name: 'ย้อนกลับ' }).click();

  // ───────── พิมพ์เลขเอง: ผิด / ไม่พบ / ออฟไลน์ / สร้างเอง ─────────
  await page.getByRole('button', { name: 'สแกน', exact: true }).click();
  await page.getByLabel('หรือพิมพ์เลขบาร์โค้ด').fill('1234567890123'); // check digit ผิด
  await page.getByRole('button', { name: 'ค้นหาสินค้า' }).click();
  await page.getByText('เลขบาร์โค้ดไม่ถูกต้อง').waitFor();

  mode = 'down'; // เครือข่ายล่ม
  await page.getByLabel('หรือพิมพ์เลขบาร์โค้ด').fill('4006381333931');
  await page.getByRole('button', { name: 'ค้นหาสินค้า' }).click();
  await page.getByText('เชื่อมต่ออินเทอร์เน็ตไม่ได้').waitFor();
  await shot('81-scan-offline');
  await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();

  mode = 'found'; // เครือข่ายกลับมา แต่สินค้านี้ไม่อยู่ในฐานข้อมูล
  await page.getByLabel('หรือพิมพ์เลขบาร์โค้ด').fill('4006381333931');
  await page.getByRole('button', { name: 'ค้นหาสินค้า' }).click();
  await page.getByText('ไม่พบสินค้านี้ในฐานข้อมูล').waitFor();
  await page.getByRole('button', { name: 'สร้างเป็นอาหารของฉัน' }).click();
  await page.getByText('บาร์โค้ด 4006381333931').waitFor();
  await page.getByLabel('ชื่ออาหาร').fill('ปากกาไฮไลต์กินไม่ได้');
  await page.getByLabel('น้ำหนักต่อหน่วย').fill('10');
  await page.getByLabel('แคลอรี่').fill('0');
  await page.getByRole('button', { name: 'บันทึกอาหาร' }).click();
  await page.getByLabel('หรือพิมพ์เลขบาร์โค้ด').waitFor();

  // อาหารที่สร้างเองพร้อมบาร์โค้ด → ครั้งหน้าพิมพ์/สแกนเลขนี้แล้วเจอจากเครื่อง
  mode = 'down';
  await page.getByLabel('หรือพิมพ์เลขบาร์โค้ด').fill('4006381333931');
  await page.getByRole('button', { name: 'ค้นหาสินค้า' }).click();
  await expectTestId(page, 'scan-name', 'ปากกาไฮไลต์กินไม่ได้');

  // ───────── กล้องใช้ไม่ได้ → ยังพิมพ์เลขเองได้ ─────────
  const ctx2 = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH', serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await p2.goto(BASE + '#/welcome');
  await onboard(p2, BASE);
  await p2.getByRole('button', { name: 'สแกน', exact: true }).click();
  await p2.getByText('เปิดกล้องไม่ได้').waitFor();
  assert(await p2.getByText('ยังไม่ได้อนุญาตให้ใช้กล้อง', { exact: false }).isVisible());
  assert(await p2.getByLabel('หรือพิมพ์เลขบาร์โค้ด').isVisible(), 'ต้องมีทางเลือกพิมพ์เลขเอง');
  await p2.screenshot({ path: new URL('../shots/82-scan-denied.png', import.meta.url).pathname, fullPage: true });
  await ctx2.close();
}
