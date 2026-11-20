import { strict as assert } from 'node:assert';
import { onboard, remaining } from '../helpers.mjs';

export default async function ({ page, shot, BASE }) {
  // จำลองเวลา 10:00 เพื่อให้ผลทดสอบแน่นอน
  await page.clock.install({ time: new Date('2026-10-24T10:00:00+07:00') });
  await onboard(page, BASE);

  await page.goto(BASE + '#/schedules');
  await page.getByText('ยังไม่มีรายการตั้งเวลา').waitFor();
  await shot('20-schedules-empty');
  await page.getByRole('button', { name: 'เพิ่มรายการตั้งเวลา' }).first().click();

  // ยังไม่ใส่อาหาร → ต้อง validate
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  assert(await page.getByText('เพิ่มอาหารอย่างน้อย 1 รายการ').isVisible());

  await page.getByRole('button', { name: 'เช้า', exact: false }).first().click();
  await page.getByLabel('เวลา').fill('08:00');
  await page.getByRole('button', { name: /เพิ่มอาหาร/ }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('กาแฟดำ');
  await page.getByRole('button', { name: 'เลือก กาแฟดำ' }).click();
  await page.getByRole('button', { name: /เพิ่ม 1 รายการ/ }).click();
  await shot('21-schedule-editor');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();

  await page.getByText('กาแฟดำ').first().waitFor();
  await shot('22-schedules-list');

  // สร้างหลังเวลา 08:00 ของวันนี้ → ต้องไม่บันทึกย้อนหลังให้ทันที
  await page.goto(BASE);
  await page.getByText('คำแนะนำวันนี้').waitFor();
  assert.equal(await remaining(page), '1,760');

  // เลื่อนเวลาไปวันถัดไป 09:00 แล้วกลับมาที่แอป → ต้องบันทึกให้เอง
  await page.clock.setFixedTime(new Date('2026-10-25T09:00:00+07:00'));
  await page.reload();
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await page.waitForTimeout(500);
  assert.equal(await remaining(page), '1,755', 'กาแฟดำ 5 kcal ควรถูกบันทึกอัตโนมัติ');
  assert(await page.getByText('อัตโนมัติ').first().isVisible());
  await shot('23-home-auto-logged');
}
