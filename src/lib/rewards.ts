import { addDays } from './date';
import { computeStreak } from './streak';

import { t } from '../i18n';
export interface RewardInputs {
  today: string;
  /** วันที่มีการบันทึกอาหารอย่างน้อย 1 รายการ */
  loggedDays: Set<string>;
  /** วันที่ดื่มน้ำถึงเป้า */
  waterGoalDays: Set<string>;
  /** วันที่โปรตีนถึงเป้า (≥ 95% ของเป้า) */
  proteinGoalDays: Set<string>;
  scanCount: number;
  activityCount: number;
  reachedWeightGoal: boolean;
}

export interface Badge {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  progress: number;
  target: number;
  unlocked: boolean;
}

export interface RewardSummary {
  badges: Badge[];
  unlockedCount: number;
  streak: { current: number; longest: number; todayDone: boolean };
  /** รางวัลสตรีคถัดไปที่ยังไม่ได้ (7 → 14 → 30 → 100) */
  nextStreakGoal: number | null;
  streakSince: string | null;
}

const STREAK_GOALS = [7, 14, 30, 100];

export function computeRewards(i: RewardInputs): RewardSummary {
  const log = computeStreak(i.loggedDays, i.today);
  const water = computeStreak(i.waterGoalDays, i.today);
  const protein = computeStreak(i.proteinGoalDays, i.today);
  const mk = (key: string, emoji: string, title: string, desc: string, progress: number, target: number): Badge => ({
    key,
    emoji,
    title,
    desc,
    progress: Math.min(progress, target),
    target,
    unlocked: progress >= target,
  });
  const badges: Badge[] = [
    mk('first', '🌱', t('เริ่มต้น'), t('บันทึกวันแรก'), i.loggedDays.size, 1),
    mk('streak7', '🔥', t('ไฟลุก 7 วัน'), t('7 วันติดต่อกัน'), log.longest, 7),
    mk('streak14', '⭐', t('ไฟลุก 14 วัน'), t('14 วันติดต่อกัน'), log.longest, 14),
    mk('water5', '💧', t('ดื่มน้ำครบ'), t('5 วันติดต่อกัน'), water.longest, 5),
    mk('protein3', '🥗', t('โปรตีนครบ'), t('3 วันติดต่อกัน'), protein.longest, 3),
    mk('scan50', '📷', t('นักสแกน'), t('สแกนอาหาร/บาร์โค้ด 50 ครั้ง'), i.scanCount, 50),
    mk('move10', '🏃', t('ขยับตัว'), t('บันทึกออกกำลังกาย 10 ครั้ง'), i.activityCount, 10),
    mk('goal', '⚖️', t('ถึงเป้าหมาย'), t('น้ำหนักถึงเป้าหมาย'), i.reachedWeightGoal ? 1 : 0, 1),
    mk('days100', '🏆', t('100 วัน'), t('บันทึกครบ 100 วัน'), i.loggedDays.size, 100),
  ];
  const nextStreakGoal = STREAK_GOALS.find((g) => g > log.current) ?? null;
  return {
    badges,
    unlockedCount: badges.filter((b) => b.unlocked).length,
    streak: log,
    nextStreakGoal,
    streakSince: log.current > 0 ? addDays(log.todayDone ? i.today : addDays(i.today, -1), -(log.current - 1)) : null,
  };
}
