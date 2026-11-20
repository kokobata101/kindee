
import { t } from '../i18n';
// สูตรคำนวณทั้งหมดของแอป — เปิดเผยและทดสอบได้ ไม่มีกล่องดำ
// อ้างอิง: Mifflin-St Jeor (1990), ตัวคูณกิจกรรมมาตรฐาน, 1 กก. ไขมัน ≈ 7,700 kcal

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';

export const ACTIVITY_LEVELS: {
  key: ActivityLevel;
  label: string;
  factor: number;
}[] = [
  { key: 'sedentary', label: t('นั่งทำงานเป็นส่วนใหญ่'), factor: 1.2 },
  { key: 'light', label: t('เดินบ้างเล็กน้อย'), factor: 1.375 },
  { key: 'moderate', label: t('ออกกำลังกาย 3–5 วัน/สัปดาห์'), factor: 1.55 },
  { key: 'active', label: t('ใช้แรงงาน / นักกีฬา'), factor: 1.725 },
  { key: 'very', label: t('นักกีฬาฝึกหนักทุกวัน'), factor: 1.9 },
];

export const activityFactor = (level: ActivityLevel) =>
  ACTIVITY_LEVELS.find((a) => a.key === level)!.factor;

export const KCAL_PER_KG_FAT = 7700;

export interface BodyInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}

/** พลังงานพื้นฐาน (BMR) สูตร Mifflin-St Jeor */
export function bmr({ sex, weightKg, heightCm, age }: BodyInput): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(body: BodyInput, level: ActivityLevel): number {
  return bmr(body) * activityFactor(level);
}

export const PACES = [0.25, 0.5, 0.75, 1] as const;

export interface GoalCalories {
  kcal: number;
  /** ส่วนต่างต่อวันที่ใช้จริง (ลบ = ลดน้ำหนัก) */
  delta: number;
  /** true ถ้าถูกปรับขึ้นเพราะต่ำกว่าขั้นต่ำที่ปลอดภัย */
  clamped: boolean;
  minKcal: number;
}

export function minSafeKcal(sex: Sex): number {
  return sex === 'male' ? 1500 : 1200;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** เป้าแคลอรี่ต่อวันตามเป้าหมาย: ลด/คง/เพิ่ม ด้วยความเร็ว pace กก./สัปดาห์ */
export function goalCalories(
  tdeeKcal: number,
  goal: Goal,
  paceKgPerWeek: number,
  sex: Sex,
): GoalCalories {
  const minKcal = minSafeKcal(sex);
  const rawDelta = (paceKgPerWeek * KCAL_PER_KG_FAT) / 7;
  let kcal = tdeeKcal;
  if (goal === 'lose') kcal = tdeeKcal - rawDelta;
  if (goal === 'gain') kcal = tdeeKcal + rawDelta;
  kcal = roundTo(kcal, 10);
  let clamped = false;
  if (goal === 'lose' && kcal < minKcal) {
    kcal = minKcal;
    clamped = true;
  }
  return { kcal, delta: kcal - roundTo(tdeeKcal, 10), clamped, minKcal };
}

export interface MacroSplit {
  protein: number;
  carb: number;
  fat: number;
}

export const MACRO_PRESETS: { key: string; label: string; split: MacroSplit }[] = [
  { key: 'balanced', label: t('สมดุล 30/40/30'), split: { protein: 30, carb: 40, fat: 30 } },
  { key: 'highProtein', label: t('โปรตีนสูง 35/35/30'), split: { protein: 35, carb: 35, fat: 30 } },
  { key: 'lowCarb', label: t('คาร์บต่ำ 30/25/45'), split: { protein: 30, carb: 25, fat: 45 } },
  { key: 'lowFat', label: t('ไขมันต่ำ 25/55/20'), split: { protein: 25, carb: 55, fat: 20 } },
];

export interface MacroGrams {
  protein: number;
  carb: number;
  fat: number;
}

export function macroGrams(kcal: number, split: MacroSplit): MacroGrams {
  return {
    protein: Math.round((kcal * split.protein) / 100 / 4),
    carb: Math.round((kcal * split.carb) / 100 / 4),
    fat: Math.round((kcal * split.fat) / 100 / 9),
  };
}

export const isValidSplit = (s: MacroSplit) => s.protein + s.carb + s.fat === 100;

export const kcalFromMacros = (p: number, c: number, f: number) => 4 * p + 4 * c + 9 * f;

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** เกณฑ์ BMI สำหรับคนเอเชีย (WHO Asia-Pacific / กรมอนามัย) */
export function bmiCategory(value: number): string {
  if (value < 18.5) return t('น้ำหนักต่ำกว่าเกณฑ์');
  if (value < 23) return t('สมส่วน');
  if (value < 25) return t('น้ำหนักเกิน');
  if (value < 30) return t('อ้วนระดับ 1');
  return t('อ้วนระดับ 2');
}

/** เป้าน้ำดื่ม ≈ 35 มล./กก. ปัดเป็นหลักห้าสิบ */
export function waterGoalMl(weightKg: number): number {
  return Math.round((weightKg * 35) / 50) * 50;
}

/** พลังงานจากกิจกรรม = MET × น้ำหนัก(กก.) × ชั่วโมง */
export function activityKcal(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * weightKg * minutes) / 60);
}

export function ageFromBirthYear(birthYear: number, today: Date = new Date()): number {
  return today.getFullYear() - birthYear;
}

export function weeksToGoal(currentKg: number, targetKg: number, paceKgPerWeek: number): number {
  if (paceKgPerWeek <= 0) return 0;
  return Math.ceil(Math.abs(currentKg - targetKg) / paceKgPerWeek);
}

/** ความคืบหน้า 0–1 จากน้ำหนักเริ่มต้น → เป้าหมาย */
export function goalProgress(startKg: number, currentKg: number, targetKg: number): number {
  const total = targetKg - startKg;
  if (total === 0) return 1;
  const done = currentKg - startKg;
  return Math.max(0, Math.min(1, done / total));
}

export interface PlanInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: Goal;
  pace: number;
  split: MacroSplit;
}

export interface Plan {
  bmr: number;
  tdee: number;
  goal: GoalCalories;
  macros: MacroGrams;
  waterMl: number;
}

export function buildPlan(i: PlanInput): Plan {
  const b = bmr(i);
  const t = tdee(i, i.activity);
  const g = goalCalories(t, i.goal, i.pace, i.sex);
  return { bmr: b, tdee: t, goal: g, macros: macroGrams(g.kcal, i.split), waterMl: waterGoalMl(i.weightKg) };
}

export const GOAL_LABEL: Record<Goal, string> = {
  lose: t('ลดน้ำหนัก'),
  maintain: t('รักษาน้ำหนัก'),
  gain: t('เพิ่มน้ำหนัก'),
};
