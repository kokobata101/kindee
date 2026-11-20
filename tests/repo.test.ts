import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import * as repo from '../src/db/repo';
import { dueSchedules, runDueSchedules } from '../src/db/scheduler';
import { exportBackup, exportCSV, importBackup, parseBackup, toCSV, BackupError } from '../src/db/backup';
import { BUILTIN_BY_ID } from '../src/data/foods';
import { scheduleItemFromFood } from '../src/lib/diary';
import type { Profile, Schedule } from '../src/db/types';

const baseProfile: Omit<Profile, 'id' | 'createdAt'> = {
  name: 'มะนาว',
  sex: 'male',
  birthYear: 1998,
  heightCm: 172,
  startWeightKg: 76.8,
  targetWeightKg: 70,
  goal: 'lose',
  pace: 0.5,
  activity: 'light',
  presetKey: 'balanced',
  split: { protein: 30, carb: 40, fat: 30 },
  kcalGoal: 1760,
  kcalManual: false,
  waterGoalMl: 2600,
  waterManual: false,
  autoAdjust: true,
  theme: 'system',
};
const NOW = new Date(2026, 9, 24, 12, 30); // 24 ต.ค. 2026 12:30 (วันเสาร์)
const food = (id: string) => BUILTIN_BY_ID.get(id)!;

beforeEach(async () => {
  await repo.resetAll();
});

describe('โปรไฟล์และน้ำหนัก', () => {
  it('สร้างโปรไฟล์พร้อมบันทึกน้ำหนักเริ่มต้น', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    expect((await repo.getProfile())?.name).toBe('มะนาว');
    expect(await repo.getWeights()).toEqual([expect.objectContaining({ date: '2026-10-01', kg: 76.8 })]);
  });

  it('บันทึกน้ำหนักใหม่ → ปรับเป้าแคลอรี่/น้ำอัตโนมัติ', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    await repo.setWeight('2026-10-24', 70, undefined, NOW);
    const p = (await repo.getProfile())!;
    // BMR = 10*70 + 6.25*172 - 5*28 + 5 = 1640; ×1.375 = 2255; −550 = 1705 → ปัด 1,710 (ปัด 1705→1710)
    expect(p.kcalGoal).toBe(1710);
    expect(p.waterGoalMl).toBe(2450);
  });

  it('เป้าที่ตั้งเอง (manual) ไม่ถูกเขียนทับ', async () => {
    await repo.createProfile({ ...baseProfile, kcalManual: true, kcalGoal: 1900 }, '2026-10-01');
    await repo.setWeight('2026-10-24', 70, undefined, NOW);
    expect((await repo.getProfile())!.kcalGoal).toBe(1900);
    expect((await repo.getProfile())!.waterGoalMl).toBe(2450);
  });

  it('ปิดปรับอัตโนมัติ = เป้าไม่เปลี่ยน', async () => {
    await repo.createProfile({ ...baseProfile, autoAdjust: false }, '2026-10-01');
    await repo.setWeight('2026-10-24', 70, undefined, NOW);
    expect((await repo.getProfile())!.kcalGoal).toBe(1760);
  });

  it('บันทึกน้ำหนักวันเดิมซ้ำ = แทนที่ ไม่เพิ่มแถว', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    await repo.setWeight('2026-10-24', 75, undefined, NOW);
    await repo.setWeight('2026-10-24', 74.6, 'หลังตื่นนอน', NOW);
    const ws = await repo.getWeights();
    expect(ws.filter((w) => w.date === '2026-10-24')).toHaveLength(1);
    expect(ws.find((w) => w.date === '2026-10-24')!.kg).toBe(74.6);
  });
});

describe('อาหารและไดอารี่', () => {
  it('เพิ่ม แก้จำนวน ลบ รายการ', async () => {
    const id = await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-24', '12:20');
    expect((await repo.getEntries('2026-10-24'))[0].kcal).toBe(585);
    await repo.updateEntry(id, { qty: 2, meal: 'dinner' });
    const e = (await repo.getEntries('2026-10-24'))[0];
    expect(e).toMatchObject({ kcal: 1170, meal: 'dinner', qty: 2 });
    await repo.deleteEntry(id);
    expect(await repo.getEntries('2026-10-24')).toHaveLength(0);
  });

  it('สร้างอาหารของฉัน แล้วค้นเจอ และเพิ่มลงไดอารี่ได้', async () => {
    const f = await repo.saveCustomFood({ name: 'น้ำพริกแม่บ้าน', emoji: '🌶️', serving: '1 ช้อนโต๊ะ', grams: 20, kcal: 60, protein: 1, carb: 5, fat: 4 });
    expect((await repo.allFoods()).some((x) => x.id === f.id && x.source === 'custom')).toBe(true);
    expect(await repo.getFood(f.id)).toMatchObject({ name: 'น้ำพริกแม่บ้าน' });
    await repo.addFoodEntry(f, 2, 'lunch', '2026-10-24', '12:00');
    expect((await repo.getEntries('2026-10-24'))[0].kcal).toBe(120);
    await repo.deleteCustomFood(f.id);
    expect(await repo.getFood(f.id)).toBeUndefined();
  });

  it('รายการโปรด สลับเปิด/ปิด', async () => {
    expect(await repo.toggleFavorite('b010')).toBe(true);
    expect(await repo.getFavoriteIds()).toEqual(['b010']);
    expect(await repo.toggleFavorite('b010')).toBe(false);
    expect(await repo.getFavoriteIds()).toEqual([]);
  });

  it('อาหารล่าสุด ไม่ซ้ำ เรียงล่าสุดก่อน', async () => {
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-23', '12:00');
    await repo.addFoodEntry(food('b122'), 1, 'breakfast', '2026-10-24', '08:00');
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-24', '12:00');
    expect((await repo.recentFoods()).map((f) => f.id)).toEqual(['b010', 'b122']);
  });

  it('คัดลอกจากวันก่อนหน้า', async () => {
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-22', '12:00');
    await repo.addFoodEntry(food('b122'), 1, 'breakfast', '2026-10-22', '08:00');
    expect(await repo.findPreviousLoggedDay('2026-10-24')).toBe('2026-10-22');
    expect(await repo.findPreviousLoggedDay('2026-10-24', 1)).toBeNull();
    expect(await repo.copyDay('2026-10-22', '2026-10-24')).toBe(2);
    const copied = await repo.getEntries('2026-10-24');
    expect(copied).toHaveLength(2);
    expect(copied.every((e) => e.source === 'copy')).toBe(true);
    expect(await repo.getEntries('2026-10-22')).toHaveLength(2);
  });

  it('คัดลอกเฉพาะมื้อที่เลือก', async () => {
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-22', '12:00');
    await repo.addFoodEntry(food('b122'), 1, 'breakfast', '2026-10-22', '08:00');
    expect(await repo.copyDay('2026-10-22', '2026-10-24', ['breakfast'])).toBe(1);
  });
});

describe('น้ำและกิจกรรม', () => {
  it('เพิ่ม/ลบน้ำ', async () => {
    const a = await repo.addWater(250, '2026-10-24', '08:05');
    await repo.addWater(500, '2026-10-24', '10:30');
    expect((await repo.getWater('2026-10-24')).reduce((s, w) => s + w.ml, 0)).toBe(750);
    await repo.deleteWater(a);
    expect((await repo.getWater('2026-10-24')).reduce((s, w) => s + w.ml, 0)).toBe(500);
  });

  it('กิจกรรมคำนวณจาก MET × น้ำหนักล่าสุด', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    await repo.setWeight('2026-10-20', 74, undefined, NOW);
    const a = await repo.logActivity({ typeKey: 'walk', intensity: 'moderate', minutes: 40, date: '2026-10-24', time: '07:00' });
    expect(a).toMatchObject({ met: 3.8, weightKg: 74, kcal: 187, source: 'manual' });
    expect(await repo.getActivities('2026-10-24')).toHaveLength(1);
  });

  it('ปฏิเสธกิจกรรมที่ไม่รู้จัก / 0 นาที', async () => {
    await expect(repo.logActivity({ typeKey: 'nope', intensity: 'light', minutes: 10, date: '2026-10-24', time: '07:00' })).rejects.toThrow();
    await expect(repo.logActivity({ typeKey: 'run', intensity: 'light', minutes: 0, date: '2026-10-24', time: '07:00' })).rejects.toThrow();
  });
});

describe('ตั้งเวลาบันทึกอัตโนมัติ', () => {
  const sched = (over: Partial<Schedule> = {}): Schedule => ({
    name: 'โจ๊ก',
    emoji: '🥣',
    meal: 'breakfast',
    time: '07:30',
    days: [0, 1, 2, 3, 4, 5, 6],
    items: [scheduleItemFromFood(food('b021'), 1)],
    enabled: true,
    ...over,
  });

  it('เลือกเฉพาะที่ถึงเวลา เปิดอยู่ วันตรง และยังไม่รัน', () => {
    const list = [
      sched({ id: 1 }),
      sched({ id: 2, time: '16:00' }), // ยังไม่ถึงเวลา
      sched({ id: 3, enabled: false }),
      sched({ id: 4, days: [0] }), // จันทร์เท่านั้น แต่วันนี้เสาร์
      sched({ id: 5, lastRunDate: '2026-10-24' }),
      sched({ id: 6, items: [] }),
    ];
    expect(dueSchedules(list, NOW).map((s) => s.id)).toEqual([1]);
  });

  it('รันแล้วบันทึกอาหารจริง และไม่รันซ้ำ', async () => {
    await repo.saveSchedule(sched());
    expect(await runDueSchedules(NOW)).toBe(1);
    const e = await repo.getEntries('2026-10-24');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ source: 'scheduled', time: '07:30', meal: 'breakfast', kcal: 330 });
    expect(await runDueSchedules(NOW)).toBe(0);
    expect(await repo.getEntries('2026-10-24')).toHaveLength(1);
    // วันถัดไปรันใหม่ได้
    expect(await runDueSchedules(new Date(2026, 9, 25, 9, 0))).toBe(1);
  });

  it('รันพร้อมกันหลายครั้ง (สองแท็บ) ไม่บันทึกซ้ำ', async () => {
    await repo.saveSchedule(sched());
    await Promise.all([runDueSchedules(NOW), runDueSchedules(NOW)]);
    expect(await repo.getEntries('2026-10-24')).toHaveLength(1);
  });

  it('แก้จำนวนของรายการที่ตั้งเวลา แล้วค่าสารอาหารยังถูกต้อง', async () => {
    await repo.saveSchedule(sched({ items: [scheduleItemFromFood(food('b122'), 2)] }));
    await runDueSchedules(NOW);
    const e = (await repo.getEntries('2026-10-24'))[0];
    expect(e.kcal).toBe(240);
    // unit ถูกหารกลับเป็นต่อ 1 หน่วย เพื่อให้แก้จำนวนต่อได้
    expect(e.unit.kcal).toBe(120);
  });
});

describe('สำรองและกู้คืน', () => {
  it('ส่งออก → ล้าง → นำเข้า ข้อมูลกลับมาครบ', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-24', '12:20');
    await repo.addWater(250, '2026-10-24', '08:00');
    await repo.saveCustomFood({ name: 'เมนูฉัน', emoji: '🍲', serving: '1 ถ้วย', grams: 200, kcal: 150, protein: 8, carb: 20, fat: 4 });
    const backup = await exportBackup(NOW);
    const text = JSON.stringify(backup);
    await repo.resetAll();
    expect(await repo.getProfile()).toBeUndefined();
    const s = await importBackup(text);
    expect(s).toMatchObject({ entries: 1, water: 1, weights: 1, customFoods: 1 });
    expect((await repo.getProfile())!.name).toBe('มะนาว');
    expect((await repo.getEntries('2026-10-24'))[0].name).toBe('ข้าวมันไก่');
  });

  it('ไฟล์ผิดรูปแบบถูกปฏิเสธ และข้อมูลเดิมไม่เสียหาย', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    await expect(importBackup('ไม่ใช่ json')).rejects.toBeInstanceOf(BackupError);
    await expect(importBackup(JSON.stringify({ app: 'other' }))).rejects.toThrow('ไม่ใช่ไฟล์สำรองของกินดี');
    await expect(importBackup(JSON.stringify({ app: 'kindee', version: 99, data: {} }))).rejects.toThrow('ใหม่กว่า');
    await expect(importBackup(JSON.stringify({ app: 'kindee', version: 1, data: { profile: [] } }))).rejects.toThrow('ขาดข้อมูล');
    expect((await repo.getProfile())!.name).toBe('มะนาว');
    expect(() => parseBackup('{}')).toThrow();
  });

  it('CSV: escape เครื่องหมายคำพูด/ลูกน้ำ และมี BOM สำหรับ Excel', async () => {
    expect(toCSV(['a', 'b'], [['x,y', 'say "hi"'], [1, undefined]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n1,');
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-24', '12:20');
    await repo.setWeight('2026-10-24', 74, 'เช้า', NOW);
    const csv = await exportCSV('2026-10-20', '2026-10-26');
    expect(csv.foods.startsWith('﻿')).toBe(true);
    expect(csv.foods).toContain('ข้าวมันไก่');
    expect(csv.foods).toContain('585');
    expect(csv.weights).toContain('2026-10-24,74,เช้า');
  });

  it('ลบข้อมูลทั้งหมด', async () => {
    await repo.createProfile(baseProfile, '2026-10-01');
    await repo.addFoodEntry(food('b010'), 1, 'lunch', '2026-10-24', '12:20');
    await repo.resetAll();
    expect(await db.entries.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
    expect(await db.weights.count()).toBe(0);
  });
});
