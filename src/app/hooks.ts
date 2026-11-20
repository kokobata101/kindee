import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { groupByMeal, sumTotals, type Totals } from '../lib/diary';
import { latestWeight, sortAsc } from '../lib/weight';
import type { ActivityLog, Entry, MealKey, WaterLog, WeightLog } from '../db/types';

export interface DayData {
  loading: boolean;
  entries: Entry[];
  byMeal: Record<MealKey, Entry[]>;
  totals: Totals;
  water: WaterLog[];
  waterMl: number;
  acts: ActivityLog[];
  burned: number;
  activeMinutes: number;
}

const EMPTY_MEALS: Record<MealKey, Entry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };

/** ข้อมูลทั้งหมดของวันหนึ่ง อัปเดตอัตโนมัติเมื่อฐานข้อมูลเปลี่ยน */
export function useDay(date: string): DayData {
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date]);
  const water = useLiveQuery(() => db.water.where('date').equals(date).toArray(), [date]);
  const acts = useLiveQuery(() => db.activities.where('date').equals(date).toArray(), [date]);
  const e = entries ?? [];
  const w = water ?? [];
  const a = acts ?? [];
  return {
    loading: entries === undefined || water === undefined || acts === undefined,
    entries: e,
    byMeal: entries ? groupByMeal(e) : EMPTY_MEALS,
    totals: sumTotals(e),
    water: w.sort((x, y) => y.time.localeCompare(x.time)),
    waterMl: w.reduce((s, x) => s + x.ml, 0),
    acts: a.sort((x, y) => y.time.localeCompare(x.time)),
    burned: a.reduce((s, x) => s + x.kcal, 0),
    activeMinutes: a.reduce((s, x) => s + x.minutes, 0),
  };
}

export function useRangeData(start: string, end: string) {
  const entries = useLiveQuery(() => db.entries.where('date').between(start, end, true, true).toArray(), [start, end]);
  const water = useLiveQuery(() => db.water.where('date').between(start, end, true, true).toArray(), [start, end]);
  const acts = useLiveQuery(() => db.activities.where('date').between(start, end, true, true).toArray(), [start, end]);
  return {
    loading: entries === undefined || water === undefined || acts === undefined,
    entries: entries ?? [],
    water: water ?? [],
    acts: acts ?? [],
  };
}

export function useWeights(): { loading: boolean; logs: WeightLog[]; latest: WeightLog | undefined } {
  const logs = useLiveQuery(() => db.weights.toArray(), []);
  return { loading: logs === undefined, logs: logs ? sortAsc(logs) : [], latest: logs ? latestWeight(logs) : undefined };
}
