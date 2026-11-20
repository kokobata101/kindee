import { describe, expect, it } from 'vitest';
import { addDays, diffDays, dowIndex, formatThaiDate, formatThaiLong, rangeDays, weekStart } from '../src/lib/date';
import { computeStreak } from '../src/lib/streak';
import { entryFromFood, groupByMeal, qtyLabel, remainingKcal, reviseEntry, scaleNutrients, sumTotals } from '../src/lib/diary';
import { searchFoods } from '../src/lib/search';
import { BUILTIN_FOODS } from '../src/data/foods';
import {
  averageKcal,
  buildBars,
  buildHeatmap,
  isOverGoal,
  macroShare,
  rangeWindow,
  summarizeDays,
  todayTip,
  weeklyInsights,
} from '../src/lib/stats';
import { computeRewards } from '../src/lib/rewards';
import { reachedTarget, weeklyAverages, withDeltas, weightStats } from '../src/lib/weight';
import { guessMeal } from '../src/db/types';
import type { ActivityLog, Entry, WaterLog, WeightLog } from '../src/db/types';

const food = (id: string) => BUILTIN_FOODS.find((f) => f.id === id)!;

describe('วันที่', () => {
  it('2026-10-24 เป็นวันเสาร์ (index 5) และสัปดาห์เริ่มวันจันทร์ 19', () => {
    expect(dowIndex('2026-10-24')).toBe(5);
    expect(weekStart('2026-10-24')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
  });
  it('บวกลบวันข้ามเดือน/ปี', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(diffDays('2026-10-24', '2026-10-17')).toBe(7);
    expect(rangeDays('2026-02-27', 3)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
  it('รูปแบบไทย พ.ศ.', () => {
    expect(formatThaiDate('2026-10-24')).toBe('24 ต.ค. 2569');
    expect(formatThaiLong('2026-10-24')).toBe('วันเสาร์ที่ 24 ต.ค.');
  });
  it('เดามื้อจากเวลา', () => {
    expect(guessMeal(7)).toBe('breakfast');
    expect(guessMeal(12)).toBe('lunch');
    expect(guessMeal(15)).toBe('snack');
    expect(guessMeal(19)).toBe('dinner');
    expect(guessMeal(2)).toBe('snack');
  });
});

describe('สตรีค', () => {
  it('นับต่อเนื่องถึงวันนี้', () => {
    const s = computeStreak(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24');
    expect(s).toEqual({ current: 3, longest: 3, todayDone: true });
  });
  it('วันนี้ยังไม่บันทึก ไม่ตัดสตรีค (นับจากเมื่อวาน)', () => {
    const s = computeStreak(['2026-10-22', '2026-10-23'], '2026-10-24');
    expect(s.current).toBe(2);
    expect(s.todayDone).toBe(false);
  });
  it('ขาดเมื่อวาน = สตรีคปัจจุบัน 0 แต่ longest เก็บไว้', () => {
    const s = computeStreak(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-20'], '2026-10-24');
    expect(s.current).toBe(0);
    expect(s.longest).toBe(3);
  });
  it('ว่าง', () => {
    expect(computeStreak([], '2026-10-24')).toEqual({ current: 0, longest: 0, todayDone: false });
  });
});

describe('ไดอารี่', () => {
  it('คำนวณค่าสารอาหารตามจำนวน (1.5 จาน)', () => {
    const n = scaleNutrients(food('b010'), 1.5);
    expect(n.kcal).toBe(Math.round(585 * 1.5));
    expect(n.protein).toBeCloseTo(39, 5);
  });
  it('reviseEntry คำนวณจาก unit เดิม ไม่คลาดเคลื่อนสะสม', () => {
    let e = entryFromFood(food('b010'), 1, 'lunch', '2026-10-24', '12:20', 'search', 1);
    for (const q of [2, 0.5, 3, 1]) e = reviseEntry(e, { qty: q });
    expect(e.kcal).toBe(585);
    expect(e.protein).toBe(26);
  });
  it('รวมยอดและจัดกลุ่มตามมื้อ เรียงตามเวลา', () => {
    const e1 = entryFromFood(food('b021'), 1, 'breakfast', '2026-10-24', '07:45', 'search');
    const e2 = entryFromFood(food('b122'), 1, 'breakfast', '2026-10-24', '07:00', 'search');
    const e3 = entryFromFood(food('b010'), 1, 'lunch', '2026-10-24', '12:20', 'search');
    const g = groupByMeal([e1, e2, e3]);
    expect(g.breakfast.map((e) => e.time)).toEqual(['07:00', '07:45']);
    expect(g.dinner).toEqual([]);
    expect(sumTotals([e1, e2, e3]).kcal).toBe(330 + 120 + 585);
  });
  it('แคลอรี่คงเหลือ = เป้า − อาหาร + กิจกรรม', () => {
    expect(remainingKcal(1760, 1140, 320)).toBe(940);
  });
  it('ข้อความปริมาณ', () => {
    expect(qtyLabel(2, '1 จาน')).toBe('2 จาน');
    expect(qtyLabel(1.5, '100 กรัม')).toBe('150 กรัม');
    expect(qtyLabel(0.5, '1 ถ้วย')).toBe('0.5 ถ้วย');
    expect(qtyLabel(2, 'ชิ้น')).toBe('2 × ชิ้น');
  });
});

describe('ค้นหาอาหาร', () => {
  it('หาด้วยชื่อไทยบางส่วน', () => {
    const r = searchFoods(BUILTIN_FOODS, 'ส้มตำ');
    expect(r.map((f) => f.name)).toContain('ส้มตำไทย');
  });
  it('หาด้วยชื่ออังกฤษ ไม่สนตัวพิมพ์', () => {
    expect(searchFoods(BUILTIN_FOODS, 'PAD THAI')[0].name).toBe('ผัดไทยกุ้งสด');
  });
  it('คำที่ขึ้นต้นมาก่อนคำที่อยู่กลาง', () => {
    const r = searchFoods(BUILTIN_FOODS, 'ข้าว');
    expect(r[0].name.startsWith('ข้าว')).toBe(true);
  });
  it('ไม่พบ = ว่าง', () => {
    expect(searchFoods(BUILTIN_FOODS, 'zzzzz')).toEqual([]);
  });
});

// ชุดข้อมูลสำหรับทดสอบสถิติ: สัปดาห์ 2026-10-19..25
const mkEntry = (date: string, kcal: number, p: number, c: number, f: number): Entry => ({
  date,
  meal: 'lunch',
  time: '12:00',
  name: 'x',
  emoji: '🍽️',
  serving: '1',
  qty: 1,
  unit: { kcal, protein: p, carb: c, fat: f, grams: 100 },
  grams: 100,
  kcal,
  protein: p,
  carb: c,
  fat: f,
  source: 'search',
  createdAt: 0,
});
const week = rangeDays('2026-10-19', 7);
const entries: Entry[] = [
  mkEntry('2026-10-19', 1700, 120, 190, 55),
  mkEntry('2026-10-20', 2000, 110, 230, 70), // เกินเป้า 1,760
  mkEntry('2026-10-21', 1600, 100, 180, 50),
  mkEntry('2026-10-22', 1750, 125, 200, 55),
  mkEntry('2026-10-23', 1500, 90, 170, 45),
];
const waters: WaterLog[] = week.slice(0, 5).map((date) => ({ date, ml: 2700, time: '10:00' }));
const acts: ActivityLog[] = [
  { date: '2026-10-19', time: '18:00', typeKey: 'run', name: 'วิ่ง', emoji: '🏃', intensity: 'moderate', minutes: 30, met: 9.8, weightKg: 74, kcal: 363, source: 'manual' },
];

describe('สถิติ', () => {
  const days = summarizeDays(week, entries, waters, acts);
  const byDate = new Map(days.map((d) => [d.date, d]));

  it('สรุปรายวัน', () => {
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ kcal: 1700, water: 2700, burned: 363, logged: true });
    expect(days[5].logged).toBe(false);
  });
  it('เกินเป้าเมื่อเกิน 5%', () => {
    expect(isOverGoal(2000, 1760)).toBe(true);
    expect(isOverGoal(1840, 1760)).toBe(false);
  });
  it('ค่าเฉลี่ยนับเฉพาะวันที่บันทึก', () => {
    expect(averageKcal(days)).toBe(Math.round((1700 + 2000 + 1600 + 1750 + 1500) / 5));
  });
  it('สัดส่วนมาโครรวม 100%', () => {
    const m = macroShare(days);
    expect(m.protein + m.carb + m.fat).toBe(100);
    expect(m.avgGrams.protein).toBe(Math.round((120 + 110 + 100 + 125 + 90) / 5));
  });
  it('กราฟสัปดาห์ 7 แท่ง วันอนาคตไม่มีค่า', () => {
    const bars = buildBars('week', '2026-10-24', byDate);
    expect(bars).toHaveLength(7);
    expect(bars[1].value).toBe(2000);
    expect(bars[6].future).toBe(true);
    expect(bars[5].today).toBe(true);
  });
  it('ช่วงของเดือน/ปี', () => {
    expect(rangeWindow('month', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(rangeWindow('year', '2026-10-24')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(buildBars('year', '2026-10-24', byDate)).toHaveLength(12);
  });
  it('heatmap 4 สัปดาห์ = 28 ช่อง จบสัปดาห์ปัจจุบัน', () => {
    const h = buildHeatmap('2026-10-24', byDate, 1760);
    expect(h).toHaveLength(28);
    expect(h[27].date).toBe('2026-10-25');
    expect(h[27].status).toBe('future');
    expect(h.find((c) => c.date === '2026-10-24')!.status).toBe('today-none');
    expect(h.find((c) => c.date === '2026-10-20')!.status).toBe('over');
    expect(h.find((c) => c.date === '2026-10-19')!.status).toBe('ok');
  });
  it('insight: ข้อมูลน้อยกว่า 3 วัน = ขอข้อมูลเพิ่ม', () => {
    const few = summarizeDays(week, entries.slice(0, 2), [], []);
    expect(weeklyInsights('2026-10-24', few, { kcal: 1760, protein: 132, water: 2600 })[0].title).toContain('ยังไม่พอ');
  });
  it('insight: โปรตีนต่ำกว่าเป้าและวันที่เกินเป้า', () => {
    const ins = weeklyInsights('2026-10-24', days, { kcal: 1760, protein: 132, water: 2600 });
    expect(ins.some((i) => i.title.includes('โปรตีนต่ำกว่าเป้า'))).toBe(true);
    expect(ins.some((i) => i.title.includes('กินเกินเป้า 1 วัน'))).toBe(true);
    expect(ins.length).toBeLessThanOrEqual(3);
  });
  it('คำแนะนำประจำวัน', () => {
    const g = { kcal: 1760, protein: 132, water: 2600 };
    expect(todayTip({ kcal: 0, protein: 0, carb: 0, fat: 0 }, g, 0, 0, 9).text).toContain('เริ่มบันทึก');
    expect(todayTip({ kcal: 2100, protein: 100, carb: 0, fat: 0 }, g, 0, 0, 20).tone).toBe('warn');
    expect(todayTip({ kcal: 600, protein: 30, carb: 0, fat: 0 }, g, 0, 1500, 13).text).toContain('โปรตีนยังขาด');
  });
});

describe('น้ำหนัก', () => {
  const logs: WeightLog[] = [
    { date: '2026-09-26', kg: 76.8, createdAt: 0 },
    { date: '2026-10-10', kg: 74.8, createdAt: 0 },
    { date: '2026-10-17', kg: 74.4, createdAt: 0 },
    { date: '2026-10-24', kg: 74.0, createdAt: 0 },
  ];
  it('สถิติเทียบเป้าหมาย', () => {
    const s = weightStats({ startWeightKg: 76.8, targetWeightKg: 70, heightCm: 172, goal: 'lose' }, logs);
    expect(s.current).toBe(74);
    expect(s.change).toBe(-2.8);
    expect(s.remaining).toBe(4);
    expect(s.progress).toBeCloseTo(0.41, 2);
  });
  it('ส่วนต่างจากครั้งก่อน เรียงล่าสุดก่อน', () => {
    const rows = withDeltas(logs);
    expect(rows[0]).toMatchObject({ date: '2026-10-24', delta: -0.4 });
    expect(rows[3].delta).toBeNull();
  });
  it('ค่าเฉลี่ยรายสัปดาห์', () => {
    const w = weeklyAverages(logs, '2026-10-24', 4);
    expect(w).toHaveLength(4);
    expect(w[3].avg).toBe(74);
    expect(w[2].avg).toBe(74.4);
    expect(w[0].avg).toBeNull();
  });
  it('ถึงเป้าหมายตามทิศทาง', () => {
    expect(reachedTarget('lose', 69.9, 70)).toBe(true);
    expect(reachedTarget('lose', 70.1, 70)).toBe(false);
    expect(reachedTarget('gain', 65, 65)).toBe(true);
    expect(reachedTarget('maintain', 70.4, 70)).toBe(true);
  });
});

describe('รางวัล', () => {
  it('ปลดล็อกตามเงื่อนไขจริง', () => {
    const loggedDays = new Set(rangeDays('2026-10-13', 12)); // 12 วันติด ถึง 10-24
    const r = computeRewards({
      today: '2026-10-24',
      loggedDays,
      waterGoalDays: new Set(rangeDays('2026-10-19', 5)),
      proteinGoalDays: new Set(['2026-10-22']),
      scanCount: 38,
      activityCount: 10,
      reachedWeightGoal: false,
    });
    const by = Object.fromEntries(r.badges.map((b) => [b.key, b]));
    expect(by.first.unlocked).toBe(true);
    expect(by.streak7.unlocked).toBe(true);
    expect(by.streak14.unlocked).toBe(false);
    expect(by.streak14.progress).toBe(12);
    expect(by.water5.unlocked).toBe(true);
    expect(by.protein3.unlocked).toBe(false);
    expect(by.scan50.progress).toBe(38);
    expect(by.move10.unlocked).toBe(true);
    expect(by.goal.unlocked).toBe(false);
    expect(r.streak.current).toBe(12);
    expect(r.nextStreakGoal).toBe(14);
    expect(r.streakSince).toBe('2026-10-13');
    // ปลดล็อก: เริ่มต้น, ไฟลุก 7 วัน, ดื่มน้ำครบ, ขยับตัว = 4
    expect(r.unlockedCount).toBe(4);
  });
});
