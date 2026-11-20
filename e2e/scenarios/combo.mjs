import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { expectRemaining, onboard } from '../helpers.mjs';

const SHOTS = new URL('../shots/', import.meta.url).pathname;

export default async function ({ page, shot, BASE }) {
  await onboard(page, BASE); // เป้า 1,760
  await expectRemaining(page, 1760);

  // ── เลือกอาหาร 2 อย่าง แล้วเก็บเป็นชุด ──
  await page.getByRole('button', { name: 'เพิ่มอาหาร', exact: true }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ข้าวมันไก่');
  await page.getByRole('button', { name: 'เลือก ข้าวมันไก่' }).click();
  await page.getByLabel('ค้นหาอาหาร').fill('ส้มตำ');
  await page.getByRole('button', { name: 'เลือก ส้มตำไทย' }).click();
  await shot('70-combo-picked');
  await page.getByRole('button', { name: 'เก็บเป็นมื้อประจำ' }).click();
  const nameInput = page.getByRole('textbox', { name: 'ชื่อมื้อประจำ' });
  assert.equal(await nameInput.inputValue(), 'ข้าวมันไก่ + ส้มตำไทย');
  await shot('71-combo-save-sheet');
  await nameInput.fill('');
  await page.getByRole('button', { name: 'บันทึกมื้อประจำ' }).click();
  await page.getByText('ตั้งชื่อมื้อประจำ').waitFor(); // ชื่อว่างต้องไม่ผ่าน
  await nameInput.fill('กลางวันประจำ');
  await page.getByRole('button', { name: 'บันทึกมื้อประจำ' }).click();
  await page.getByText('เก็บ "กลางวันประจำ" เป็นมื้อประจำแล้ว').waitFor();
  // ยังอยู่หน้าเดิม และรายการที่เลือกไว้ไม่หาย
  assert((await page.locator('.footer-bar').innerText()).includes('เลือกแล้ว 2 รายการ'));

  // ── สลับไปแท็บมื้อประจำ (แท็บค้นหาต้องไม่ถูกล้าง) → เพิ่มลงมื้อเย็นด้วยปุ่ม + ──
  await page.getByRole('button', { name: 'มื้อประจำ', exact: true }).click();
  await page.getByRole('button', { name: 'มื้อเย็น' }).click();
  await page.getByRole('listitem').filter({ hasText: 'กลางวันประจำ' }).waitFor();
  await shot('72-combo-list');
  await page.getByRole('button', { name: 'เพิ่ม กลางวันประจำ ลงมื้อเย็น' }).click();
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 1760 - 715); // 585 + 130
  await page.getByText('ข้าวมันไก่').first().waitFor();
  await page.getByText('ส้มตำไทย').first().waitFor();

  // ── ใช้ครึ่งส่วนผ่านหน้ารายละเอียด ──
  await page.getByRole('button', { name: 'มื้อประจำ', exact: true }).click(); // ทางลัดบนหน้าหลัก
  await page.getByRole('button', { name: 'ดูรายละเอียด กลางวันประจำ' }).click();
  await page.getByRole('button', { name: 'ลดจำนวนส่วน' }).click(); // 1 → 0.5
  const dlg = page.getByRole('dialog');
  await dlg.getByText('358').waitFor(); // 293 + 65
  await shot('73-combo-detail');
  await dlg.locator('.chips button', { hasText: 'มื้อเช้า' }).click();
  await dlg.getByRole('button', { name: 'เพิ่มลงมื้อเช้า' }).click();
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await expectRemaining(page, 1760 - 715 - 358);

  // ── เก็บมื้อในไดอารี่เป็นมื้อประจำ (มื้อเช้ามี 2 รายการ) ──
  await page.getByRole('button', { name: 'เก็บมื้อเช้าเป็นมื้อประจำ' }).click();
  await page.getByRole('textbox', { name: 'ชื่อมื้อประจำ' }).fill('เช้าครึ่งส่วน');
  await page.getByRole('button', { name: 'บันทึกมื้อประจำ' }).click();
  await page.getByText('เก็บ "เช้าครึ่งส่วน" เป็นมื้อประจำแล้ว').waitFor();

  // ── เรียงล่าสุดก่อน (ชุดที่เพิ่งสร้างอยู่บนสุด) + นับจำนวนครั้งที่ใช้ ──
  await page.goto(BASE + '#/add?mode=combos');
  const rows = page.getByRole('listitem');
  await rows.first().waitFor();
  assert((await rows.first().innerText()).includes('เช้าครึ่งส่วน'), 'ชุดที่เพิ่งสร้างต้องขึ้นก่อน');
  const noon = await page.getByRole('listitem').filter({ hasText: 'กลางวันประจำ' }).innerText();
  assert(noon.includes('ใช้แล้ว 2 ครั้ง'), noon);

  // ── แก้ไขและลบ ──
  await page.getByRole('button', { name: 'ดูรายละเอียด เช้าครึ่งส่วน' }).click();
  await page.getByRole('button', { name: 'แก้ไข / ลบมื้อประจำ' }).click();
  await page.getByRole('textbox', { name: 'ชื่อมื้อประจำ' }).fill('เช้าเบา');
  await page.getByRole('button', { name: 'เอา ส้มตำไทย ออก' }).click();
  assert(await page.getByRole('button', { name: 'เอา ข้าวมันไก่ ออก' }).isDisabled(), 'ต้องเหลืออย่างน้อย 1 รายการ');
  await shot('74-combo-edit');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await page.getByRole('button', { name: 'ดูรายละเอียด เช้าเบา' }).waitFor();
  assert((await page.getByRole('listitem').filter({ hasText: 'เช้าเบา' }).innerText()).includes('1 รายการ'));

  await page.getByRole('button', { name: 'ดูรายละเอียด เช้าเบา' }).click();
  await page.getByRole('button', { name: 'แก้ไข / ลบมื้อประจำ' }).click();
  await page.getByRole('button', { name: /ลบมื้อประจำนี้/ }).click();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();
  await page.getByText('ลบมื้อประจำแล้ว').waitFor();
  assert.equal(await page.getByRole('button', { name: 'ดูรายละเอียด เช้าเบา' }).count(), 0);

  // ── เพิ่มมื้อประจำลงตารางเวลา ──
  await page.goto(BASE + '#/schedule/new');
  await page.getByRole('button', { name: 'เพิ่มจากมื้อประจำ' }).click();
  await shot('75-schedule-combo-picker');
  await page.getByRole('button', { name: 'เพิ่มมื้อประจำ กลางวันประจำ' }).click();
  await page.getByText('เพิ่ม "กลางวันประจำ" 2 รายการแล้ว').waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'ชื่อรายการ' }).inputValue(), 'กลางวันประจำ');
  await page.getByRole('button', { name: 'เอา ส้มตำไทย ออก' }).waitFor();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByText('บันทึกการตั้งเวลาแล้ว').waitFor();
  await page.getByText('กลางวันประจำ').first().waitFor();
  assert((await page.locator('.card').filter({ hasText: 'กลางวันประจำ' }).first().innerText()).includes('2 รายการ'));

  // ── ข้อมูลอยู่หลังรีโหลด และอยู่ในไฟล์สำรอง ──
  await page.goto(BASE + '#/add?mode=combos');
  await page.reload();
  await page.getByRole('button', { name: 'ดูรายละเอียด กลางวันประจำ' }).waitFor();
  await page.goto(BASE + '#/settings');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^สำรองข้อมูล/ }).click(),
  ]);
  const path = `${SHOTS}backup-combo.json`;
  await dl.saveAs(path);
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(backup.data.combos.length, 1);
  assert.equal(backup.data.combos[0].name, 'กลางวันประจำ');
  assert.equal(backup.data.combos[0].items.length, 2);

  // ── ลบทั้งหมด → กู้คืน → มื้อประจำกลับมา ──
  await page.getByRole('button', { name: /^ลบข้อมูลทั้งหมด/ }).click();
  await page.getByRole('button', { name: 'ลบทั้งหมด' }).click();
  await page.getByText('นับแคลอรี่ง่ายๆ').waitFor();
  await page.getByLabel('เลือกไฟล์สำรอง').setInputFiles(path);
  await page.getByText('คำแนะนำวันนี้').waitFor();
  await page.goto(BASE + '#/add?mode=combos');
  await page.getByRole('button', { name: 'ดูรายละเอียด กลางวันประจำ' }).waitFor();
}
