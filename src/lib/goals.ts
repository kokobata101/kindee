import type { Profile } from '../db/types';
import { ageFromBirthYear, buildPlan, type Plan } from './nutrition';

export const profileAge = (p: Pick<Profile, 'birthYear'>, now: Date = new Date()) => ageFromBirthYear(p.birthYear, now);

export function planFor(p: Profile, weightKg: number, now: Date = new Date()): Plan {
  return buildPlan({
    sex: p.sex,
    weightKg,
    heightCm: p.heightCm,
    age: profileAge(p, now),
    activity: p.activity,
    goal: p.goal,
    pace: p.pace,
    split: p.split,
  });
}

/**
 * คำนวณเป้าแคลอรี่/น้ำใหม่จากน้ำหนักปัจจุบัน
 * ค่าที่ผู้ใช้ตั้งเอง (manual) จะไม่ถูกเขียนทับ
 */
export function recalcGoals(p: Profile, weightKg: number, now: Date = new Date()): Profile {
  const plan = planFor(p, weightKg, now);
  return {
    ...p,
    kcalGoal: p.kcalManual ? p.kcalGoal : plan.goal.kcal,
    waterGoalMl: p.waterManual ? p.waterGoalMl : plan.waterMl,
  };
}
