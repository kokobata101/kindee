import type { Goal } from './nutrition';
import { bmi } from './nutrition';

import { t } from '../i18n';
export const LIMITS = {
  age: { min: 15, max: 100 },
  height: { min: 120, max: 220 },
  weight: { min: 30, max: 250 },
} as const;

export interface BodyDraft {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
}

export interface BodyErrors {
  age?: string;
  heightCm?: string;
  weightKg?: string;
}

const inRange = (n: number | null, min: number, max: number) => n !== null && n >= min && n <= max;

export function validateBody(d: BodyDraft): BodyErrors {
  const e: BodyErrors = {};
  if (!inRange(d.age, LIMITS.age.min, LIMITS.age.max) || !Number.isInteger(d.age)) {
    e.age = t('ใส่อายุ {min}–{max} ปี', { min: LIMITS.age.min, max: LIMITS.age.max });
  }
  if (!inRange(d.heightCm, LIMITS.height.min, LIMITS.height.max)) {
    e.heightCm = t('ใส่ส่วนสูง {min}–{max} ซม.', { min: LIMITS.height.min, max: LIMITS.height.max });
  }
  if (!inRange(d.weightKg, LIMITS.weight.min, LIMITS.weight.max)) {
    e.weightKg = t('ใส่น้ำหนัก {min}–{max} กก.', { min: LIMITS.weight.min, max: LIMITS.weight.max });
  }
  return e;
}

export interface TargetCheck {
  error?: string;
  warning?: string;
}

/** ตรวจน้ำหนักเป้าหมายให้สอดคล้องกับทิศทางเป้าหมาย */
export function validateTarget(goal: Goal, weightKg: number, targetKg: number | null, heightCm: number): TargetCheck {
  if (goal === 'maintain') return {};
  if (!inRange(targetKg, LIMITS.weight.min, LIMITS.weight.max)) {
    return { error: t('ใส่น้ำหนักเป้าหมาย {min}–{max} กก.', { min: LIMITS.weight.min, max: LIMITS.weight.max }) };
  }
  const target = targetKg as number;
  if (goal === 'lose' && target >= weightKg) return { error: t('เป้าหมายลดน้ำหนักต้องน้อยกว่าน้ำหนักปัจจุบัน') };
  if (goal === 'gain' && target <= weightKg) return { error: t('เป้าหมายเพิ่มน้ำหนักต้องมากกว่าน้ำหนักปัจจุบัน') };
  const b = bmi(target, heightCm);
  if (goal === 'lose' && b < 18.5) {
    return { warning: t('น้ำหนักเป้าหมายนี้ทำให้ BMI เหลือ {b} ซึ่งต่ำกว่าเกณฑ์ ควรปรึกษาแพทย์หรือนักกำหนดอาหาร', { b: b.toFixed(1) }) };
  }
  if (goal === 'gain' && b >= 25) {
    return { warning: t('น้ำหนักเป้าหมายนี้ทำให้ BMI เป็น {b} ซึ่งสูงกว่าเกณฑ์สมส่วน', { b: b.toFixed(1) }) };
  }
  return {};
}

export interface FoodDraft {
  name: string;
  serving: string;
  grams: number | null;
  kcal: number | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
}

export interface FoodErrors {
  name?: string;
  serving?: string;
  grams?: string;
  kcal?: string;
  macros?: string;
}

export function validateFood(d: FoodDraft): FoodErrors {
  const e: FoodErrors = {};
  if (!d.name.trim()) e.name = t('ใส่ชื่ออาหาร');
  if (!d.serving.trim()) e.serving = t('ใส่หน่วยบริโภค เช่น 1 จาน');
  if (d.grams === null || d.grams <= 0) e.grams = t('ใส่น้ำหนักต่อหน่วย (กรัม)');
  if (d.kcal === null || d.kcal < 0 || d.kcal > 5000) e.kcal = t('ใส่แคลอรี่ 0–5,000 kcal');
  for (const v of [d.protein, d.carb, d.fat]) {
    if (v !== null && (v < 0 || v > 1000)) e.macros = t('ค่าสารอาหารต้องไม่ติดลบ');
  }
  return e;
}

export interface QuickDraft {
  kcal: number | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
}

export interface QuickErrors {
  kcal?: string;
  macros?: string;
}

export const QUICK_MAX_KCAL = 5000;

export function validateQuick(d: QuickDraft): QuickErrors {
  const e: QuickErrors = {};
  if (d.kcal === null || !(d.kcal >= 1) || d.kcal > QUICK_MAX_KCAL) e.kcal = t('ใส่แคลอรี่ 1–5,000 kcal');
  for (const v of [d.protein, d.carb, d.fat]) {
    if (v !== null && (v < 0 || v > 1000)) e.macros = t('ค่าสารอาหารต้องอยู่ระหว่าง 0–1,000 g');
  }
  return e;
}

export const COMBO_NAME_MAX = 40;

export function validateComboName(name: string): string | undefined {
  const n = name.trim();
  if (!n) return t('ตั้งชื่อมื้อประจำ');
  if (n.length > COMBO_NAME_MAX) return t('ชื่อยาวเกิน {COMBO_NAME_MAX} ตัวอักษร', { COMBO_NAME_MAX });
  return undefined;
}
