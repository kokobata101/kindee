import { strict as assert } from 'node:assert';
import { bangkokISO, restoreSeed, SEED_DAYS } from '../seed.mjs';
import { expectTestId } from '../helpers.mjs';

// วันจันทร์ของสัปดาห์ปัจจุบัน (ตามเขตเวลาไทย)
const weekStartISO = (iso) => {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
};

export default async function ({ page, shot, BASE }) {
  await restoreSeed(page, BASE);
  const today = bangkokISO();

  // ───────── สถิติ ─────────
  await page.getByRole('link', { name: 'สถิติ' }).click();
  await page.getByText('แคลอรี่เฉลี่ย', { exact: false }).first().waitFor();

  // คาดค่าเฉลี่ยสัปดาห์นี้จากข้อมูลจำลอง (เฉพาะวันที่บันทึกและอยู่ในสัปดาห์นี้)
  const ws = weekStartISO(today);
  const inWeek = SEED_DAYS.filter(([off]) => bangkokISO(off) >= ws && bangkokISO(off) <= today);
  const expectWeek = inWeek.length ? String(Math.round(inWeek.reduce((a, d) => a + d[1], 0) / inWeek.length)).replace(/(\d)(?=(\d{3})+$)/g, '$1,') : '–';
  await expectTestId(page, 'avg-kcal', expectWeek);
  await shot('40-stats-week');

  // เดือนนี้: ค่าเฉลี่ยของวันที่บันทึกในเดือนเดียวกัน
  await page.getByRole('button', { name: 'เดือน', exact: true }).click();
  const ym = today.slice(0, 7);
  const inMonth = SEED_DAYS.filter(([off]) => bangkokISO(off).startsWith(ym));
  const expectMonth = inMonth.length ? String(Math.round(inMonth.reduce((a, d) => a + d[1], 0) / inMonth.length)).replace(/(\d)(?=(\d{3})+$)/g, '$1,') : '–';
  await expectTestId(page, 'avg-kcal', expectMonth);
  await page.getByRole('button', { name: 'ปี', exact: true }).click();
  await page.locator('svg[aria-label^="กราฟแคลอรี่"]').waitFor();
  await page.getByRole('button', { name: 'สัปดาห์', exact: true }).click();

  // สัดส่วนสารอาหารรวม 100%
  // (ถ้าวันนี้เป็นวันจันทร์ สัปดาห์นี้ยังไม่มีข้อมูลเลย → ต้องเห็นข้อความว่างแทนกราฟ)
  if (inWeek.length) {
    const share = await page.getByRole('img', { name: /โปรตีน \d+% คาร์บ \d+% ไขมัน \d+%/ }).getAttribute('aria-label');
    const nums = share.match(/\d+/g).map(Number);
    assert.equal(nums.reduce((a, b) => a + b, 0), 100, share);
  } else {
    await page.getByText('บันทึกอาหารเพื่อดูสัดส่วนโปรตีน คาร์บ ไขมัน').waitFor();
  }

  // ข้อมูลเชิงลึกจาก 7 วันที่ผ่านมา (คำนวณจากข้อมูลจริง)
  await page.getByText('โปรตีนต่ำกว่าเป้า 4 จาก 7 วัน').waitFor();
  await page.getByText('กินเกินเป้า 1 วัน').waitFor();
  await page.getByText('ดื่มน้ำถึงเป้า 5 วัน').waitFor();

  // ตารางสตรีค: วันที่ในเป้า 13 วัน เกินเป้า 1 วัน
  assert.equal(await page.locator('.heat .c.ok').count(), 13, 'ช่องเขียว');
  assert.equal(await page.locator('.heat .c.over').count(), 1, 'ช่องส้ม');
  assert.equal(await page.locator('.heat .c.today').count(), 1, 'ช่องวันนี้');
  await shot('41-stats-insights');

  // ───────── รางวัล ─────────
  await page.getByRole('button', { name: /^\s*14 วัน/ }).click(); // ปุ่มสตรีคในหน้าสถิติ
  await page.getByText('เหรียญรางวัล').waitFor();
  await expectTestId(page, 'streak-now', '14'); // 14 วันติดกันถึงเมื่อวาน วันนี้ยังไม่ได้บันทึก = ไม่ตัดสตรีค
  assert(await page.getByText('บันทึกวันนี้เพื่อไม่ให้สตรีคขาด', { exact: false }).isVisible());
  const unlocked = async (key) => (await page.locator(`.badge[aria-label^="${key}"]`).getAttribute('data-unlocked')) === 'true';
  assert(await unlocked('เริ่มต้น'), 'เริ่มต้น');
  assert(await unlocked('ไฟลุก 7 วัน'), 'ไฟลุก 7');
  assert(await unlocked('ไฟลุก 14 วัน'), 'ไฟลุก 14');
  assert(await unlocked('ดื่มน้ำครบ'), 'ดื่มน้ำครบ 5 วัน');
  assert(await unlocked('โปรตีนครบ'), 'โปรตีน 3 วัน');
  assert(await unlocked('ขยับตัว'), 'ขยับตัว 10 ครั้ง');
  assert(!(await unlocked('ถึงเป้าหมาย')), 'ยังไม่ถึงเป้า');
  assert(!(await unlocked('100 วัน')), 'ยังไม่ครบ 100 วัน');
  assert.equal(await page.locator('.badge').count(), 8, 'ไม่แสดงเหรียญสแกนที่ยังไม่มีฟีเจอร์');
  await shot('42-rewards');

  // บันทึกอาหารวันนี้ → สตรีคเป็น 15 และข้อความเปลี่ยน
  await page.goto(BASE);
  await page.getByRole('button', { name: 'เพิ่มอาหาร', exact: true }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ข้าวมันไก่');
  await page.getByRole('button', { name: 'เลือก ข้าวมันไก่' }).click();
  await page.getByRole('button', { name: /^เพิ่มลง/ }).click();
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await page.getByRole('button', { name: /ต่อเนื่อง 15 วัน/ }).click();
  await expectTestId(page, 'streak-now', '15');
  await page.getByText('วันนี้บันทึกแล้ว ✓', { exact: false }).waitFor();
}
