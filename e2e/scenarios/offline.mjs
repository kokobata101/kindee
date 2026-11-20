import { strict as assert } from 'node:assert';
import { expectRemaining, onboard } from '../helpers.mjs';

// ต้องเปิด service worker จริงเพื่อทดสอบการใช้งานแบบไม่มีอินเทอร์เน็ต
export const options = { serviceWorkers: 'allow' };

export default async function ({ page, shot, BASE }) {
  const ctx = page.context();
  await page.goto(BASE);
  // รอให้ service worker ติดตั้งและแคชไฟล์แอปครบ
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error('service worker ไม่ active');
  });
  await page.waitForFunction(async () => (await caches.keys()).length > 0);
  await page.reload(); // ให้หน้าถูกควบคุมโดย service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await onboard(page, BASE);
  await expectRemaining(page, 1760);

  // ตัดอินเทอร์เน็ต แล้วเปิดแอปใหม่
  await ctx.setOffline(true);
  await page.reload();
  await page.getByText('คำแนะนำวันนี้').waitFor({ timeout: 10000 });
  await expectRemaining(page, 1760); // ข้อมูลยังอยู่

  // ใช้งานจริงตอนออฟไลน์: เพิ่มอาหาร น้ำ กิจกรรม
  await page.getByRole('button', { name: 'เพิ่มอาหาร', exact: true }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ข้าวมันไก่');
  await page.getByRole('button', { name: 'เลือก ข้าวมันไก่' }).click();
  await page.getByRole('button', { name: /^เพิ่มลง/ }).click();
  await expectRemaining(page, 1760 - 585);
  await page.getByRole('button', { name: '+ น้ำ 250' }).click();
  await page.getByText('เพิ่มน้ำ 250 มล. แล้ว').waitFor();
  await page.getByRole('link', { name: 'สถิติ' }).click();
  await page.getByText('แคลอรี่เฉลี่ย', { exact: false }).first().waitFor();
  await shot('70-offline-stats');

  // เปิดแอปครั้งใหม่ทั้งหมด (ปิดแท็บแล้วเปิดใหม่) ขณะยังออฟไลน์
  const page2 = await ctx.newPage();
  await page2.goto(BASE);
  await page2.getByText('คำแนะนำวันนี้').waitFor({ timeout: 10000 });
  await expectRemaining(page2, 1175); // ค่ามาจาก live query จึงรอจนอัปเดต
  await ctx.setOffline(false);
}
