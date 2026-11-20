import { ALL_TABLES, REQUIRED_TABLES, db } from './db';

import { t } from '../i18n';
import { foodName } from '../lib/names';
import { qtyLabel } from '../lib/diary';
export const BACKUP_APP = 'kindee';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<(typeof REQUIRED_TABLES)[number], unknown[]> & { combos?: unknown[] };
}

export async function exportBackup(now: Date = new Date()): Promise<BackupFile> {
  const data = {} as Record<(typeof ALL_TABLES)[number], unknown[]>;
  for (const t of ALL_TABLES) data[t] = await db[t].toArray();
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export class BackupError extends Error {}

/** ตรวจโครงสร้างไฟล์สำรองก่อนนำเข้า (ไม่เขียนอะไรลงฐานข้อมูล) */
export function parseBackup(text: string): BackupFile {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new BackupError(t('ไฟล์ไม่ใช่รูปแบบ JSON ที่ถูกต้อง'));
  }
  const o = obj as Partial<BackupFile> | null;
  if (!o || o.app !== BACKUP_APP) throw new BackupError(t('นี่ไม่ใช่ไฟล์สำรองของกินดี'));
  if (typeof o.version !== 'number' || o.version > BACKUP_VERSION) {
    throw new BackupError(t('ไฟล์สำรองมาจากเวอร์ชันที่ใหม่กว่า โปรดอัปเดตแอปก่อน'));
  }
  if (!o.data || typeof o.data !== 'object') throw new BackupError(t('ไฟล์สำรองไม่มีข้อมูล'));
  for (const table of REQUIRED_TABLES) {
    if (!Array.isArray((o.data as Record<string, unknown>)[table])) {
      throw new BackupError(t('ไฟล์สำรองขาดข้อมูลส่วน "{table}"', { table }));
    }
  }
  // มื้อประจำเพิ่มมาใน v0.3.0 ไฟล์สำรองเก่าไม่มีส่วนนี้ (ถือว่าว่าง) แต่ถ้ามีต้องถูกต้อง
  const combos = (o.data as Record<string, unknown>).combos;
  if (combos !== undefined) {
    if (!Array.isArray(combos)) throw new BackupError(t('ไฟล์สำรองขาดข้อมูลส่วน "combos"'));
    if (!combos.every(isValidCombo)) throw new BackupError(t('ไฟล์สำรองมีมื้อประจำที่ข้อมูลไม่ถูกต้อง'));
  }
  return o as BackupFile;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isValidCombo(c: unknown): boolean {
  const x = c as Record<string, unknown> | null;
  if (!x || typeof x !== 'object') return false;
  if (typeof x.name !== 'string' || !x.name.trim()) return false;
  if (!Array.isArray(x.items) || x.items.length === 0) return false;
  return x.items.every((i) => {
    const it = i as Record<string, unknown> | null;
    if (!it || typeof it !== 'object') return false;
    const u = it.unit as Record<string, unknown> | null;
    return (
      typeof it.name === 'string' &&
      typeof it.serving === 'string' &&
      typeof it.emoji === 'string' &&
      isNum(it.qty) &&
      it.qty > 0 &&
      !!u &&
      typeof u === 'object' &&
      ['kcal', 'protein', 'carb', 'fat', 'grams'].every((k) => isNum(u[k]))
    );
  });
}

function normalizeCombos(rows: unknown[]): unknown[] {
  return (rows as Record<string, unknown>[]).map((c) => ({
    ...c,
    emoji: typeof c.emoji === 'string' ? c.emoji : '🍱',
    useCount: isNum(c.useCount) ? c.useCount : 0,
    createdAt: isNum(c.createdAt) ? c.createdAt : Date.now(),
  }));
}

export interface ImportSummary {
  entries: number;
  weights: number;
  activities: number;
  water: number;
  customFoods: number;
  combos: number;
}

/** แทนที่ข้อมูลทั้งหมดด้วยข้อมูลในไฟล์สำรอง (ทำในทรานแซกชันเดียว: พังกลางทาง = ไม่เปลี่ยนอะไร) */
export async function importBackup(text: string): Promise<ImportSummary> {
  const b = parseBackup(text);
  await db.transaction('rw', ALL_TABLES.map((t) => db[t]) as never, async () => {
    for (const t of ALL_TABLES) {
      await db[t].clear();
      const raw = (b.data as Record<string, unknown[] | undefined>)[t] ?? [];
      const rows = t === 'combos' ? normalizeCombos(raw) : raw;
      if (rows.length) await (db[t] as unknown as { bulkPut: (r: unknown[]) => Promise<unknown> }).bulkPut(rows);
    }
  });
  return {
    entries: b.data.entries.length,
    weights: b.data.weights.length,
    activities: b.data.activities.length,
    water: b.data.water.length,
    customFoods: b.data.foods.length,
    combos: b.data.combos?.length ?? 0,
  };
}

const csvCell = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** CSV ภาษาไทยเปิดใน Excel ต้องมี BOM ไม่งั้นตัวอักษรเพี้ยน */
export const CSV_BOM = '﻿';

export async function exportCSV(start: string, end: string): Promise<{ foods: string; weights: string; activities: string; water: string }> {
  const [entries, weights, acts, water] = await Promise.all([
    db.entries.where('date').between(start, end, true, true).sortBy('date'),
    db.weights.where('date').between(start, end, true, true).sortBy('date'),
    db.activities.where('date').between(start, end, true, true).sortBy('date'),
    db.water.where('date').between(start, end, true, true).sortBy('date'),
  ]);
  const mealTh: Record<string, string> = { breakfast: t('เช้า'), lunch: t('กลางวัน'), dinner: t('เย็น'), snack: t('ว่าง') };
  return {
    foods: CSV_BOM + toCSV(
      [t('วันที่'), t('เวลา'), t('มื้อ'), t('รายการ'), t('ปริมาณ'), t('กรัม'), t('แคลอรี่(kcal)'), t('โปรตีน(g)'), t('คาร์บ(g)'), t('ไขมัน(g)')],
      entries.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).map((e) => [e.date, e.time, mealTh[e.meal], foodName({ name: e.name, foodId: e.foodId }), qtyLabel(e.qty, e.serving), e.grams, e.kcal, e.protein, e.carb, e.fat]),
    ),
    weights: CSV_BOM + toCSV([t('วันที่'), t('น้ำหนัก(กก.)'), t('หมายเหตุ')], weights.map((w) => [w.date, w.kg, w.note])),
    activities: CSV_BOM + toCSV([t('วันที่'), t('เวลา'), t('กิจกรรม'), t('ความหนัก'), t('นาที'), 'MET', t('เผาผลาญ(kcal)')], acts.map((a) => [a.date, a.time, t(a.name), a.intensity, a.minutes, a.met, a.kcal])),
    water: CSV_BOM + toCSV([t('วันที่'), t('เวลา'), t('มิลลิลิตร')], water.map((w) => [w.date, w.time, w.ml])),
  };
}
