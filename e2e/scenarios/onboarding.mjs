import { strict as assert } from 'node:assert';

export default async function ({ page, shot, BASE }) {
  await page.goto(BASE);
  await page.getByText('นับแคลอรี่ง่ายๆ').waitFor();
  await shot('01-welcome');

  await page.getByRole('button', { name: 'เริ่มต้นใช้งาน' }).click();
  await page.getByText('เล่าเกี่ยวกับตัวคุณ').waitFor();
  await shot('02-setup-1-empty');

  // กดถัดไปโดยไม่กรอก → ต้องมี error และไม่ไปต่อ
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  assert(await page.getByText('ใส่อายุ 15–100 ปี').isVisible(), 'ควรขึ้น error อายุ');
  await shot('03-setup-1-errors');

  await page.getByLabel('ชื่อเล่น (ไม่บังคับ)').fill('มะนาว');
  await page.getByLabel('อายุ').fill('28');
  await page.getByLabel('ส่วนสูง').fill('172');
  await page.getByLabel('น้ำหนักปัจจุบัน').fill('74');
  await page.getByRole('radio', { name: /เดินบ้างเล็กน้อย/ }).click();
  await shot('04-setup-1-filled');
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await page.getByText('เป้าหมายของคุณ').waitFor();
  // ลดน้ำหนัก แต่ยังไม่ใส่เป้า → error
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  assert(await page.getByText('ใส่น้ำหนักเป้าหมาย').isVisible());
  // เป้าสูงกว่าปัจจุบัน → error ทิศทาง
  await page.getByLabel('น้ำหนักเป้าหมาย').fill('80');
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  assert(await page.getByText('ต้องน้อยกว่าน้ำหนักปัจจุบัน').isVisible());
  await page.getByLabel('น้ำหนักเป้าหมาย').fill('70');
  await shot('05-setup-2');
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await page.getByText('แผนของคุณ').waitFor();
  // ชาย 74/172/28 เดินเล็กน้อย ลด 0.5 → 1,760 kcal (ตรงดีไซน์)
  assert(await page.getByLabel('เป้าหมายแคลอรี่ต่อวัน').innerText().then((t) => t.includes('1,760')), 'ควรได้ 1,760 kcal');
  await shot('06-setup-3');
  await page.getByRole('button', { name: 'เริ่มใช้งาน' }).click();

  await page.getByText('คำแนะนำวันนี้').waitFor();
  assert.equal((await page.getByTestId('remaining').innerText()).trim(), '1,760');
  await shot('07-home-empty');

  // รีโหลด → โปรไฟล์ยังอยู่ (เก็บใน IndexedDB) ไม่เด้งกลับ welcome
  await page.reload();
  await page.getByText('คำแนะนำวันนี้').waitFor();
}
