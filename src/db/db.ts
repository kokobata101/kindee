import Dexie, { type Table } from 'dexie';
import type { ActivityLog, Combo, Entry, Food, KV, Profile, Schedule, WaterLog, WeightLog } from './types';

/** ฐานข้อมูลทั้งหมดอยู่ใน IndexedDB ของเบราว์เซอร์บนเครื่องผู้ใช้ — ไม่มีการส่งขึ้นเซิร์ฟเวอร์ */
export class KinDeeDB extends Dexie {
  profile!: Table<Profile, number>;
  foods!: Table<Food, string>;
  entries!: Table<Entry, number>;
  water!: Table<WaterLog, number>;
  weights!: Table<WeightLog, string>;
  activities!: Table<ActivityLog, number>;
  schedules!: Table<Schedule, number>;
  kv!: Table<KV, string>;
  combos!: Table<Combo, number>;

  constructor(name = 'kindee') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      foods: 'id,source,name',
      entries: '++id,date,meal,foodId,source',
      water: '++id,date',
      weights: 'date',
      activities: '++id,date',
      schedules: '++id',
      kv: 'key',
    });
    // v2: มื้อประจำ (ตารางใหม่ ข้อมูลเดิมไม่ถูกแตะ)
    this.version(2).stores({ combos: '++id,lastUsedAt' });
  }
}

export const db = new KinDeeDB();

/** ตารางที่ต้องมีในไฟล์สำรองทุกฉบับ (ไฟล์จากรุ่นเก่ายังไม่มี combos) */
export const REQUIRED_TABLES = ['profile', 'foods', 'entries', 'water', 'weights', 'activities', 'schedules', 'kv'] as const;
export const ALL_TABLES = [...REQUIRED_TABLES, 'combos'] as const;
