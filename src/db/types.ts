import type { ActivityLevel, Goal, MacroSplit, Sex } from '../lib/nutrition';
import type { Intensity } from '../lib/activities';

import { t } from '../i18n';
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { key: MealKey; label: string; emoji: string }[] = [
  { key: 'breakfast', label: t('มื้อเช้า'), emoji: '🍳' },
  { key: 'lunch', label: t('มื้อกลางวัน'), emoji: '🍲' },
  { key: 'dinner', label: t('มื้อเย็น'), emoji: '🌙' },
  { key: 'snack', label: t('ของว่าง'), emoji: '🍌' },
];

export const mealLabel = (k: MealKey) => MEALS.find((m) => m.key === k)!.label;
export const mealEmoji = (k: MealKey) => MEALS.find((m) => m.key === k)!.emoji;

/** เดามื้อจากเวลา เพื่อเลือกมื้อเริ่มต้นตอนเพิ่มอาหาร */
export function guessMeal(hour: number): MealKey {
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'snack';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}

export interface Food {
  id: string;
  name: string;
  nameEn?: string;
  emoji: string;
  /** หน่วยบริโภค เช่น "1 จาน" */
  serving: string;
  grams: number;
  /** ค่าต่อ 1 หน่วยบริโภค */
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  source: 'builtin' | 'custom' | 'barcode';
  category?: string;
  barcode?: string;
  brand?: string;
}

export type EntrySource = 'search' | 'custom' | 'quick' | 'scheduled' | 'copy' | 'scan' | 'barcode' | 'combo';

/** ค่าสารอาหารต่อ 1 หน่วยบริโภค (เก็บไว้เพื่อคำนวณใหม่ตอนแก้จำนวนโดยไม่คลาดเคลื่อนสะสม) */
export interface UnitNutrients {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  grams: number;
}

export interface Entry {
  id?: number;
  date: string;
  meal: MealKey;
  time: string;
  foodId?: string;
  name: string;
  emoji: string;
  serving: string;
  qty: number;
  unit: UnitNutrients;
  grams: number;
  /** ยอดรวมของรายการนี้ (ต่อหน่วย × จำนวน) */
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  source: EntrySource;
  createdAt: number;
}

export interface Profile {
  id: 1;
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  goal: Goal;
  pace: number;
  activity: ActivityLevel;
  presetKey: string;
  split: MacroSplit;
  kcalGoal: number;
  kcalManual: boolean;
  waterGoalMl: number;
  waterManual: boolean;
  /** คำนวณเป้าใหม่อัตโนมัติเมื่อบันทึกน้ำหนักใหม่ */
  autoAdjust: boolean;
  theme: 'system' | 'light' | 'dark';
  createdAt: number;
}

export interface WaterLog {
  id?: number;
  date: string;
  ml: number;
  time: string;
}

export interface WeightLog {
  date: string;
  kg: number;
  note?: string;
  createdAt: number;
}

export interface ActivityLog {
  id?: number;
  date: string;
  time: string;
  typeKey: string;
  name: string;
  emoji: string;
  intensity: Intensity;
  minutes: number;
  met: number;
  /** น้ำหนักที่ใช้คำนวณ ณ ตอนบันทึก */
  weightKg: number;
  kcal: number;
  source: 'manual' | 'health-connect';
}

export interface ScheduleItem {
  foodId?: string;
  name: string;
  emoji: string;
  serving: string;
  qty: number;
  grams: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

export interface Schedule {
  id?: number;
  name: string;
  emoji: string;
  meal: MealKey;
  /** HH:mm */
  time: string;
  /** 0 = จันทร์ ... 6 = อาทิตย์ */
  days: number[];
  items: ScheduleItem[];
  enabled: boolean;
  lastRunDate?: string;
}

export interface KV {
  key: string;
  value: unknown;
}

/** รายการหนึ่งในมื้อประจำ เก็บสำเนาค่าสารอาหารต่อ 1 หน่วย จึงไม่เปลี่ยนตามเมื่อแก้/ลบอาหารต้นทาง */
export interface ComboItem {
  foodId?: string;
  name: string;
  emoji: string;
  serving: string;
  qty: number;
  unit: UnitNutrients;
}

/** มื้อประจำ: ชุดอาหารหลายอย่างที่กินบ่อย บันทึกลงไดอารี่ได้ในครั้งเดียว */
export interface Combo {
  id?: number;
  name: string;
  emoji: string;
  items: ComboItem[];
  useCount: number;
  lastUsedAt?: number;
  createdAt: number;
}
