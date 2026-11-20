import { describe, expect, it } from 'vitest';
import { LIMITS, validateBody, validateFood, validateTarget } from '../src/lib/validate';

describe('validateBody', () => {
  it('accepts a normal adult', () => {
    expect(validateBody({ age: 28, heightCm: 172, weightKg: 74 })).toEqual({});
  });
  it('accepts the exact limits', () => {
    expect(validateBody({ age: LIMITS.age.min, heightCm: LIMITS.height.min, weightKg: LIMITS.weight.min })).toEqual({});
    expect(validateBody({ age: LIMITS.age.max, heightCm: LIMITS.height.max, weightKg: LIMITS.weight.max })).toEqual({});
  });
  it('rejects empty fields', () => {
    const e = validateBody({ age: null, heightCm: null, weightKg: null });
    expect(Object.keys(e).sort()).toEqual(['age', 'heightCm', 'weightKg']);
  });
  it('rejects out-of-range values just outside the limits', () => {
    expect(validateBody({ age: 14, heightCm: 172, weightKg: 74 }).age).toBeDefined();
    expect(validateBody({ age: 101, heightCm: 172, weightKg: 74 }).age).toBeDefined();
    expect(validateBody({ age: 28, heightCm: 119, weightKg: 74 }).heightCm).toBeDefined();
    expect(validateBody({ age: 28, heightCm: 221, weightKg: 74 }).heightCm).toBeDefined();
    expect(validateBody({ age: 28, heightCm: 172, weightKg: 29.9 }).weightKg).toBeDefined();
    expect(validateBody({ age: 28, heightCm: 172, weightKg: 251 }).weightKg).toBeDefined();
  });
  it('rejects a fractional age', () => {
    expect(validateBody({ age: 28.5, heightCm: 172, weightKg: 74 }).age).toBeDefined();
  });
});

describe('validateTarget', () => {
  it('maintain needs no target', () => {
    expect(validateTarget('maintain', 74, null, 172)).toEqual({});
  });
  it('lose: target must be set and lower than current', () => {
    expect(validateTarget('lose', 74, null, 172).error).toBeDefined();
    expect(validateTarget('lose', 74, 80, 172).error).toContain('น้อยกว่า');
    expect(validateTarget('lose', 74, 74, 172).error).toBeDefined();
    expect(validateTarget('lose', 74, 70, 172)).toEqual({});
  });
  it('gain: target must be higher than current', () => {
    expect(validateTarget('gain', 60, 55, 172).error).toContain('มากกว่า');
    expect(validateTarget('gain', 60, 64, 172)).toEqual({});
  });
  it('warns (does not block) on an underweight target BMI', () => {
    const r = validateTarget('lose', 60, 50, 172); // BMI 16.9
    expect(r.error).toBeUndefined();
    expect(r.warning).toContain('BMI');
  });
  it('warns on a gain target that lands in overweight range', () => {
    const r = validateTarget('gain', 70, 80, 172); // BMI 27
    expect(r.error).toBeUndefined();
    expect(r.warning).toBeDefined();
  });
  it('rejects a target outside weight limits', () => {
    expect(validateTarget('lose', 74, 20, 172).error).toBeDefined();
  });
});

describe('validateFood', () => {
  const ok = { name: 'ข้าวผัด', serving: '1 จาน', grams: 300, kcal: 550, protein: 15, carb: 70, fat: 20 };
  it('accepts a complete food', () => {
    expect(validateFood(ok)).toEqual({});
  });
  it('macros are optional', () => {
    expect(validateFood({ ...ok, protein: null, carb: null, fat: null })).toEqual({});
  });
  it('requires name, serving, grams and kcal', () => {
    const e = validateFood({ name: '  ', serving: '', grams: null, kcal: null, protein: null, carb: null, fat: null });
    expect(Object.keys(e).sort()).toEqual(['grams', 'kcal', 'name', 'serving']);
  });
  it('allows 0 kcal (water) but not negative or absurd', () => {
    expect(validateFood({ ...ok, kcal: 0 }).kcal).toBeUndefined();
    expect(validateFood({ ...ok, kcal: -1 }).kcal).toBeDefined();
    expect(validateFood({ ...ok, kcal: 5001 }).kcal).toBeDefined();
  });
  it('rejects zero grams and negative macros', () => {
    expect(validateFood({ ...ok, grams: 0 }).grams).toBeDefined();
    expect(validateFood({ ...ok, protein: -5 }).macros).toBeDefined();
  });
});
