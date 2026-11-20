import { addDays } from './date';

export interface Streak {
  current: number;
  longest: number;
  todayDone: boolean;
}

/**
 * นับวันต่อเนื่อง จากชุดวันที่ที่ "ทำสำเร็จ"
 * - current: ถ้าวันนี้ยังไม่ทำ จะนับถอยหลังจากเมื่อวาน (วันนี้ยังมีโอกาสทำ จึงไม่ตัดสตรีค)
 */
export function computeStreak(days: Iterable<string>, today: string): Streak {
  const set = new Set(days);
  const todayDone = set.has(today);
  let cursor = todayDone ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return { current, longest, todayDone };
}
