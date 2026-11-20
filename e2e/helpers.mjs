// ขั้นตอนที่ใช้ซ้ำในหลายสถานการณ์ทดสอบ
export async function onboard(page, BASE, { name = 'มะนาว', age = '28', height = '172', weight = '74', target = '70' } = {}) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'เริ่มต้นใช้งาน' }).click();
  await page.getByLabel('ชื่อเล่น (ไม่บังคับ)').fill(name);
  await page.getByLabel('อายุ').fill(age);
  await page.getByLabel('ส่วนสูง').fill(height);
  await page.getByLabel('น้ำหนักปัจจุบัน').fill(weight);
  await page.getByRole('radio', { name: /เดินบ้างเล็กน้อย/ }).click();
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByLabel('น้ำหนักเป้าหมาย').fill(target);
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByRole('button', { name: 'เริ่มใช้งาน' }).click();
  await page.getByText('คำแนะนำวันนี้').waitFor();
}
export const remaining = async (page) => (await page.getByTestId('remaining').innerText()).trim();

const fmt = (n) => String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1,');
/** รอจนค่าแคลอรี่คงเหลือบนหน้าหลักเท่ากับที่คาด (หน้าจออัปเดตแบบอะซิงโครนัส) แล้วคืนค่าจริง */
export async function expectRemaining(page, expected, timeout = 4000) {
  const want = typeof expected === 'number' ? fmt(expected) : expected;
  const t0 = Date.now();
  let got = '';
  while (Date.now() - t0 < timeout) {
    got = await remaining(page);
    if (got === want) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`แคลอรี่คงเหลือคาด ${want} แต่ได้ ${got}`);
}

/** รอจน data-testid มีข้อความตามที่คาด (ใช้กับค่าที่มาจาก live query) */
export async function expectTestId(page, id, expected, timeout = 4000) {
  const want = typeof expected === 'number' ? fmt(expected) : expected;
  const t0 = Date.now();
  let got = '';
  while (Date.now() - t0 < timeout) {
    got = (await page.getByTestId(id).innerText()).trim();
    if (got === want) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${id} คาด ${want} แต่ได้ ${got}`);
}
