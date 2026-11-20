import { strict as assert } from 'node:assert';
import { expectRemaining, expectTestId, onboard } from '../helpers.mjs';

const isoDaysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
};

export default async function ({ page, shot, BASE }) {
  await onboard(page, BASE); // 74 กก. → เป้า 1,760 kcal, น้ำ 2.6 ลิตร
  await expectRemaining(page, 1760);

  // ───────── กิจกรรม ─────────
  await page.getByRole('button', { name: 'กิจกรรม', exact: true }).first().click();
  await page.getByText('เพิ่มกิจกรรม').waitFor();
  await expectTestId(page, 'estimate', '≈ 141 kcal'); // เดินเร็ว ปานกลาง MET 3.8 × 74 × 0.5 ชม.
  await shot('30-activity-default');
  await page.getByRole('radio', { name: /วิ่ง/ }).click();
  await page.getByRole('button', { name: 'หนัก', exact: true }).click();
  await page.getByRole('button', { name: '60 นาที', exact: true }).click();
  await expectTestId(page, 'estimate', '≈ 851 kcal'); // 11.5 × 74 × 1 ชม.
  await page.getByRole('button', { name: 'บันทึกกิจกรรม' }).click();
  await page.getByText('60 นาที · หนัก').waitFor();
  assert(await page.getByText('+851').isVisible(), 'ต้องเห็น +851 kcal ในรายการ');
  await shot('31-activity-logged');

  await page.getByRole('button', { name: 'ย้อนกลับ' }).click();
  await expectRemaining(page, 1760 + 851); // เผาผลาญเพิ่มโควตา
  assert(await page.getByText('เผาผลาญ 851 kcal').isVisible());

  // ลบกิจกรรม
  await page.getByRole('button', { name: 'กิจกรรม', exact: true }).first().click();
  await page.getByRole('button', { name: 'ลบกิจกรรม วิ่ง' }).click();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();
  await page.getByText('ยังไม่ได้บันทึกกิจกรรม').waitFor();
  await page.getByRole('button', { name: 'ย้อนกลับ' }).click();
  await expectRemaining(page, 1760);

  // ───────── น้ำดื่ม ─────────
  await page.getByRole('button', { name: '+ น้ำ 250' }).click(); // ปุ่มด่วนบนหน้าหลัก
  await page.getByRole('button', { name: /น้ำดื่ม/ }).first().click();
  await page.getByText('เพิ่มด่วน').waitFor();
  await expectTestId(page, 'water-liters', '0.3'); // 250 มล. → 0.25 ปัดเป็น 0.3 ที่ทศนิยม 1 ตำแหน่ง
  await page.getByRole('button', { name: 'เพิ่มน้ำ 250 มิลลิลิตร' }).click();
  await expectTestId(page, 'water-liters', '0.5');
  // กำหนดเอง: ว่าง/เกินช่วง = error, ถูกต้อง = บันทึก
  await page.getByRole('button', { name: 'กำหนดปริมาณเอง' }).click();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  assert(await page.getByText('ใส่ปริมาณ 1–5,000 มล.').isVisible(), 'ต้อง validate ปริมาณน้ำ');
  await page.getByRole('textbox', { name: 'ปริมาณ', exact: true }).fill('300');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expectTestId(page, 'water-liters', '0.8');
  assert(await page.getByText('วันนี้ · 3 ครั้ง').isVisible());
  await shot('32-water');
  // ลบ 1 ครั้ง (300 มล.)
  await page.getByRole('button', { name: /ลบน้ำ 300 มล./ }).click();
  await expectTestId(page, 'water-liters', '0.5');
  await page.getByRole('button', { name: 'เพิ่มน้ำ 500 มิลลิลิตร' }).click();
  await page.getByRole('button', { name: 'เพิ่มน้ำ 500 มิลลิลิตร' }).click();
  await page.getByRole('button', { name: 'เพิ่มน้ำ 500 มิลลิลิตร' }).click();
  await page.getByRole('button', { name: 'เพิ่มน้ำ 500 มิลลิลิตร' }).click();
  await page.getByRole('button', { name: 'เพิ่มน้ำ 500 มิลลิลิตร' }).click();
  await expectTestId(page, 'water-liters', '3'); // 3,000 มล. ≥ เป้า 2,600
  await page.getByText('ครบเป้าแล้ว 🎉').first().waitFor();
  await shot('33-water-done');

  // ───────── น้ำหนัก ─────────
  await page.goto(BASE + '#/weight');
  await expectTestId(page, 'weight-now', '74.0');
  await shot('34-weight-initial');

  // ใส่ค่านอกช่วง → error
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก' }).first().click();
  await page.getByRole('textbox', { name: 'น้ำหนัก', exact: true }).fill('500');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  assert(await page.getByText('ใส่น้ำหนัก 30–250 กก.').isVisible(), 'ต้อง validate น้ำหนัก');

  // น้ำหนักวันนี้ใหม่ = ทับของเดิม + เป้าแคลอรี่ปรับอัตโนมัติ (BMR 1665 × 1.375 − 550 → 1,740)
  await page.getByRole('textbox', { name: 'น้ำหนัก', exact: true }).fill('72.5');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expectTestId(page, 'weight-now', '72.5');
  await page.getByText('อัปเดตน้ำหนักของวันนั้นแล้ว').waitFor();

  // ย้อนหลัง 5 วัน
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก' }).first().click();
  await page.getByRole('textbox', { name: 'น้ำหนัก', exact: true }).fill('75');
  await page.getByLabel('วันที่', { exact: true }).fill(isoDaysAgo(5));
  await page.getByLabel('หมายเหตุ (ไม่บังคับ)').fill('หลังตื่นนอน');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByText('หลังตื่นนอน').waitFor();
  await expectTestId(page, 'weight-now', '72.5'); // ล่าสุดยังเป็นของวันนี้
  assert(await page.locator('svg[aria-label^="กราฟน้ำหนัก"]').isVisible(), 'ต้องมีกราฟน้ำหนัก');
  await shot('35-weight-logged');
  // ช่วงเวลา
  await page.getByRole('button', { name: '6 เดือน' }).click();
  await page.getByRole('button', { name: 'ทั้งหมด' }).click();

  // เป้าแคลอรี่บนหน้าหลักถูกปรับตามน้ำหนักใหม่
  await page.goto(BASE);
  await expectRemaining(page, 1740);
  // ลบบันทึกย้อนหลัง
  await page.goto(BASE + '#/weight');
  await page.getByRole('button', { name: `ลบน้ำหนักวันที่ ${isoDaysAgo(5)}` }).click();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();
  await page.getByText('หลังตื่นนอน').waitFor({ state: 'detached' });
  // เหลือรายการเดียว → ลบไม่ได้
  assert(await page.getByRole('button', { name: /ลบน้ำหนักวันที่/ }).isDisabled(), 'ต้องไม่ให้ลบน้ำหนักรายการสุดท้าย');
}
