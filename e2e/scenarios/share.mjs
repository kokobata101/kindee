import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { restoreSeed } from '../seed.mjs';
import { expectTestId } from '../helpers.mjs';

const SHOTS = new URL('../shots/', import.meta.url).pathname;

export default async function ({ page, shot, BASE }) {
  await restoreSeed(page, BASE);
  await page.getByRole('link', { name: 'ฉัน' }).click();
  await page.getByRole('button', { name: /^แชร์ให้โค้ช/ }).click();
  await page.getByText('ตัวอย่างรายงาน').waitFor();

  // 7 วันล่าสุด: บันทึก 6 วัน (ย้อนหลัง 1–6) เฉลี่ย (1750+1800+2200+1700+1850+1650)/6 = 1,825
  await expectTestId(page, 'r-days', '6/7');
  await expectTestId(page, 'r-avg', '1,825');
  await shot('60-share');

  // 14 วัน: บันทึก 13 วัน เฉลี่ย 23,550/13 = 1,812
  await page.getByRole('radio', { name: '14 วันล่าสุด' }).click();
  await expectTestId(page, 'r-days', '13/14');
  await expectTestId(page, 'r-avg', '1,812');
  await page.getByRole('radio', { name: '7 วันล่าสุด' }).click();
  await expectTestId(page, 'r-days', '6/7');

  // ซ่อนชื่อ
  await page.getByRole('switch', { name: 'แสดงชื่อเล่นในรายงาน' }).click();
  assert(!(await page.getByTestId('report').innerText()).includes('มะนาว'), 'ปิดแสดงชื่อแล้วต้องไม่เห็นชื่อ');
  await page.getByRole('switch', { name: 'แสดงชื่อเล่นในรายงาน' }).click();
  assert((await page.getByTestId('report').innerText()).includes('มะนาว'));

  // CSV อาหาร: มี BOM, หัวตารางไทย, 6 วัน × 3 มื้อ = 18 แถว
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV อาหาร/ }).click()]);
  await dl.saveAs(`${SHOTS}foods.csv`);
  const raw = readFileSync(`${SHOTS}foods.csv`);
  assert.equal(raw.subarray(0, 3).toString('hex'), 'efbbbf', 'ต้องมี UTF-8 BOM ให้ Excel อ่านไทยได้');
  const lines = raw.toString('utf8').replace(/^﻿/, '').split('\r\n');
  assert(lines[0].startsWith('วันที่,เวลา,มื้อ,รายการ'), lines[0]);
  assert.equal(lines.length, 1 + 18, `จำนวนบรรทัด CSV ${lines.length}`);
  const [dlw] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV น้ำหนัก/ }).click()]);
  assert(/^kindee-weights-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/.test(dlw.suggestedFilename()), 'ชื่อไฟล์: ' + dlw.suggestedFilename());

  // พิมพ์: ในโหมดพิมพ์ต้องซ่อนปุ่ม/เมนู เหลือแต่รายงาน
  await page.emulateMedia({ media: 'print' });
  assert(!(await page.getByRole('button', { name: /พิมพ์ \/ บันทึกเป็น PDF/ }).isVisible()), 'โหมดพิมพ์ต้องซ่อนปุ่ม');
  assert(!(await page.locator('.tabbar').isVisible().catch(() => false)));
  assert(await page.getByTestId('report').isVisible());
  await shot('61-share-print');
  await page.emulateMedia({ media: 'screen' });

  // ลิงก์/QR: รหัสผ่านสั้นเกินไป = ปฏิเสธ
  await page.getByLabel('รหัสผ่านป้องกัน (ไม่บังคับ)').fill('ab');
  await page.getByRole('button', { name: 'สร้างลิงก์และ QR' }).click();
  await page.getByText('รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร').waitFor();
  // ไม่ใส่รหัสผ่าน → ลิงก์เปิดได้ทันที
  await page.getByLabel('รหัสผ่านป้องกัน (ไม่บังคับ)').fill('');
  await page.getByRole('button', { name: 'สร้างลิงก์และ QR' }).click();
  await page.getByTestId('share-result').waitFor();
  assert(await page.getByRole('img', { name: 'QR code รายงาน' }).locator('svg').isVisible(), 'ต้องมี QR');
  await shot('62-share-qr');
  const openUrl = (await page.getByTestId('share-url').innerText()).trim();
  assert(openUrl.includes('#/report?d='), openUrl);

  // ผู้รับ = เบราว์เซอร์ใหม่ที่ไม่มีข้อมูลในแอปเลย
  const browser = page.context().browser();
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  const guest = await guestCtx.newPage();
  await guest.goto(openUrl);
  await expectTestId(guest, 'r-days', '6/7');
  await expectTestId(guest, 'r-avg', '1,825');
  assert(await guest.getByText('รายงานแบบอ่านอย่างเดียว').isVisible());
  await guest.screenshot({ path: `${SHOTS}63-guest-report.png`, fullPage: true });

  // ลิงก์ถูกตัด → แจ้งผิดพลาดอย่างเข้าใจง่าย ไม่พังเงียบ
  await guest.goto(openUrl.slice(0, openUrl.length - 40));
  await guest.reload();
  await guest.getByRole('alert').waitFor();

  // ลิงก์ที่ป้องกันด้วยรหัสผ่าน (ช่วง 30 วัน → QR ยังต้องพอดี)
  await page.getByRole('radio', { name: '30 วันล่าสุด' }).click();
  await page.getByLabel('รหัสผ่านป้องกัน (ไม่บังคับ)').fill('ผักบุ้ง-1234');
  await page.getByRole('button', { name: 'สร้างลิงก์และ QR' }).click();
  await page.getByTestId('share-result').waitFor();
  assert(await page.getByRole('img', { name: 'QR code รายงาน' }).locator('svg').isVisible(), 'QR 30 วันพร้อมรหัสผ่านต้องสร้างได้');
  const lockedUrl = (await page.getByTestId('share-url').innerText()).trim();
  assert(!lockedUrl.includes('%E0') && !lockedUrl.includes('มะนาว'), 'ลิงก์ที่เข้ารหัสต้องไม่เปิดเผยเนื้อหา');
  await shot('64-share-locked');

  const guest2 = await guestCtx.newPage();
  await guest2.goto(lockedUrl);
  await guest2.getByText('รายงานนี้ป้องกันด้วยรหัสผ่าน').waitFor();
  assert((await guest2.getByTestId('report').count()) === 0, 'ยังไม่ใส่รหัสผ่านต้องไม่เห็นรายงาน');
  await guest2.getByLabel('รหัสผ่าน', { exact: true }).fill('ผิด');
  await guest2.getByRole('button', { name: 'เปิดรายงาน' }).click();
  await guest2.getByText('รหัสผ่านไม่ถูกต้อง').waitFor();
  assert((await guest2.getByTestId('report').count()) === 0, 'รหัสผิดต้องไม่เห็นรายงาน');
  await guest2.getByLabel('รหัสผ่าน', { exact: true }).fill('ผักบุ้ง-1234');
  await guest2.getByRole('button', { name: 'เปิดรายงาน' }).click();
  await expectTestId(guest2, 'r-days', '14/30'); // ข้อมูลจำลองมี 14 วัน อยู่ในช่วง 30 วันทั้งหมด
  await guest2.screenshot({ path: `${SHOTS}65-guest-unlocked.png`, fullPage: true });
  await guestCtx.close();
}
