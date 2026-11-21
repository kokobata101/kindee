import { strict as assert } from 'node:assert';
import { expectRemaining, onboard } from '../helpers.mjs';

export default async function ({ page, shot, BASE }) {
  await onboard(page, BASE); // เป้า 1,760
  await expectRemaining(page, 1760);

  // ทางเข้าจากหน้าหลัก → เปิดโหมดแคลอรี่ด่วนทันที
  await page.getByRole('button', { name: 'แคลอรี่ด่วน', exact: true }).click();
  const kcal = page.getByRole('textbox', { name: 'แคลอรี่', exact: true });
  await kcal.waitFor();
  assert.equal(await page.getByRole('button', { name: 'แคลอรี่ด่วน', exact: true }).getAttribute('aria-pressed'), 'true'); // ปุ่มสลับโหมด
  await shot('60-quick-empty');

  // ไม่ใส่ค่า → ต้องไม่บันทึก และมีข้อความแจ้ง
  await page.getByRole('button', { name: /^เพิ่มลง/ }).click();
  await page.getByText('ใส่แคลอรี่ 1–5,000 kcal').waitFor();
  await kcal.fill('6000');
  assert(await page.getByText('ใส่แคลอรี่ 1–5,000 kcal').isVisible(), 'เกิน 5,000 ต้องไม่ผ่าน');
  await page.getByRole('button', { name: /^เพิ่มลง/ }).click();
  assert(await page.getByRole('textbox', { name: 'แคลอรี่', exact: true }).isVisible(), 'ยังอยู่หน้าเดิม');

  // ใช้ปุ่มค่าด่วน + ชื่อ + สารอาหาร + มื้อ
  await page.getByRole('button', { name: '400', exact: true }).click();
  await page.waitForFunction((el) => el.value === '400', await kcal.elementHandle()); // ค่าในช่องอัปเดตแบบอะซิงโครนัส
  await page.getByLabel('ชื่อ (ไม่บังคับ)').fill('ข้าวร้านป้า');
  await page.getByRole('button', { name: /ใส่โปรตีน/ }).click();
  await page.getByRole('textbox', { name: 'โปรตีน' }).fill('20');
  await page.getByRole('textbox', { name: 'คาร์บ' }).fill('50');
  await page.getByRole('textbox', { name: 'ไขมัน' }).fill('10');
  await page.getByRole('button', { name: /คำนวณแคลอรี่จากสารอาหาร = 370/ }).waitFor(); // 4×20 + 4×50 + 9×10
  await page.getByRole('button', { name: 'มื้อเย็น', exact: false }).filter({ hasText: '🌙' }).click();
  await shot('61-quick-filled');
  await page.getByRole('button', { name: 'เพิ่มลงมื้อเย็น' }).click();

  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 1760 - 400);
  await page.getByText('ข้าวร้านป้า').first().waitFor();
  await page.getByText('ใส่แคลอรี่เอง').first().waitFor();
  await shot('62-home-quick');

  // แก้ไข: เปลี่ยนแคลอรี่เป็น 350 และเอาชื่อออก (กลับเป็นชื่อเริ่มต้น)
  await page.getByRole('button', { name: 'แก้ไข ข้าวร้านป้า' }).click();
  const editKcal = page.getByRole('textbox', { name: 'แคลอรี่', exact: true });
  assert.equal(await editKcal.inputValue(), '400');
  assert.equal(await page.getByRole('textbox', { name: 'โปรตีน' }).inputValue(), '20');
  await shot('63-quick-edit');
  await editKcal.fill('0');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await page.getByText('ใส่แคลอรี่ 1–5,000 kcal').waitFor(); // แก้เป็น 0 ไม่ได้
  await editKcal.fill('350');
  await page.getByLabel('ชื่อ (ไม่บังคับ)').fill('');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await expectRemaining(page, 1760 - 350);
  await page.getByRole('button', { name: 'แก้ไข แคลอรี่ด่วน' }).waitFor();

  // ใช้งานต่อเนื่อง: ข้ามไปเมื่อวานแล้วกลับมา ข้อมูลยังอยู่หลังรีโหลดหน้า
  await page.reload();
  await expectRemaining(page, 1760 - 350);

  // ลบ
  await page.getByRole('button', { name: 'แก้ไข แคลอรี่ด่วน' }).click();
  await page.getByRole('button', { name: /ลบรายการ/ }).click();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();
  await expectRemaining(page, 1760);
}
