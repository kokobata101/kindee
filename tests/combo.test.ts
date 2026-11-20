import { describe, expect, it } from 'vitest';
import { BUILTIN_BY_ID } from '../src/data/foods';
import { entryFromFood } from '../src/lib/diary';
import { comboItemFromEntry, comboItemFromFood, comboTotals, entriesFromCombo, suggestComboName } from '../src/lib/combo';
import { entryFromQuick, reviseQuickEntry, QUICK_NAME } from '../src/lib/quick';
import { validateComboName, validateQuick } from '../src/lib/validate';
import type { Combo } from '../src/db/types';

const food = (id: string) => BUILTIN_BY_ID.get(id)!;
const anyFood = () => [...BUILTIN_BY_ID.values()];

describe('แคลอรี่ด่วน', () => {
  it('สร้างรายการจากแคลอรี่อย่างเดียว: ชื่อเริ่มต้น สารอาหารเป็น 0 ไม่มี foodId', () => {
    const e = entryFromQuick({ kcal: 400 }, 'lunch', '2026-11-10', '12:00', 1);
    expect(e).toMatchObject({ name: QUICK_NAME, kcal: 400, protein: 0, carb: 0, fat: 0, grams: 0, qty: 1, source: 'quick', meal: 'lunch' });
    expect(e.foodId).toBeUndefined();
    expect(e.unit.kcal).toBe(400);
  });

  it('ใส่ชื่อ/สารอาหาร และปัดแคลอรี่เป็นจำนวนเต็ม', () => {
    const e = entryFromQuick({ kcal: 350.6, name: '  ข้าวร้านป้า ', protein: 20.25, carb: 50, fat: null }, 'dinner', '2026-11-10', '19:00');
    expect(e.name).toBe('ข้าวร้านป้า');
    expect(e.kcal).toBe(351);
    expect(e.protein).toBe(20.3);
    expect(e.fat).toBe(0);
  });

  it('แก้รายการด่วน: เปลี่ยนค่า/มื้อ แต่คงวันที่และ id', () => {
    const e = { ...entryFromQuick({ kcal: 400 }, 'lunch', '2026-11-10', '12:00'), id: 7 };
    const r = reviseQuickEntry(e, { kcal: 250, name: 'ขนม', protein: 3, meal: 'snack' });
    expect(r).toMatchObject({ id: 7, date: '2026-11-10', meal: 'snack', name: 'ขนม', kcal: 250, protein: 3, qty: 1 });
    expect(r.unit.kcal).toBe(250);
  });

  it('validateQuick: ต้องมีแคลอรี่ 1–5,000', () => {
    const base = { kcal: 400, protein: null, carb: null, fat: null };
    expect(validateQuick(base)).toEqual({});
    expect(validateQuick({ ...base, kcal: null }).kcal).toBeTruthy();
    expect(validateQuick({ ...base, kcal: 0 }).kcal).toBeTruthy();
    expect(validateQuick({ ...base, kcal: 5001 }).kcal).toBeTruthy();
    expect(validateQuick({ ...base, kcal: 5000 })).toEqual({});
    expect(validateQuick({ ...base, protein: 2000 }).macros).toBeTruthy();
  });
});

describe('มื้อประจำ', () => {
  const a = anyFood()[0];
  const b = anyFood()[1];
  const items = [comboItemFromFood(a, 1), comboItemFromFood(b, 2)];

  it('ยอดรวมเท่ากับผลรวมของแต่ละรายการ (ปัดต่อรายการเหมือนตอนบันทึกจริง)', () => {
    const t = comboTotals(items);
    expect(t.kcal).toBe(Math.round(a.kcal) + Math.round(b.kcal * 2));
  });

  it('ยอดที่แสดงก่อนเพิ่มตรงกับยอดที่ถูกบันทึก ไม่ว่าจะกี่ส่วน', () => {
    for (const portions of [0.5, 1, 1.5, 3]) {
      const combo: Combo = { name: 'x', emoji: '🍱', items, useCount: 0, createdAt: 1 };
      const entries = entriesFromCombo(combo, 'lunch', '2026-11-10', '12:00', portions);
      expect(entries.reduce((s, e) => s + e.kcal, 0)).toBe(comboTotals(items, portions).kcal);
    }
  });

  it('entriesFromCombo: 1 รายการต่ออาหาร 1 อย่าง, qty × ส่วน, source combo, เรียงเวลาสร้างต่อกัน', () => {
    const combo: Combo = { name: 'x', emoji: '🍱', items, useCount: 0, createdAt: 1 };
    const es = entriesFromCombo(combo, 'dinner', '2026-11-10', '18:30', 1.5, 1000);
    expect(es).toHaveLength(2);
    expect(es.map((e) => e.qty)).toEqual([1.5, 3]);
    expect(es.every((e) => e.source === 'combo' && e.meal === 'dinner' && e.date === '2026-11-10')).toBe(true);
    expect(es.map((e) => e.createdAt)).toEqual([1000, 1001]);
    expect(es[0].foodId).toBe(a.id);
  });

  it('สร้างจากรายการในไดอารี่ได้ค่าเท่าเดิม', () => {
    const e = entryFromFood(food(a.id), 1.5, 'lunch', '2026-11-10', '12:00', 'search');
    const item = comboItemFromEntry(e);
    expect(item.qty).toBe(1.5);
    expect(comboTotals([item]).kcal).toBe(e.kcal);
  });

  it('ชื่อแนะนำ: 2 รายการแรก + จำนวนที่เหลือ และไม่ยาวเกินกำหนด', () => {
    const three = [...items, comboItemFromFood(anyFood()[2], 1)];
    expect(suggestComboName(items)).toBe(`${a.name} + ${b.name}`);
    expect(suggestComboName(three)).toBe(`${a.name} + ${b.name} +1`);
    const long = [{ ...items[0], name: 'ก'.repeat(80) }];
    expect(suggestComboName(long).length).toBeLessThanOrEqual(40);
  });

  it('validateComboName', () => {
    expect(validateComboName('  ')).toBeTruthy();
    expect(validateComboName('มื้อเช้า')).toBeUndefined();
    expect(validateComboName('ก'.repeat(41))).toBeTruthy();
  });
});
