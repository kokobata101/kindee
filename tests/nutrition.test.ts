import { describe, expect, it } from 'vitest';
import {
  activityKcal,
  bmi,
  bmiCategory,
  bmr,
  buildPlan,
  goalCalories,
  goalProgress,
  macroGrams,
  tdee,
  waterGoalMl,
  weeksToGoal,
} from '../src/lib/nutrition';
import { BUILTIN_FOODS } from '../src/data/foods';
import { ACTIVITY_TYPES, metFor } from '../src/lib/activities';

const male = { sex: 'male' as const, weightKg: 74, heightCm: 172, age: 28 };

describe('BMR / TDEE (Mifflin-St Jeor)', () => {
  it('ชาย 74 กก. 172 ซม. 28 ปี = 1,680 kcal', () => {
    // 10*74 + 6.25*172 - 5*28 + 5 = 740 + 1075 - 140 + 5 = 1680
    expect(bmr(male)).toBeCloseTo(1680, 5);
  });
  it('หญิงต่างจากชาย 166 kcal (5 vs -161)', () => {
    expect(bmr(male) - bmr({ ...male, sex: 'female' })).toBe(166);
  });
  it('TDEE = BMR × ตัวคูณกิจกรรม', () => {
    expect(tdee(male, 'light')).toBeCloseTo(1680 * 1.375, 5);
    expect(tdee(male, 'sedentary')).toBeCloseTo(1680 * 1.2, 5);
  });
});

describe('เป้าแคลอรี่', () => {
  it('ลด 0.5 กก./สัปดาห์ = ลบ ~550 kcal/วัน', () => {
    const t = tdee(male, 'light'); // 2310
    const g = goalCalories(t, 'lose', 0.5, 'male');
    expect(g.kcal).toBe(1760);
    expect(g.delta).toBe(-550);
    expect(g.clamped).toBe(false);
  });
  it('รักษาน้ำหนัก = TDEE ปัดหลักสิบ', () => {
    expect(goalCalories(2314, 'maintain', 0.5, 'male').kcal).toBe(2310);
  });
  it('เพิ่มน้ำหนักบวกส่วนต่าง', () => {
    // 0.25 กก./สัปดาห์ × 7,700 ÷ 7 = 275 → 2,310 + 275 = 2,585 → ปัดหลักสิบเป็น 2,590
    const g = goalCalories(2310, 'gain', 0.25, 'male');
    expect(g.kcal).toBe(2590);
    expect(g.delta).toBe(280);
  });
  it('ไม่ต่ำกว่าขั้นต่ำที่ปลอดภัย (หญิง 1,200 / ชาย 1,500)', () => {
    const f = goalCalories(1400, 'lose', 1, 'female');
    expect(f.kcal).toBe(1200);
    expect(f.clamped).toBe(true);
    const m = goalCalories(1700, 'lose', 1, 'male');
    expect(m.kcal).toBe(1500);
    expect(m.clamped).toBe(true);
  });
});

describe('สารอาหารหลัก', () => {
  it('30/40/30 ที่ 1,760 kcal', () => {
    expect(macroGrams(1760, { protein: 30, carb: 40, fat: 30 })).toEqual({ protein: 132, carb: 176, fat: 59 });
  });
  it('พลังงานจากกรัมที่คำนวณใกล้เคียงเป้า (±2%)', () => {
    const g = macroGrams(2000, { protein: 25, carb: 55, fat: 20 });
    const back = 4 * g.protein + 4 * g.carb + 9 * g.fat;
    expect(Math.abs(back - 2000) / 2000).toBeLessThan(0.02);
  });
});

describe('BMI / น้ำ / กิจกรรม', () => {
  it('BMI 74 กก. 172 ซม. ≈ 25.0 (น้ำหนักเกิน เกณฑ์เอเชีย)', () => {
    expect(bmi(74, 172)).toBeCloseTo(25.0, 1);
    expect(bmiCategory(25.0)).toBe('อ้วนระดับ 1');
    expect(bmiCategory(24.9)).toBe('น้ำหนักเกิน');
    expect(bmiCategory(22)).toBe('สมส่วน');
    expect(bmiCategory(17)).toBe('น้ำหนักต่ำกว่าเกณฑ์');
  });
  it('เป้าน้ำ ≈ 35 มล./กก. ปัดห้าสิบ', () => {
    expect(waterGoalMl(74)).toBe(2600);
    expect(waterGoalMl(60)).toBe(2100);
  });
  it('MET × กก. × ชั่วโมง: เดินเร็ว 3.8 MET 74 กก. 40 นาที ≈ 187', () => {
    expect(activityKcal(3.8, 74, 40)).toBe(187);
    expect(activityKcal(0, 74, 40)).toBe(0);
  });
  it('ค่า MET ครบทุกกิจกรรมและเพิ่มตามความหนัก', () => {
    for (const a of ACTIVITY_TYPES) {
      expect(a.met.light).toBeLessThan(a.met.moderate);
      expect(a.met.moderate).toBeLessThan(a.met.vigorous);
      expect(metFor(a.key, 'moderate')).toBe(a.met.moderate);
    }
  });
});

describe('ความคืบหน้า', () => {
  it('weeksToGoal', () => {
    expect(weeksToGoal(74, 70, 0.5)).toBe(8);
    expect(weeksToGoal(70, 70, 0.5)).toBe(0);
  });
  it('goalProgress จำกัด 0–1', () => {
    expect(goalProgress(76.8, 74, 70)).toBeCloseTo(0.41, 1);
    expect(goalProgress(76.8, 80, 70)).toBe(0);
    expect(goalProgress(76.8, 69, 70)).toBe(1);
  });
  it('buildPlan รวมทุกอย่าง', () => {
    const p = buildPlan({ ...male, activity: 'light', goal: 'lose', pace: 0.5, split: { protein: 30, carb: 40, fat: 30 } });
    expect(p.goal.kcal).toBe(1760);
    expect(p.macros.protein).toBe(132);
    expect(p.waterMl).toBe(2600);
  });
});

describe('ฐานข้อมูลอาหารตั้งต้น', () => {
  it('id ไม่ซ้ำ และข้อมูลไม่ติดลบ', () => {
    const ids = new Set(BUILTIN_FOODS.map((f) => f.id));
    expect(ids.size).toBe(BUILTIN_FOODS.length);
    for (const f of BUILTIN_FOODS) {
      expect(f.kcal).toBeGreaterThanOrEqual(0);
      expect(f.protein).toBeGreaterThanOrEqual(0);
      expect(f.carb).toBeGreaterThanOrEqual(0);
      expect(f.fat).toBeGreaterThanOrEqual(0);
      expect(f.grams).toBeGreaterThan(0);
    }
  });
  it('แคลอรี่สอดคล้องกับสารอาหาร (4P+4C+9F) ภายใน 15% หรือ 25 kcal', () => {
    const bad = BUILTIN_FOODS.filter((f) => {
      const calc = 4 * f.protein + 4 * f.carb + 9 * f.fat;
      return Math.abs(calc - f.kcal) > Math.max(25, f.kcal * 0.15);
    }).map((f) => `${f.id} ${f.name}: ระบุ ${f.kcal} คำนวณ ${Math.round(4 * f.protein + 4 * f.carb + 9 * f.fat)}`);
    expect(bad).toEqual([]);
  });
});
