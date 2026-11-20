import { db } from './db';
import type { Entry, Schedule } from './types';
import { dowIndex, nowHM, toISO } from '../lib/date';

/**
 * รายการตั้งเวลาที่ "ถึงเวลาแล้วและยังไม่ได้รัน" ของวันนี้
 * เงื่อนไข: เปิดอยู่ + วันนี้อยู่ในวันที่เลือก + เวลาถึงแล้ว + ยังไม่เคยรันวันนี้
 *
 * ข้อจำกัด (เว็บแอป): ทำงานตอนที่เปิดแอป/กลับมาที่แอป ไม่ได้ทำงานตอนปิดแอปอยู่
 * เมื่อเปิดแอป จะบันทึกย้อนให้ครบทุกรายการที่เลยเวลาไปแล้วของวันนั้น (ใส่เวลาตามที่ตั้งไว้)
 */
export function dueSchedules(schedules: Schedule[], now: Date): Schedule[] {
  const today = toISO(now);
  const dow = dowIndex(today);
  const hm = nowHM(now);
  return schedules.filter(
    (s) => s.enabled && s.days.includes(dow) && s.time <= hm && s.lastRunDate !== today && s.items.length > 0,
  );
}

/** รันรายการที่ถึงเวลา คืนจำนวนรายการอาหารที่บันทึก */
export async function runDueSchedules(now: Date = new Date()): Promise<number> {
  const today = toISO(now);
  return db.transaction('rw', db.schedules, db.entries, async () => {
    const due = dueSchedules(await db.schedules.toArray(), now);
    let count = 0;
    for (const s of due) {
      // กันรันซ้ำจากหลายแท็บ: อ่านซ้ำภายในทรานแซกชัน
      const fresh = await db.schedules.get(s.id!);
      if (!fresh || fresh.lastRunDate === today) continue;
      const entries: Entry[] = fresh.items.map((it, i) => ({
        date: today,
        meal: fresh.meal,
        time: fresh.time,
        foodId: it.foodId,
        name: it.name,
        emoji: it.emoji,
        serving: it.serving,
        qty: it.qty,
        unit: {
          kcal: it.qty ? it.kcal / it.qty : it.kcal,
          protein: it.qty ? it.protein / it.qty : it.protein,
          carb: it.qty ? it.carb / it.qty : it.carb,
          fat: it.qty ? it.fat / it.qty : it.fat,
          grams: it.qty ? it.grams / it.qty : it.grams,
        },
        grams: it.grams,
        kcal: it.kcal,
        protein: it.protein,
        carb: it.carb,
        fat: it.fat,
        source: 'scheduled',
        createdAt: now.getTime() + i,
      }));
      await db.entries.bulkAdd(entries);
      await db.schedules.update(fresh.id!, { lastRunDate: today });
      count += entries.length;
    }
    return count;
  });
}
