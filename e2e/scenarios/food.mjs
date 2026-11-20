import { strict as assert } from 'node:assert';
import { expectRemaining, expectTestId, onboard, remaining } from '../helpers.mjs';

export default async function ({ page, shot, BASE }) {
  await onboard(page, BASE);
  assert.equal(await remaining(page), '1,760');

  // ── เพิ่มอาหารจากปุ่ม + ตรงกลาง ──
  await page.getByRole('button', { name: 'เพิ่มอาหาร', exact: true }).click();
  await page.getByLabel('ค้นหาอาหาร').waitFor();
  await shot('10-add-initial');

  await page.locator('.chips button', { hasText: 'มื้อกลางวัน' }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ข้าวมันไก่');
  await page.getByRole('button', { name: 'เลือก ข้าวมันไก่' }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ส้มตำ');
  await page.getByRole('button', { name: 'เลือก ส้มตำไทย' }).click();
  // เพิ่มจำนวนส้มตำเป็น 2 จาน → 260 kcal
  await page.getByRole('button', { name: 'เพิ่มจำนวน ส้มตำไทย' }).click();
  await page.getByRole('button', { name: 'เพิ่มจำนวน ส้มตำไทย' }).click();
  await shot('11-add-selected');
  const footer = await page.locator('.footer-bar').innerText();
  assert(footer.includes('เลือกแล้ว 2 รายการ'), footer);
  // ข้าวมันไก่ 585 + ส้มตำ 130×2 = 845
  assert(footer.includes('845 kcal'), 'ยอดรวมควรเป็น 845: ' + footer);
  await page.getByRole('button', { name: 'เพิ่มลงมื้อกลางวัน' }).click();

  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 1760 - 845);
  assert(await page.getByText('ข้าวมันไก่').first().isVisible());
  await shot('12-home-with-food');

  // ── แก้จำนวน/ลบ จากหน้าหลัก ──
  await page.getByRole('button', { name: 'แก้ไข ข้าวมันไก่' }).click();
  await page.getByRole('button', { name: 'เพิ่มจำนวน' }).click(); // 1 → 1.5
  await shot('13-entry-sheet');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  // 585×1.5 = 878 (ปัด) → รวม 878+260 = 1,138 → เหลือ 622
  await expectRemaining(page, 622);
  await page.getByRole('button', { name: 'แก้ไข ส้มตำไทย' }).click();
  await page.getByRole('button', { name: /ลบรายการ/ }).click();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();
  await expectRemaining(page, 1760 - 878);

  // ── อาหารของฉัน ──
  // ทางเข้าสร้างอาหารอยู่ในหน้าเพิ่มอาหาร (บนหน้าหลักช่องนั้นเป็นปุ่มสแกนบาร์โค้ดแล้ว)
  await page.getByRole('button', { name: 'เพิ่มอาหาร', exact: true }).click();
  await page.getByRole('button', { name: /สร้างอาหาร/ }).click();
  await page.getByRole('button', { name: 'บันทึกอาหาร' }).click();
  assert(await page.getByText('ใส่ชื่ออาหาร').isVisible(), 'ต้อง validate ชื่อ');
  await page.getByLabel('ชื่ออาหาร').fill('น้ำพริกแม่บ้าน');
  await page.getByLabel('น้ำหนักต่อหน่วย').fill('20');
  await page.getByLabel('แคลอรี่').fill('60');
  await page.getByLabel('โปรตีน').fill('1');
  await page.getByLabel('คาร์บ').fill('5');
  await page.getByLabel('ไขมัน').fill('4');
  await shot('14-food-form');
  await page.getByRole('button', { name: 'บันทึกอาหาร' }).click();
  // บันทึกแล้วกลับมาหน้าเพิ่มอาหาร เลือกอาหารที่เพิ่งสร้างต่อได้เลย
  await page.getByRole('tab', { name: /ของฉัน/ }).click();
  await page.getByRole('button', { name: 'เลือก น้ำพริกแม่บ้าน' }).click();
  await page.getByRole('button', { name: /เพิ่มลง/ }).click();
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 1760 - 878 - 60);

  // ── ไดอารี่ ──
  await page.getByRole('link', { name: 'ไดอารี่' }).click();
  await page.getByTestId('diary-date').waitFor();
  await expectTestId(page, 'diary-remaining', 1760 - 878 - 60);
  await shot('15-diary');

  // เลื่อนไปเมื่อวาน → ว่าง แล้วคัดลอกจากวันก่อน: ไม่มีข้อมูลใน 7 วัน → แจ้งเตือน
  await page.getByRole('button', { name: 'วันก่อนหน้า' }).click();
  await expectTestId(page, 'diary-remaining', '1,760');
  await page.getByRole('button', { name: /คัดลอกจากวันก่อน/ }).click();
  await page.getByText('ไม่พบวันที่มีบันทึกใน 7 วันก่อนหน้า').waitFor();
  // กลับมาวันนี้ แล้วคัดลอกไปเมื่อวาน (วันนี้เป็นต้นทาง) ผ่านการเลื่อนวันไปข้างหน้าไม่ได้ → ทดสอบคัดลอกไปวันนี้จากเมื่อวานไม่ได้
  await page.getByRole('button', { name: 'วันถัดไป' }).click();
  await page.getByRole('button', { name: /คัดลอกจากวันก่อน/ }).click();
  await page.getByText('ไม่พบวันที่มีบันทึกใน 7 วันก่อนหน้า').waitFor();

  // ผู้ใช้เคยบันทึกวันนี้ → ลองบันทึกย้อนหลังเมื่อวานผ่านหน้า add แล้วคัดลอกกลับ
  await page.getByRole('button', { name: 'วันก่อนหน้า' }).click();
  await page.getByRole('button', { name: 'เพิ่มอาหารมื้อเช้า' }).or(page.getByText('ยังไม่ได้บันทึก · แตะเพื่อเพิ่มมื้อเช้า')).first().click();
  await page.getByText(/บันทึกย้อนหลัง/).waitFor();
  await page.getByLabel('ค้นหาอาหาร').fill('กาแฟดำ');
  await page.getByRole('button', { name: 'เลือก กาแฟดำ' }).click();
  await page.getByRole('button', { name: /เพิ่มลง/ }).click();
  await page.getByTestId('diary-date').waitFor();
  await expectTestId(page, 'diary-remaining', 1760 - 5);
  await page.getByRole('button', { name: 'วันถัดไป' }).click();
  await page.getByRole('button', { name: /คัดลอกจากวันก่อน/ }).click();
  await page.getByRole('button', { name: 'คัดลอก', exact: true }).click();
  await page.getByText('คัดลอก 1 รายการแล้ว').waitFor();
  await expectTestId(page, 'diary-remaining', 1760 - 878 - 60 - 5);
  await shot('16-diary-copied');
}
