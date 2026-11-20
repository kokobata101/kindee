import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { expectRemaining, expectTestId, onboard } from '../helpers.mjs';

const SHOTS = new URL('../shots/', import.meta.url).pathname;

export default async function ({ page, shot, BASE }) {
  await onboard(page, BASE); // 74 กก. → 1,760 kcal
  await expectRemaining(page, 1760);

  // ───────── ฉัน ─────────
  await page.getByRole('link', { name: 'ฉัน' }).click();
  await expectTestId(page, 'me-name', 'มะนาว');
  await shot('50-me');
  await page.getByRole('button', { name: /เป้าหมายและแผนของฉัน/ }).click();

  // ───────── เป้าหมาย ─────────
  await expectTestId(page, 'plan-kcal', '1,760');
  await shot('51-goals');
  // ระดับกิจกรรมสูงขึ้น: BMR 1680 × 1.55 − 550 = 2,054 → ปัด 2,050
  await page.getByRole('radio', { name: /ออกกำลังกาย 3–5 วัน/ }).click();
  await expectTestId(page, 'plan-kcal', '2,050');
  // รักษาน้ำหนัก: TDEE 2,604 → 2,600
  await page.getByRole('radio', { name: /รักษาน้ำหนัก/ }).click();
  await expectTestId(page, 'plan-kcal', '2,600');
  await page.getByRole('radio', { name: /ลดน้ำหนัก/ }).click();
  // เป้าหมายลดน้ำหนักแต่ใส่สูงกว่าปัจจุบัน → error และบันทึกไม่ได้
  await page.getByRole('textbox', { name: 'น้ำหนักเป้าหมาย' }).fill('80');
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย' }).click();
  await page.getByText('เป้าหมายลดน้ำหนักต้องน้อยกว่าน้ำหนักปัจจุบัน').waitFor();
  await page.getByRole('textbox', { name: 'น้ำหนักเป้าหมาย' }).fill('70');

  // ตั้งแคลอรี่เอง: นอกช่วง = error, ต่ำกว่าขั้นต่ำ = เตือน, ถูกต้อง = ใช้ค่านั้น
  await page.getByRole('switch', { name: 'ตั้งแคลอรี่เป้าหมายเอง' }).click();
  await page.getByRole('textbox', { name: 'แคลอรี่ต่อวัน' }).fill('100');
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย' }).click();
  await page.getByText('ใส่ 800–6,000 kcal').waitFor();
  await page.getByRole('textbox', { name: 'แคลอรี่ต่อวัน' }).fill('1400');
  await page.getByText('ต่ำกว่าขั้นต่ำที่ปลอดภัย').waitFor();
  await page.getByRole('textbox', { name: 'แคลอรี่ต่อวัน' }).fill('2000');
  await expectTestId(page, 'plan-kcal', '2,000');
  await page.getByRole('textbox', { name: 'ชื่อเล่น' }).fill('มะนาวหวาน');
  await shot('52-goals-manual');
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย' }).click();
  await expectTestId(page, 'me-name', 'มะนาวหวาน');
  await page.getByRole('link', { name: 'หน้าหลัก' }).click();
  await expectRemaining(page, 2000);

  // ค่าที่ตั้งเองต้องไม่ถูกทับเมื่อบันทึกน้ำหนักใหม่ แต่เป้าน้ำ (ไม่ได้ตั้งเอง) คำนวณใหม่: 73 × 35 = 2,555 → 2,550
  await page.goto(BASE + '#/weight');
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก' }).first().click();
  await page.getByRole('textbox', { name: 'น้ำหนัก', exact: true }).fill('73');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expectTestId(page, 'weight-now', '73.0');
  await page.goto(BASE);
  await expectRemaining(page, 2000);
  await page.goto(BASE + '#/water');
  await page.getByText('เป้าหมาย 2,550 มล.').waitFor();

  // เพิ่มอาหาร 1 รายการเพื่อให้ข้อมูลสำรองมีของจริง
  await page.goto(BASE);
  await page.getByRole('button', { name: 'เพิ่มอาหาร', exact: true }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ข้าวมันไก่');
  await page.getByRole('button', { name: 'เลือก ข้าวมันไก่' }).click();
  await page.getByRole('button', { name: /^เพิ่มลง/ }).click();
  await expectRemaining(page, 2000 - 585);

  // ───────── ตั้งค่า ─────────
  await page.goto(BASE + '#/settings');
  await page.getByRole('button', { name: 'มืด', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await shot('53-settings-dark');
  await page.getByRole('button', { name: 'สว่าง', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');

  // สำรองข้อมูล → ได้ไฟล์ JSON ที่ถูกต้อง
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^สำรองข้อมูล/ }).click(),
  ]);
  const backupPath = `${SHOTS}backup.json`;
  await dl.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  assert.equal(backup.app, 'kindee');
  assert.equal(backup.data.profile[0].name, 'มะนาวหวาน');
  assert.equal(backup.data.profile[0].kcalGoal, 2000);
  assert.equal(backup.data.entries.length, 1);
  assert.equal(backup.data.entries[0].kcal, 585);
  assert.equal(backup.data.weights.length, 1);
  assert(dl.suggestedFilename().startsWith('kindee-backup-'), dl.suggestedFilename());

  // ไฟล์ที่ไม่ใช่ไฟล์สำรอง → ปฏิเสธ และข้อมูลเดิมไม่เปลี่ยน
  await page.getByTestId('restore-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await page.getByRole('button', { name: 'กู้คืน', exact: true }).click();
  await page.getByText('นี่ไม่ใช่ไฟล์สำรองของกินดี').waitFor();
  await page.getByTestId('restore-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await page.getByRole('button', { name: 'กู้คืน', exact: true }).click();
  await page.getByText('ไฟล์ไม่ใช่รูปแบบ JSON ที่ถูกต้อง').waitFor();
  await page.goto(BASE);
  await expectRemaining(page, 2000 - 585);

  // ลบข้อมูลทั้งหมด → กลับหน้าต้อนรับ ไม่เหลืออะไร
  await page.goto(BASE + '#/settings');
  await page.getByRole('button', { name: /^ลบข้อมูลทั้งหมด/ }).click();
  await page.getByRole('button', { name: 'ลบทั้งหมด' }).click();
  await page.getByText('นับแคลอรี่ง่ายๆ').waitFor();
  await shot('54-after-reset');

  // กู้คืนจากไฟล์สำรองที่โหลดไว้ → ข้อมูลกลับมาครบ
  await page.getByLabel('เลือกไฟล์สำรอง').setInputFiles(backupPath);
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 2000 - 585);
  await page.getByRole('link', { name: 'ฉัน' }).click();
  await expectTestId(page, 'me-name', 'มะนาวหวาน');
  await page.getByRole('button', { name: /^เกี่ยวกับกินดี/ }).click();
  await page.getByText('GNU GPL v3').waitFor();
  await shot('55-about');
}
