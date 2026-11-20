import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, KinDeeDB } from '../src/db/db';
import * as repo from '../src/db/repo';
import { BackupError, exportBackup, importBackup, parseBackup } from '../src/db/backup';
import { BUILTIN_BY_ID } from '../src/data/foods';
import { comboItemFromFood, comboTotals, scheduleItemsFromCombo } from '../src/lib/combo';
import { runDueSchedules } from '../src/db/scheduler';

const foods = [...BUILTIN_BY_ID.values()];
const items = () => [comboItemFromFood(foods[0], 1), comboItemFromFood(foods[1], 2)];

beforeEach(async () => {
  await repo.resetAll();
});

describe('แคลอรี่ด่วน (ฐานข้อมูล)', () => {
  it('เพิ่มแล้วเห็นในรายการของวัน และแก้ไข/ลบได้', async () => {
    const id = await repo.addQuickEntry({ kcal: 400, name: 'ข้าวร้านป้า', protein: 20 }, 'lunch', '2026-11-10', '12:00');
    let day = await repo.getEntries('2026-11-10');
    expect(day).toHaveLength(1);
    expect(day[0]).toMatchObject({ kcal: 400, protein: 20, source: 'quick', name: 'ข้าวร้านป้า' });
    await repo.updateQuickEntry(id, { kcal: 300, name: '', meal: 'snack' });
    day = await repo.getEntries('2026-11-10');
    expect(day[0]).toMatchObject({ kcal: 300, name: 'แคลอรี่ด่วน', meal: 'snack', protein: 0 });
    await repo.deleteEntry(id);
    expect(await repo.getEntries('2026-11-10')).toHaveLength(0);
  });

  it('ปฏิเสธแคลอรี่ที่ไม่ถูกต้อง', async () => {
    await expect(repo.addQuickEntry({ kcal: 0 }, 'lunch', '2026-11-10', '12:00')).rejects.toThrow();
    expect(await db.entries.count()).toBe(0);
  });

  it('คัดลอกจากวันก่อนแล้วยังเป็นรายการด่วน (ยังแก้แคลอรี่ได้)', async () => {
    await repo.addQuickEntry({ kcal: 400 }, 'lunch', '2026-11-09', '12:00');
    await repo.addFoodEntry(foods[0], 1, 'lunch', '2026-11-09', '12:30');
    await repo.copyDay('2026-11-09', '2026-11-10');
    const copied = await repo.getEntries('2026-11-10');
    expect(copied.map((e) => e.source).sort()).toEqual(['copy', 'quick']);
  });
});

describe('มื้อประจำ (ฐานข้อมูล)', () => {
  it('บันทึก/แก้ชื่อและจำนวน/ลบ และเก็บสถิติการใช้ไว้ตอนแก้', async () => {
    const c = await repo.saveCombo({ name: ' มื้อเช้า ', items: items() }, 1000);
    expect(c).toMatchObject({ name: 'มื้อเช้า', emoji: '🍱', useCount: 0, createdAt: 1000 });
    expect(c.id).toBeTypeOf('number');
    await repo.addComboToDay(c.id!, 'breakfast', '2026-11-10', '08:00', 1, 2000);
    const edited = await repo.saveCombo({ id: c.id, name: 'เช้าประจำ', items: [comboItemFromFood(foods[0], 2)] }, 3000);
    expect(edited).toMatchObject({ name: 'เช้าประจำ', useCount: 1, lastUsedAt: 2000, createdAt: 1000 });
    expect(edited.items).toHaveLength(1);
    await repo.deleteCombo(c.id!);
    expect(await repo.getCombos()).toEqual([]);
  });

  it('ตรวจข้อมูลก่อนบันทึก: ชื่อว่าง/ไม่มีรายการ/จำนวนไม่ถูกต้อง/ไม่พบ id', async () => {
    await expect(repo.saveCombo({ name: '  ', items: items() })).rejects.toThrow();
    await expect(repo.saveCombo({ name: 'x', items: [] })).rejects.toThrow();
    await expect(repo.saveCombo({ name: 'x', items: [{ ...items()[0], qty: 0 }] })).rejects.toThrow();
    await expect(repo.saveCombo({ id: 999, name: 'x', items: items() })).rejects.toThrow();
    expect(await db.combos.count()).toBe(0);
  });

  it('เพิ่มลงไดอารี่: ได้รายการครบ ยอดตรง และนับการใช้', async () => {
    const c = await repo.saveCombo({ name: 'ชุด', items: items() });
    const r = await repo.addComboToDay(c.id!, 'dinner', '2026-11-10', '18:30', 2);
    expect(r.count).toBe(2);
    const day = await repo.getEntries('2026-11-10');
    expect(day).toHaveLength(2);
    expect(day.reduce((s, e) => s + e.kcal, 0)).toBe(r.kcal);
    expect(day.map((e) => e.qty).sort()).toEqual([2, 4]);
    expect((await db.combos.get(c.id!))!.useCount).toBe(1);
    await repo.addComboToDay(c.id!, 'dinner', '2026-11-10', '18:30');
    expect(await db.entries.count()).toBe(4);
    expect((await db.combos.get(c.id!))!.useCount).toBe(2);
  });

  it('มื้อประจำที่ถูกลบแล้ว: เพิ่มไม่ได้ และไม่เกิดรายการค้าง', async () => {
    await expect(repo.addComboToDay(12345, 'lunch', '2026-11-10', '12:00')).rejects.toThrow();
    expect(await db.entries.count()).toBe(0);
  });

  it('ใช้ล่าสุดขึ้นก่อน', async () => {
    const a = await repo.saveCombo({ name: 'A', items: items() }, 1000);
    const b = await repo.saveCombo({ name: 'B', items: items() }, 2000);
    expect((await repo.getCombos()).map((c) => c.name)).toEqual(['B', 'A']);
    await repo.addComboToDay(a.id!, 'lunch', '2026-11-10', '12:00', 1, 3000);
    expect((await repo.getCombos()).map((c) => c.name)).toEqual(['A', 'B']);
    expect(b.id).not.toBe(a.id);
  });

  it('ลบมื้อประจำแล้วรายการที่เคยเพิ่มลงไดอารี่ยังอยู่', async () => {
    const c = await repo.saveCombo({ name: 'ชุด', items: items() });
    await repo.addComboToDay(c.id!, 'lunch', '2026-11-10', '12:00');
    await repo.deleteCombo(c.id!);
    expect(await db.entries.count()).toBe(2);
  });
});

describe('สำรอง/กู้คืนมื้อประจำ', () => {
  it('สำรอง → ลบทั้งหมด → กู้คืน แล้วมื้อประจำกลับมาครบ', async () => {
    const c = await repo.saveCombo({ name: 'ชุดโปรด', items: items() });
    await repo.addComboToDay(c.id!, 'lunch', '2026-11-10', '12:00');
    const text = JSON.stringify(await exportBackup());
    await repo.resetAll();
    expect(await db.combos.count()).toBe(0);
    const s = await importBackup(text);
    expect(s.combos).toBe(1);
    const got = await repo.getCombos();
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ name: 'ชุดโปรด', useCount: 1 });
    expect(got[0].items).toHaveLength(2);
  });

  it('ไฟล์สำรองรุ่นเก่า (ไม่มี combos) กู้คืนได้ และล้างมื้อประจำเดิม', async () => {
    await repo.saveCombo({ name: 'เดิม', items: items() });
    const b = await exportBackup();
    const old = JSON.parse(JSON.stringify(b));
    delete old.data.combos;
    const s = await importBackup(JSON.stringify(old));
    expect(s.combos).toBe(0);
    expect(await db.combos.count()).toBe(0);
  });

  it('มื้อประจำที่ข้อมูลเสียทำให้ปฏิเสธทั้งไฟล์ และไม่แตะข้อมูลเดิม', async () => {
    await repo.saveCombo({ name: 'เดิม', items: items() });
    const b = JSON.parse(JSON.stringify(await exportBackup()));
    b.data.combos = [{ name: 'เสีย', items: [{ name: 'x' }] }];
    expect(() => parseBackup(JSON.stringify(b))).toThrow(BackupError);
    await expect(importBackup(JSON.stringify(b))).rejects.toThrow(BackupError);
    expect((await repo.getCombos()).map((c) => c.name)).toEqual(['เดิม']);
    b.data.combos = 'oops';
    expect(() => parseBackup(JSON.stringify(b))).toThrow(BackupError);
  });
});

describe('อัปเกรดฐานข้อมูล v1 → v2', () => {
  it('ข้อมูลเดิมอยู่ครบ และมีตารางมื้อประจำใช้ได้', async () => {
    const name = `upgrade-${Math.random().toString(36).slice(2)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      profile: 'id', foods: 'id,source,name', entries: '++id,date,meal,foodId,source', water: '++id,date',
      weights: 'date', activities: '++id,date', schedules: '++id', kv: 'key',
    });
    await v1.table('entries').add({ date: '2026-11-01', meal: 'lunch', name: 'เก่า', kcal: 100 });
    await v1.table('kv').put({ key: 'k', value: 1 });
    v1.close();

    const v2 = new KinDeeDB(name);
    await v2.open();
    expect(await v2.entries.count()).toBe(1);
    expect((await v2.kv.get('k'))?.value).toBe(1);
    const id = await v2.combos.add({ name: 'ใหม่', emoji: '🍱', items: items(), useCount: 0, createdAt: 1 });
    expect(id).toBeTypeOf('number');
    v2.close();
    await Dexie.delete(name);
  });
});

describe('มื้อประจำในตารางเวลา', () => {
  it('แปลงเป็นรายการตั้งเวลาโดยตัวเลขตรงกับยอดของมื้อประจำ และบันทึกลงไดอารี่ตามเวลา', async () => {
    const combo = await repo.saveCombo({ name: 'เช้าประจำ', items: items() });
    const si = scheduleItemsFromCombo(combo);
    expect(si).toHaveLength(2);
    expect(si.reduce((a, i) => a + i.kcal, 0)).toBeCloseTo(comboTotals(combo.items).kcal, 5);
    expect(si[1].qty).toBe(2);

    await repo.saveSchedule({ name: combo.name, emoji: combo.emoji, meal: 'breakfast', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], items: si, enabled: true });
    const now = new Date('2026-11-10T09:00:00+07:00');
    expect(await runDueSchedules(now)).toBe(2);
    const day = await repo.getEntries('2026-11-10');
    expect(day.map((e) => e.source)).toEqual(['scheduled', 'scheduled']);
    expect(day.reduce((a, e) => a + e.kcal, 0)).toBeCloseTo(comboTotals(combo.items).kcal, 5);
  });

  it('เป็นสำเนา: แก้/ลบมื้อประจำภายหลังไม่กระทบตารางเวลา', async () => {
    const combo = await repo.saveCombo({ name: 'ชุด', items: items() });
    const si = scheduleItemsFromCombo(combo);
    await repo.deleteCombo(combo.id!);
    expect(si).toHaveLength(2);
    expect(si[0].kcal).toBeGreaterThan(0);
  });

  it('ปรับจำนวนส่วนได้', () => {
    const combo = { name: 'x', emoji: '🍱', items: items(), useCount: 0, createdAt: 1 };
    const half = scheduleItemsFromCombo(combo, 0.5);
    expect(half[1].qty).toBe(1);
    expect(half[0].qty).toBe(0.5);
  });
});
