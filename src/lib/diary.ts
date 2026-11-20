import type { Entry, EntrySource, Food, MealKey, ScheduleItem } from '../db/types';
import { t } from '../i18n';
import { unitLabel } from './names';

export interface Totals {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export const EMPTY_TOTALS: Totals = { kcal: 0, protein: 0, carb: 0, fat: 0 };

type Nutrients = Pick<Food, 'kcal' | 'protein' | 'carb' | 'fat' | 'grams'>;

/** คำนวณค่าสารอาหารของ "จำนวนหน่วยบริโภค" (qty) */
export function scaleNutrients(f: Nutrients, qty: number): Nutrients {
  return {
    kcal: Math.round(f.kcal * qty),
    protein: r1(f.protein * qty),
    carb: r1(f.carb * qty),
    fat: r1(f.fat * qty),
    grams: Math.round(f.grams * qty),
  };
}

export function sumTotals(rows: Totals[]): Totals {
  const t = rows.reduce(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein: a.protein + e.protein,
      carb: a.carb + e.carb,
      fat: a.fat + e.fat,
    }),
    { ...EMPTY_TOTALS },
  );
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carb: r1(t.carb), fat: r1(t.fat) };
}

export function entryFromFood(
  food: Food,
  qty: number,
  meal: MealKey,
  date: string,
  time: string,
  source: EntrySource,
  now = Date.now(),
): Entry {
  const n = scaleNutrients(food, qty);
  return {
    date,
    meal,
    time,
    foodId: food.id,
    name: food.name,
    emoji: food.emoji,
    serving: food.serving,
    qty,
    unit: { kcal: food.kcal, protein: food.protein, carb: food.carb, fat: food.fat, grams: food.grams },
    grams: n.grams,
    kcal: n.kcal,
    protein: n.protein,
    carb: n.carb,
    fat: n.fat,
    source,
    createdAt: now,
  };
}

export function scheduleItemFromFood(food: Food, qty: number): ScheduleItem {
  const n = scaleNutrients(food, qty);
  return {
    foodId: food.id,
    name: food.name,
    emoji: food.emoji,
    serving: food.serving,
    qty,
    grams: n.grams,
    kcal: n.kcal,
    protein: n.protein,
    carb: n.carb,
    fat: n.fat,
  };
}

/** แก้จำนวน/มื้อของรายการ แล้วคำนวณค่าสารอาหารใหม่จาก unit เดิม */
export function reviseEntry(e: Entry, patch: Partial<Pick<Entry, 'qty' | 'meal' | 'time' | 'date'>>): Entry {
  const qty = patch.qty ?? e.qty;
  const n = scaleNutrients(e.unit, qty);
  return { ...e, ...patch, qty, kcal: n.kcal, protein: n.protein, carb: n.carb, fat: n.fat, grams: n.grams };
}

export function groupByMeal(entries: Entry[]): Record<MealKey, Entry[]> {
  const g: Record<MealKey, Entry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const e of entries) g[e.meal].push(e);
  for (const k of Object.keys(g) as MealKey[]) g[k].sort((a, b) => a.time.localeCompare(b.time));
  return g;
}

/** แคลอรี่คงเหลือ = เป้าหมาย − อาหาร + กิจกรรม */
export const remainingKcal = (goal: number, eaten: number, burned: number) => goal - eaten + burned;

/** ข้อความปริมาณ: "1 จาน" × 2 -> "2 จาน", "100 กรัม" × 1.5 -> "150 กรัม" */
export function qtyLabel(qty: number, serving: string): string {
  const m = serving.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(.*)$/);
  if (m) {
    const frac = m[1].match(/^(\d+)\/(\d+)$/);
    const base = frac ? Number(frac[1]) / Number(frac[2]) : parseFloat(m[1]);
    const total = parseFloat((base * qty).toFixed(2));
    return `${total} ${unitLabel(m[2], total)}`.trim();
  }
  return `${parseFloat(qty.toFixed(2))} × ${t(serving)}`;
}

/** หน่วยบริโภคต่อ 1 หน่วย เช่น "1 จาน" / "1 plate" */
export const servingLabel = (serving: string): string => qtyLabel(1, serving);
