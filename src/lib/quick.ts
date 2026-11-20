// แคลอรี่ด่วน: บันทึกแคลอรี่โดยไม่ต้องหาชื่ออาหาร (เช่น รู้จากฉลาก หรือประมาณเอง)
import type { Entry, MealKey } from '../db/types';

// เก็บเป็นไทยเสมอ (ข้อมูลต้นฉบับ) แล้วแปลตอนแสดงผลด้วย t()
export const QUICK_NAME = 'แคลอรี่ด่วน';
export const QUICK_EMOJI = '⚡';
export const QUICK_SERVING = '1 ครั้ง';

export interface QuickInput {
  kcal: number;
  name?: string;
  protein?: number | null;
  carb?: number | null;
  fat?: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const grams = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? r1(v) : 0);

function normalize(input: QuickInput) {
  return {
    name: input.name?.trim() || QUICK_NAME,
    kcal: Math.round(input.kcal),
    protein: grams(input.protein),
    carb: grams(input.carb),
    fat: grams(input.fat),
  };
}

/** รายการด่วนไม่มีน้ำหนักอาหาร (grams = 0) และไม่ผูกกับ foodId */
export function entryFromQuick(input: QuickInput, meal: MealKey, date: string, time: string, now = Date.now()): Entry {
  const q = normalize(input);
  return {
    date,
    meal,
    time,
    name: q.name,
    emoji: QUICK_EMOJI,
    serving: QUICK_SERVING,
    qty: 1,
    unit: { kcal: q.kcal, protein: q.protein, carb: q.carb, fat: q.fat, grams: 0 },
    grams: 0,
    kcal: q.kcal,
    protein: q.protein,
    carb: q.carb,
    fat: q.fat,
    source: 'quick',
    createdAt: now,
  };
}

/** แก้รายการด่วนเดิม (แคลอรี่/ชื่อ/สารอาหาร/มื้อ) จำนวนคงที่ที่ 1 ครั้ง */
export function reviseQuickEntry(e: Entry, input: QuickInput & { meal?: MealKey }): Entry {
  const q = normalize(input);
  return {
    ...e,
    meal: input.meal ?? e.meal,
    name: q.name,
    qty: 1,
    unit: { kcal: q.kcal, protein: q.protein, carb: q.carb, fat: q.fat, grams: 0 },
    grams: 0,
    kcal: q.kcal,
    protein: q.protein,
    carb: q.carb,
    fat: q.fat,
  };
}

export const isQuickEntry = (e: Pick<Entry, 'source'>): boolean => e.source === 'quick';
