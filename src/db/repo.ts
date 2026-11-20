import { db, ALL_TABLES } from './db';
import type {
  ActivityLog,
  Combo,
  ComboItem,
  Entry,
  Food,
  MealKey,
  Profile,
  Schedule,
  WaterLog,
  WeightLog,
} from './types';
import { BUILTIN_BY_ID, BUILTIN_FOODS } from '../data/foods';
import { entryFromFood, reviseEntry, sumTotals } from '../lib/diary';
import { COMBO_EMOJI, COMBO_MAX_ITEMS, entriesFromCombo } from '../lib/combo';
import { entryFromQuick, reviseQuickEntry, type QuickInput } from '../lib/quick';
import { validateComboName } from '../lib/validate';
import { recalcGoals } from '../lib/goals';
import { activityKcal } from '../lib/nutrition';
import { activityTypeByKey, metFor, type Intensity } from '../lib/activities';
import { addDays } from '../lib/date';
import { latestWeight } from '../lib/weight';
import type { EntrySource } from './types';

import { t } from '../i18n';
// ───────────── โปรไฟล์ ─────────────

export const getProfile = () => db.profile.get(1);

/** สร้างโปรไฟล์ครั้งแรก พร้อมบันทึกน้ำหนักเริ่มต้นของวันนี้ */
export async function createProfile(p: Omit<Profile, 'id' | 'createdAt'>, today: string): Promise<Profile> {
  const profile: Profile = { ...p, id: 1, createdAt: Date.now() };
  await db.transaction('rw', db.profile, db.weights, async () => {
    await db.profile.put(profile);
    await db.weights.put({ date: today, kg: p.startWeightKg, createdAt: Date.now() });
  });
  return profile;
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const cur = await db.profile.get(1);
  if (!cur) throw new Error(t('ยังไม่ได้สร้างโปรไฟล์'));
  const next = { ...cur, ...patch };
  await db.profile.put(next);
  return next;
}

/** คำนวณเป้าใหม่จากน้ำหนักล่าสุด (เคารพค่าที่ตั้งเอง) */
export async function refreshGoals(now: Date = new Date()): Promise<Profile | undefined> {
  const p = await db.profile.get(1);
  if (!p) return undefined;
  const w = latestWeight(await db.weights.toArray())?.kg ?? p.startWeightKg;
  const next = recalcGoals(p, w, now);
  await db.profile.put(next);
  return next;
}

// ───────────── อาหาร ─────────────

export async function allFoods(): Promise<Food[]> {
  const custom = await db.foods.toArray();
  return [...custom.sort((a, b) => a.name.localeCompare(b.name, 'th')), ...BUILTIN_FOODS];
}

export async function getFood(id: string): Promise<Food | undefined> {
  return BUILTIN_BY_ID.get(id) ?? (await db.foods.get(id));
}

export type FoodInput = Omit<Food, 'id' | 'source'> & { id?: string; source?: Food['source'] };

export async function saveCustomFood(input: FoodInput): Promise<Food> {
  const id = input.id ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const food: Food = { ...input, id, source: input.source ?? 'custom' };
  await db.foods.put(food);
  return food;
}

export const deleteCustomFood = (id: string) => db.foods.delete(id);

const FAV_KEY = 'favoriteFoodIds';

export async function getFavoriteIds(): Promise<string[]> {
  return ((await db.kv.get(FAV_KEY))?.value as string[] | undefined) ?? [];
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const cur = await getFavoriteIds();
  const has = cur.includes(id);
  const next = has ? cur.filter((x) => x !== id) : [...cur, id];
  await db.kv.put({ key: FAV_KEY, value: next });
  return !has;
}

/** อาหารที่เพิ่งบันทึกล่าสุด (ไม่ซ้ำ) */
export async function recentFoods(limit = 12): Promise<Food[]> {
  const rows = await db.entries.orderBy('id').reverse().limit(300).toArray();
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const e of rows) {
    if (!e.foodId || seen.has(e.foodId)) continue;
    seen.add(e.foodId);
    const f = await getFood(e.foodId);
    if (f) out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

// ───────────── ไดอารี่อาหาร ─────────────

export async function addFoodEntry(
  food: Food,
  qty: number,
  meal: MealKey,
  date: string,
  time: string,
  source: EntrySource = 'search',
): Promise<number> {
  return db.entries.add(entryFromFood(food, qty, meal, date, time, source));
}

export async function addManyEntries(entries: Entry[]): Promise<void> {
  await db.entries.bulkAdd(entries);
}

export async function updateEntry(id: number, patch: Partial<Pick<Entry, 'qty' | 'meal' | 'time' | 'date'>>): Promise<void> {
  const e = await db.entries.get(id);
  if (!e) return;
  await db.entries.put(reviseEntry(e, patch));
}

export const deleteEntry = (id: number) => db.entries.delete(id);

export const getEntries = (date: string) => db.entries.where('date').equals(date).toArray();

export const getEntriesInRange = (start: string, end: string) =>
  db.entries.where('date').between(start, end, true, true).toArray();

/** คัดลอกรายการของวันหนึ่งไปอีกวัน (เช่น คัดลอกจากเมื่อวาน) */
export async function copyDay(from: string, to: string, meals?: MealKey[]): Promise<number> {
  const src = (await getEntries(from)).filter((e) => !meals || meals.includes(e.meal));
  const now = Date.now();
  const copies = src.map(({ id: _id, ...rest }, i) => ({ ...rest, date: to, source: rest.source === 'quick' ? ('quick' as const) : ('copy' as const), createdAt: now + i }));
  await db.entries.bulkAdd(copies);
  return copies.length;
}

/** คัดลอกวันก่อนหน้าล่าสุดที่มีข้อมูล ภายใน 7 วัน (ใช้กับปุ่ม "คัดลอกจากเมื่อวาน") */
export async function findPreviousLoggedDay(date: string, maxBack = 7): Promise<string | null> {
  for (let i = 1; i <= maxBack; i++) {
    const d = addDays(date, -i);
    if ((await db.entries.where('date').equals(d).count()) > 0) return d;
  }
  return null;
}

// ───────────── แคลอรี่ด่วน ─────────────

export async function addQuickEntry(input: QuickInput, meal: MealKey, date: string, time: string): Promise<number> {
  if (!(input.kcal >= 1)) throw new Error(t('แคลอรี่ต้องมากกว่า 0'));
  return db.entries.add(entryFromQuick(input, meal, date, time));
}

export async function updateQuickEntry(id: number, input: QuickInput & { meal?: MealKey }): Promise<void> {
  if (!(input.kcal >= 1)) throw new Error(t('แคลอรี่ต้องมากกว่า 0'));
  const e = await db.entries.get(id);
  if (!e || e.source !== 'quick') return;
  await db.entries.put(reviseQuickEntry(e, input));
}

// ───────────── มื้อประจำ ─────────────

/** ใช้ล่าสุดก่อน (ถ้ายังไม่เคยใช้ ดูจากวันที่สร้าง) */
export async function getCombos(): Promise<Combo[]> {
  const rows = await db.combos.toArray();
  return rows.sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt) || (b.id ?? 0) - (a.id ?? 0));
}

export interface ComboInput {
  id?: number;
  name: string;
  emoji?: string;
  items: ComboItem[];
}

export async function saveCombo(input: ComboInput, now = Date.now()): Promise<Combo> {
  const nameErr = validateComboName(input.name);
  if (nameErr) throw new Error(nameErr);
  if (input.items.length === 0) throw new Error(t('มื้อประจำต้องมีอย่างน้อย 1 รายการ'));
  if (input.items.length > COMBO_MAX_ITEMS) throw new Error(t('มื้อประจำใส่ได้ไม่เกิน {COMBO_MAX_ITEMS} รายการ', { COMBO_MAX_ITEMS }));
  if (input.items.some((i) => !Number.isFinite(i.qty) || !(i.qty > 0))) throw new Error(t('จำนวนต้องมากกว่า 0'));
  const prev = input.id !== undefined ? await db.combos.get(input.id) : undefined;
  if (input.id !== undefined && !prev) throw new Error(t('ไม่พบมื้อประจำนี้'));
  const row: Combo = {
    id: prev?.id,
    name: input.name.trim(),
    emoji: input.emoji ?? prev?.emoji ?? COMBO_EMOJI,
    items: input.items.map((i) => ({ ...i, unit: { ...i.unit } })),
    useCount: prev?.useCount ?? 0,
    lastUsedAt: prev?.lastUsedAt,
    createdAt: prev?.createdAt ?? now,
  };
  if (row.id === undefined) delete row.id;
  row.id = await db.combos.put(row);
  return row;
}

export const deleteCombo = (id: number) => db.combos.delete(id);

/** เพิ่มทั้งชุดลงไดอารี่ (หนึ่งรายการต่ออาหารหนึ่งอย่าง) และนับจำนวนครั้งที่ใช้ */
export async function addComboToDay(
  id: number,
  meal: MealKey,
  date: string,
  time: string,
  portions = 1,
  now = Date.now(),
): Promise<{ name: string; count: number; kcal: number }> {
  if (!(portions > 0)) throw new Error(t('จำนวนส่วนต้องมากกว่า 0'));
  return db.transaction('rw', db.entries, db.combos, async () => {
    const c = await db.combos.get(id);
    if (!c) throw new Error(t('ไม่พบมื้อประจำนี้'));
    const entries = entriesFromCombo(c, meal, date, time, portions, now);
    await db.entries.bulkAdd(entries);
    await db.combos.update(id, { useCount: (c.useCount ?? 0) + 1, lastUsedAt: now });
    return { name: c.name, count: entries.length, kcal: sumTotals(entries).kcal };
  });
}

// ───────────── น้ำ ─────────────

export const addWater = (ml: number, date: string, time: string) => db.water.add({ ml, date, time });
export const deleteWater = (id: number) => db.water.delete(id);
export const getWater = (date: string): Promise<WaterLog[]> => db.water.where('date').equals(date).toArray();

// ───────────── น้ำหนัก ─────────────

export async function setWeight(date: string, kg: number, note?: string, now: Date = new Date()): Promise<void> {
  await db.weights.put({ date, kg, note, createdAt: Date.now() });
  const p = await db.profile.get(1);
  if (p?.autoAdjust) await refreshGoals(now);
}

export async function deleteWeight(date: string, now: Date = new Date()): Promise<void> {
  await db.weights.delete(date);
  const p = await db.profile.get(1);
  if (p?.autoAdjust) await refreshGoals(now);
}

export const getWeights = (): Promise<WeightLog[]> => db.weights.toArray();

// ───────────── กิจกรรม ─────────────

export interface ActivityInput {
  typeKey: string;
  intensity: Intensity;
  minutes: number;
  date: string;
  time: string;
}

export async function logActivity(input: ActivityInput): Promise<ActivityLog> {
  const type = activityTypeByKey(input.typeKey);
  if (!type) throw new Error(t('ไม่รู้จักกิจกรรม {typeKey}', { typeKey: input.typeKey }));
  if (!(input.minutes > 0)) throw new Error(t('ระยะเวลาต้องมากกว่า 0'));
  const p = await db.profile.get(1);
  const weightKg = latestWeight(await db.weights.toArray())?.kg ?? p?.startWeightKg ?? 60;
  const met = metFor(input.typeKey, input.intensity);
  const row: ActivityLog = {
    date: input.date,
    time: input.time,
    typeKey: input.typeKey,
    name: type.name,
    emoji: type.emoji,
    intensity: input.intensity,
    minutes: input.minutes,
    met,
    weightKg,
    kcal: activityKcal(met, weightKg, input.minutes),
    source: 'manual',
  };
  row.id = await db.activities.add(row);
  return row;
}

export const deleteActivity = (id: number) => db.activities.delete(id);
export const getActivities = (date: string) => db.activities.where('date').equals(date).toArray();

// ───────────── ตั้งเวลาบันทึกอัตโนมัติ ─────────────

export async function saveSchedule(s: Schedule): Promise<number> {
  return db.schedules.put(s);
}
export const deleteSchedule = (id: number) => db.schedules.delete(id);
export async function setScheduleEnabled(id: number, enabled: boolean): Promise<void> {
  await db.schedules.update(id, { enabled });
}

// ───────────── ทั่วไป ─────────────

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** ลบข้อมูลทั้งหมดในเครื่องนี้ */
export async function resetAll(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db[t]) as never, async () => {
    for (const t of ALL_TABLES) await db[t].clear();
  });
}
