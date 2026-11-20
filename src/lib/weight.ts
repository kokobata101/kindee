import type { Goal } from '../lib/nutrition';
import type { Profile, WeightLog } from '../db/types';
import { addDays, parseISO, weekStart } from './date';
import { bmi, goalProgress } from './nutrition';

import { t } from '../i18n';
export const sortAsc = (logs: WeightLog[]) => [...logs].sort((a, b) => a.date.localeCompare(b.date));

export function latestWeight(logs: WeightLog[]): WeightLog | undefined {
  if (!logs.length) return undefined;
  return sortAsc(logs)[logs.length - 1];
}

/** ถึงเป้าหมายหรือยัง (ดูตามทิศทางเป้าหมาย) */
export function reachedTarget(goal: Goal, currentKg: number, targetKg: number): boolean {
  if (goal === 'lose') return currentKg <= targetKg;
  if (goal === 'gain') return currentKg >= targetKg;
  return Math.abs(currentKg - targetKg) <= 0.5;
}

export interface WeightStats {
  current: number;
  start: number;
  /** current - start (ลบ = ลดลง) */
  change: number;
  /** ส่วนที่ต้องไปต่อ (ค่าสัมบูรณ์) */
  remaining: number;
  progress: number;
  bmiNow: number;
  bmiAtGoal: number;
}

export function weightStats(p: Pick<Profile, 'startWeightKg' | 'targetWeightKg' | 'heightCm' | 'goal'>, logs: WeightLog[]): WeightStats {
  const current = latestWeight(logs)?.kg ?? p.startWeightKg;
  return {
    current,
    start: p.startWeightKg,
    change: Math.round((current - p.startWeightKg) * 10) / 10,
    remaining: Math.round(Math.abs(current - p.targetWeightKg) * 10) / 10,
    progress: goalProgress(p.startWeightKg, current, p.targetWeightKg),
    bmiNow: bmi(current, p.heightCm),
    bmiAtGoal: bmi(p.targetWeightKg, p.heightCm),
  };
}

export interface WeekPoint {
  weekStart: string;
  label: string;
  avg: number | null;
}

export type WeightRange = '4w' | '8w' | '6m' | 'all';

export const WEIGHT_RANGES: { key: WeightRange; label: string }[] = [
  { key: '4w', label: t('4 สัปดาห์') },
  { key: '8w', label: t('8 สัปดาห์') },
  { key: '6m', label: t('6 เดือน') },
  { key: 'all', label: t('ทั้งหมด') },
];

/** ค่าเฉลี่ยน้ำหนักรายสัปดาห์ (จันทร์–อาทิตย์) ย้อนหลัง n สัปดาห์จบที่สัปดาห์ปัจจุบัน */
export function weeklyAverages(logs: WeightLog[], today: string, weeks: number): WeekPoint[] {
  const thisWeek = weekStart(today);
  const out: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const we = addDays(ws, 6);
    const inWeek = logs.filter((l) => l.date >= ws && l.date <= we);
    out.push({
      weekStart: ws,
      label: String(weeks - i),
      avg: inWeek.length ? Math.round((inWeek.reduce((a, l) => a + l.kg, 0) / inWeek.length) * 10) / 10 : null,
    });
  }
  return out;
}

export function weeksForRange(range: WeightRange, logs: WeightLog[], today: string): number {
  if (range === '4w') return 4;
  if (range === '8w') return 8;
  if (range === '6m') return 26;
  if (!logs.length) return 4;
  const first = sortAsc(logs)[0].date;
  const days = Math.round((parseISO(today).getTime() - parseISO(first).getTime()) / 86400000);
  return Math.max(4, Math.ceil(days / 7) + 1);
}

export interface WeightRow extends WeightLog {
  /** เทียบกับการบันทึกก่อนหน้า */
  delta: number | null;
}

/** รายการล่าสุดก่อน พร้อมส่วนต่างจากครั้งก่อน */
export function withDeltas(logs: WeightLog[]): WeightRow[] {
  const asc = sortAsc(logs);
  return asc
    .map((l, i) => ({ ...l, delta: i > 0 ? Math.round((l.kg - asc[i - 1].kg) * 10) / 10 : null }))
    .reverse();
}
