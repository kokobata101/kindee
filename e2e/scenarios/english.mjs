import { strict as assert } from 'node:assert';

// เบราว์เซอร์ภาษาอังกฤษ → แอปต้องแสดงเป็นอังกฤษ ชื่ออาหารเป็นชื่ออังกฤษ สลับกลับไทยได้ และจำภาษาที่เลือก
export const options = { locale: 'en-US' };

export default async function ({ page, shot, BASE }) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Get started' }).first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  await shot('80-en-welcome');
  await page.getByRole('button', { name: 'Get started' }).first().click();

  await page.getByLabel('Nickname (optional)').fill('Lemon');
  await page.getByLabel('Age').fill('28');
  await page.getByLabel('Height').fill('172');
  await page.getByLabel('Current weight').fill('74');
  await page.getByRole('radio', { name: /Light walking/ }).click();
  await shot('81-en-setup');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Target weight').fill('70');
  await page.getByRole('button', { name: 'Next' }).click();
  await shot('82-en-plan');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByText("Today's tip").waitFor();
  await shot('83-en-home');

  // ค้นหาด้วยชื่ออังกฤษ ได้ชื่ออังกฤษและหน่วยอังกฤษ (พหูพจน์ตามจำนวน)
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.getByLabel('Search food').fill('chicken rice');
  await page.getByRole('button', { name: 'Select Chicken rice' }).click();
  await shot('84-en-picker');
  await page.getByRole('button', { name: /^Add to / }).click();
  await page.getByText("Today's tip").waitFor();
  await page.getByText('Chicken rice').first().waitFor();
  await page.getByRole('button', { name: 'Diary' }).click();
  await page.getByText('Chicken rice').first().waitFor();
  const body = await page.locator('main').innerText();
  assert(/1 plate/.test(body), 'หน่วยอังกฤษ: ' + body.slice(0, 300));
  assert(!/[฀-๿]/.test(body), 'ไม่ควรมีตัวอักษรไทยหลงเหลือในหน้าไดอารี่: ' + body.match(/.{0,20}[฀-๿]+.{0,20}/)?.[0]);
  await shot('85-en-diary');

  // หน้าอื่น ๆ ต้องไม่มีไทยหลงเหลือ
  for (const [hash, label] of [['#/stats', 'stats'], ['#/water', 'water'], ['#/weight', 'weight'], ['#/activity', 'activity'], ['#/goals', 'goals'], ['#/schedules', 'schedules'], ['#/share', 'share'], ['#/rewards', 'rewards'], ['#/about', 'about'], ['#/settings', 'settings'], ['#/add?mode=quick', 'quick'], ['#/add?mode=combos', 'combos'], ['#/scan', 'scan'], ['#/me', 'me']]) {
    await page.goto(BASE + hash);
    await page.waitForTimeout(500);
    const text = await page.locator('body').innerText();
    const left = text.match(/.{0,25}[฀-๿]+.{0,25}/g);
    // ภาษาในสวิตช์ ("ไทย") เป็นชื่อภาษาของตัวเอง จึงยอมให้มี
    const real = (left ?? []).filter((x) => !/^\s*(ภาษา|ไทย)/.test(x) && !/Language|ไทย/.test(x));
    assert.equal(real.length, 0, `${label}: ไทยหลงเหลือ → ${real.slice(0, 3).join(' | ')}`);
    await shot(`86-en-${label}`);
  }

  // สลับภาษาในตั้งค่า → ไทย และจำค่าไว้หลังโหลดซ้ำ
  await page.goto(BASE + '#/settings');
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await page.getByText('หน้าตาแอป').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'th');
  await page.reload();
  await page.getByText('หน้าตาแอป').waitFor();
  await page.goto(BASE + '#/diary');
  await page.getByText('ข้าวมันไก่').first().waitFor(); // ข้อมูลเดิมยังอยู่ และแสดงชื่อไทย
  await shot('87-th-after-switch');
  await page.goto(BASE + '#/settings');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByText('App appearance').waitFor();
}
