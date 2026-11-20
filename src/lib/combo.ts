// มื้อประจำ: ชุดอาหารหลายอย่างที่กินบ่อย (ข้าว + ไข่ดาว + น้ำปลาพริก ฯลฯ) บันทึกลงไดอารี่ได้ครั้งเดียว
import type { Combo, ComboItem, Entry, Food, MealKey, ScheduleItem } from '../db/types';
import { scaleNutrients, sumTotals, type Totals } from './diary';
import { COMBO_NAME_MAX } from './validate';

export const COMBO_EMOJI = '🍱';
export const COMBO_MAX_ITEMS = 30;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** เก็บสำเนาค่าต่อ 1 หน่วยไว้ในชุด จึงไม่เปลี่ยนตามเมื่อแก้/ลบอาหารต้นทางภายหลัง */
export function comboItemFromEntry(e: Entry): ComboItem {
  return { foodId: e.foodId, name: e.name, emoji: e.emoji, serving: e.serving, qty: e.qty, unit: { ...e.unit } };
}

export function comboItemFromFood(food: Food, qty: number): ComboItem {
  return {
    foodId: food.id,
    name: food.name,
    emoji: food.emoji,
    serving: food.serving,
    qty,
    unit: { kcal: food.kcal, protein: food.protein, carb: food.carb, fat: food.fat, grams: food.grams },
  };
}

/** จำนวนและสารอาหารของรายการเมื่อกิน "portions" ส่วน (ใช้สูตรเดียวกับตอนบันทึกจริง ตัวเลขจึงตรงกันเสมอ) */
export function scaleComboItem(item: ComboItem, portions = 1) {
  const qty = r2(item.qty * portions);
  return { qty, ...scaleNutrients(item.unit, qty) };
}

export function comboTotals(items: ComboItem[], portions = 1): Totals {
  return sumTotals(items.map((i) => scaleComboItem(i, portions)));
}

/** ชื่อเริ่มต้นจากชื่ออาหาร 2 รายการแรก เช่น "ข้าวมันไก่ + ชาเย็น +1" */
export function suggestComboName(items: ComboItem[]): string {
  let s = items.slice(0, 2).map((i) => i.name).join(' + ');
  if (items.length > 2) s += ` +${items.length - 2}`;
  return s.length > COMBO_NAME_MAX ? `${s.slice(0, COMBO_NAME_MAX - 1)}…` : s;
}

/** สร้างรายการไดอารี่จากมื้อประจำ (หนึ่งรายการต่ออาหารหนึ่งอย่าง) */
export function entriesFromCombo(
  combo: Combo,
  meal: MealKey,
  date: string,
  time: string,
  portions = 1,
  now = Date.now(),
): Entry[] {
  return combo.items.map((item, i) => {
    const s = scaleComboItem(item, portions);
    return {
      date,
      meal,
      time,
      foodId: item.foodId,
      name: item.name,
      emoji: item.emoji,
      serving: item.serving,
      qty: s.qty,
      unit: { ...item.unit },
      grams: s.grams,
      kcal: s.kcal,
      protein: s.protein,
      carb: s.carb,
      fat: s.fat,
      source: 'combo' as const,
      createdAt: now + i,
    };
  });
}

/**
 * แปลงมื้อประจำเป็นรายการอาหารของตารางเวลา (สำเนา ณ ตอนที่เพิ่ม)
 * ตัวเลขใช้สูตรเดียวกับตอนบันทึกจริง ตารางเวลาจึงบันทึกค่าตรงกับที่เห็นในหน้ามื้อประจำ
 */
export function scheduleItemsFromCombo(combo: Combo, portions = 1): ScheduleItem[] {
  return combo.items.map((item) => {
    const s = scaleComboItem(item, portions);
    return {
      foodId: item.foodId,
      name: item.name,
      emoji: item.emoji,
      serving: item.serving,
      qty: s.qty,
      grams: s.grams,
      kcal: s.kcal,
      protein: s.protein,
      carb: s.carb,
      fat: s.fat,
    };
  });
}
