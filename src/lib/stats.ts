import type { ActivityLog, Entry, WaterLog } from '../db/types';
import { addDays, dowIndex, rangeDays, THAI_DOW_FULL, THAI_DOW_SHORT, weekStart, parseISO } from './date';
import type { Totals } from './diary';

import { lang, t } from '../i18n';
export interface DaySummary extends Totals {
  date: string;
  water: number;
  burned: number;
  logged: boolean;
  entryCount: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeDays(
  dates: string[],
  entries: Entry[],
  water: WaterLog[],
  acts: ActivityLog[],
): DaySummary[] {
  const idx = new Map<string, DaySummary>();
  for (const date of dates) {
    idx.set(date, { date, kcal: 0, protein: 0, carb: 0, fat: 0, water: 0, burned: 0, logged: false, entryCount: 0 });
  }
  for (const e of entries) {
    const s = idx.get(e.date);
    if (!s) continue;
    s.kcal += e.kcal;
    s.protein += e.protein;
    s.carb += e.carb;
    s.fat += e.fat;
    s.logged = true;
    s.entryCount++;
  }
  for (const w of water) {
    const s = idx.get(w.date);
    if (s) s.water += w.ml;
  }
  for (const a of acts) {
    const s = idx.get(a.date);
    if (s) s.burned += a.kcal;
  }
  return dates.map((d) => {
    const s = idx.get(d)!;
    return { ...s, kcal: Math.round(s.kcal), protein: r1(s.protein), carb: r1(s.carb), fat: r1(s.fat) };
  });
}

/** เกินเป้า = มากกว่าเป้า 5% ขึ้นไป (เกินนิดหน่อยไม่นับ) */
export const isOverGoal = (kcal: number, goal: number) => goal > 0 && kcal > goal * 1.05;

/** ค่าเฉลี่ยแคลอรี่ต่อวัน นับเฉพาะวันที่มีการบันทึก */
export function averageKcal(days: DaySummary[]): number {
  const logged = days.filter((d) => d.logged);
  if (!logged.length) return 0;
  return Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length);
}

export interface MacroShare {
  protein: number;
  carb: number;
  fat: number;
  /** ค่าเฉลี่ยกรัมต่อวัน */
  avgGrams: { protein: number; carb: number; fat: number };
}

/** สัดส่วนพลังงานจากโปรตีน/คาร์บ/ไขมัน (%) รวมเป็น 100 */
export function macroShare(days: DaySummary[]): MacroShare {
  const logged = days.filter((d) => d.logged);
  const n = Math.max(1, logged.length);
  const p = logged.reduce((a, d) => a + d.protein, 0);
  const c = logged.reduce((a, d) => a + d.carb, 0);
  const f = logged.reduce((a, d) => a + d.fat, 0);
  const total = 4 * p + 4 * c + 9 * f;
  const avgGrams = { protein: Math.round(p / n), carb: Math.round(c / n), fat: Math.round(f / n) };
  if (total <= 0) return { protein: 0, carb: 0, fat: 0, avgGrams };
  const pp = Math.round((4 * p * 100) / total);
  const cp = Math.round((4 * c * 100) / total);
  return { protein: pp, carb: cp, fat: 100 - pp - cp, avgGrams };
}

export type StatsRange = 'week' | 'month' | 'year';

export interface Bar {
  label: string;
  value: number;
  date?: string;
  future?: boolean;
  today?: boolean;
}

/** ช่วงวันที่ที่ต้องโหลดข้อมูลสำหรับกราฟ */
export function rangeWindow(range: StatsRange, today: string): { start: string; end: string } {
  if (range === 'week') {
    const s = weekStart(today);
    return { start: s, end: addDays(s, 6) };
  }
  if (range === 'month') {
    const d = parseISO(today);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { start, end: addDays(start, last - 1) };
  }
  const y = parseISO(today).getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

const MONTH_LABELS = [t('ม.ค.'), t('ก.พ.'), t('มี.ค.'), t('เม.ย.'), t('พ.ค.'), t('มิ.ย.'), t('ก.ค.'), t('ส.ค.'), t('ก.ย.'), t('ต.ค.'), t('พ.ย.'), t('ธ.ค.')];

/** แท่งกราฟแคลอรี่: สัปดาห์/เดือน = รายวัน, ปี = ค่าเฉลี่ยรายเดือน (เฉพาะวันที่บันทึก) */
export function buildBars(range: StatsRange, today: string, byDate: Map<string, DaySummary>): Bar[] {
  const { start, end } = rangeWindow(range, today);
  if (range === 'year') {
    const y = parseISO(today).getFullYear();
    return MONTH_LABELS.map((label, m) => {
      const days = [...byDate.values()].filter((d) => d.logged && parseISO(d.date).getFullYear() === y && parseISO(d.date).getMonth() === m);
      const value = days.length ? Math.round(days.reduce((a, d) => a + d.kcal, 0) / days.length) : 0;
      return { label, value, future: m > parseISO(today).getMonth(), today: m === parseISO(today).getMonth() };
    });
  }
  const n = range === 'week' ? 7 : parseISO(end).getDate();
  return rangeDays(start, n).map((date, i) => {
    const s = byDate.get(date);
    return {
      date,
      label: range === 'week' ? THAI_DOW_SHORT[i] : String(i + 1),
      value: s?.logged ? s.kcal : 0,
      future: date > today,
      today: date === today,
    };
  });
}

export type HeatStatus = 'ok' | 'over' | 'none' | 'future' | 'today-none' | 'today-ok' | 'today-over';

export interface HeatCell {
  date: string;
  status: HeatStatus;
}

/** ตารางสตรีค 4 สัปดาห์ (จันทร์–อาทิตย์) จบที่สัปดาห์ปัจจุบัน */
export function buildHeatmap(today: string, byDate: Map<string, DaySummary>, goal: number, weeks = 4): HeatCell[] {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  return rangeDays(start, weeks * 7).map((date) => {
    const s = byDate.get(date);
    const isToday = date === today;
    if (date > today) return { date, status: 'future' as const };
    const base: 'ok' | 'over' | 'none' = !s?.logged ? 'none' : isOverGoal(s.kcal, goal) ? 'over' : 'ok';
    const status = (isToday ? `today-${base}` : base) as HeatStatus;
    return { date, status };
  });
}

export interface Insight {
  tone: 'good' | 'warn' | 'info';
  icon: 'sparkle' | 'pulse' | 'drop' | 'trophy';
  title: string;
  body: string;
}

const dayName = (iso: string) => (lang === 'th' ? THAI_DOW_FULL[dowIndex(iso)].replace('วัน', '') : THAI_DOW_FULL[dowIndex(iso)]);

/**
 * ข้อมูลเชิงลึกจาก 7 วันที่ผ่านมา (ไม่นับวันนี้ เพราะยังบันทึกไม่ครบ)
 * ทุกข้อความคำนวณจากข้อมูลจริงของผู้ใช้ ไม่ใช่ข้อความสุ่ม
 */
export function weeklyInsights(
  today: string,
  days: DaySummary[],
  goals: { kcal: number; protein: number; water: number },
): Insight[] {
  const past = days.filter((d) => d.date < today && d.date >= addDays(today, -7));
  const logged = past.filter((d) => d.logged);
  if (logged.length < 3) {
    return [
      {
        tone: 'info',
        icon: 'sparkle',
        title: t('ข้อมูลยังไม่พอสำหรับสรุป'),
        body: t('บันทึกอาหารอย่างน้อย 3 วัน แล้วแอปจะสรุปให้ว่าควรปรับอะไร'),
      },
    ];
  }
  const out: Insight[] = [];

  const lowProtein = logged.filter((d) => d.protein < goals.protein * 0.9);
  if (lowProtein.length >= Math.ceil(logged.length / 2)) {
    const avg = Math.round(logged.reduce((a, d) => a + d.protein, 0) / logged.length);
    out.push({
      tone: 'warn',
      icon: 'sparkle',
      title: t('โปรตีนต่ำกว่าเป้า {count} จาก {count2} วัน', { count: lowProtein.length, count2: logged.length }),
      body: t('เฉลี่ย {avg} g เทียบกับเป้า {protein} g ลองเพิ่มไข่ต้ม อกไก่ หรือเต้าหู้ในมื้อเย็น', { avg, protein: goals.protein }),
    });
  } else {
    out.push({
      tone: 'good',
      icon: 'trophy',
      title: t('โปรตีนถึงเป้าเกือบทุกวัน'),
      body: t('ถึงเป้า {v1} จาก {count} วันที่บันทึก ทำต่อเนื่องแบบนี้ได้เลย', { v1: logged.length - lowProtein.length, count: logged.length }),
    });
  }

  const over = logged.filter((d) => isOverGoal(d.kcal, goals.kcal));
  if (over.length) {
    const others = logged.filter((d) => !over.includes(d));
    const avgBurn = (xs: DaySummary[]) => (xs.length ? xs.reduce((a, d) => a + d.burned, 0) / xs.length : 0);
    const names = over.map((d) => dayName(d.date)).join(', ');
    const lessActive = others.length > 0 && avgBurn(over) < avgBurn(others);
    out.push({
      tone: 'warn',
      icon: 'pulse',
      title: t('กินเกินเป้า {count} วัน ({names})', { count: over.length, names }),
      body: lessActive
        ? t('วันที่เกินมีกิจกรรมน้อยกว่าวันอื่น ลองเดินหลังอาหารเย็น 20 นาที')
        : t('ลองดูว่ามื้อไหนมีแคลอรี่สูงในวันเหล่านั้น แล้วปรับปริมาณหรือเมนู'),
    });
  } else {
    out.push({
      tone: 'good',
      icon: 'trophy',
      title: t('ไม่มีวันไหนกินเกินเป้า'),
      body: t('ตลอด {count} วันที่บันทึก แคลอรี่อยู่ในเป้าหมายทั้งหมด', { count: logged.length }),
    });
  }

  const waterOk = past.filter((d) => d.water >= goals.water).length;
  const anyWater = past.some((d) => d.water > 0);
  if (waterOk >= 5) {
    out.push({ tone: 'good', icon: 'drop', title: t('ดื่มน้ำถึงเป้า {waterOk} วัน', { waterOk }), body: t('นิสัยดื่มน้ำของคุณสม่ำเสมอมาก') });
  } else if (anyWater) {
    out.push({
      tone: 'info',
      icon: 'drop',
      title: t('ดื่มน้ำถึงเป้า {waterOk} จาก {count} วัน', { waterOk, count: past.length }),
      body: t('ลองตั้งแจ้งเตือนดื่มน้ำ หรือวางขวดน้ำไว้ใกล้ตัว'),
    });
  }
  return out.slice(0, 3);
}

export interface Tip {
  tone: 'good' | 'warn' | 'info';
  text: string;
}

/** คำแนะนำประจำวันบนหน้าหลัก คำนวณจากข้อมูลวันนี้ */
export function todayTip(
  totals: Totals,
  goals: { kcal: number; protein: number; water: number },
  burned: number,
  waterMl: number,
  hour: number,
): Tip {
  const remaining = goals.kcal - totals.kcal + burned;
  if (totals.kcal === 0) {
    return { tone: 'info', text: t('เริ่มบันทึกมื้อแรกของวันนี้ได้เลย กดปุ่ม + ตรงกลางด้านล่าง') };
  }
  if (remaining < -goals.kcal * 0.05) {
    return {
      tone: 'warn',
      text: t('วันนี้กินเกินเป้าไป {round} kcal ไม่เป็นไร พรุ่งนี้ปรับใหม่ได้ ลองเดินเบาๆ หลังมื้ออาหาร', { round: Math.round(-remaining) }),
    };
  }
  const gap = Math.round(goals.protein - totals.protein);
  if (gap >= 20 && hour >= 11) {
    return { tone: 'info', text: t('โปรตีนยังขาดอีก {gap} g ลองเพิ่มไข่ต้ม อกไก่ หรือเต้าหู้ในมื้อถัดไป', { gap }) };
  }
  if (hour >= 15 && waterMl < goals.water * 0.5) {
    return { tone: 'info', text: t('ดื่มน้ำไปแล้ว {v1} จากเป้า {v2} ลิตร ลองจิบน้ำเพิ่มสักแก้ว', { v1: (waterMl / 1000).toFixed(1), v2: (goals.water / 1000).toFixed(1) }) };
  }
  return { tone: 'good', text: t('วันนี้ไปได้สวย แคลอรี่และสารอาหารอยู่ในแนวทางที่ตั้งไว้') };
}
