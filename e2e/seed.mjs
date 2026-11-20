// สร้างไฟล์สำรองจำลอง 14 วัน แล้วกู้คืนเข้าแอปผ่านหน้า Welcome (ทดสอบระบบกู้คืนไปพร้อมกัน)
export const bangkokISO = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

// ออฟเซ็ตวัน (ย้อนหลัง) → แคลอรี่ / โปรตีน / น้ำ
export const SEED_DAYS = [
  [-1, 1750, 140, 2600],
  [-2, 1800, 140, 2600],
  [-3, 2200, 140, 2600], // เกินเป้า (>1,890)
  [-4, 1700, 60, 2600],
  [-5, 1850, 60, 2600],
  [-6, 1650, 60, 1000],
  [-7, 1800, 60, 1000],
  ...[8, 9, 10, 11, 12, 13, 14].map((n) => [-n, 1800, 60, 0]),
];

export function buildSeed() {
  const year = Number(bangkokISO().slice(0, 4));
  const now = Date.now();
  const profile = {
    id: 1, name: 'มะนาว', sex: 'male', birthYear: year - 28, heightCm: 172, startWeightKg: 74, targetWeightKg: 70,
    goal: 'lose', pace: 0.5, activity: 'light', presetKey: 'balanced', split: { protein: 30, carb: 40, fat: 30 },
    kcalGoal: 1800, kcalManual: false, waterGoalMl: 2600, waterManual: false, autoAdjust: true, theme: 'system', createdAt: now,
  };
  const entries = [];
  const water = [];
  const activities = [];
  for (const [off, kcal, protein, ml] of SEED_DAYS) {
    const date = bangkokISO(off);
    [['breakfast', '08:00', 0.3], ['lunch', '12:30', 0.4], ['dinner', '19:00', 0.3]].forEach(([meal, time, share]) => {
      const k = Math.round(kcal * share);
      const unit = { kcal: k, protein: Math.round(protein * share), carb: Math.round((k * 0.4) / 4), fat: Math.round((k * 0.3) / 9), grams: 300 };
      entries.push({ date, meal, time, name: `มื้อจำลอง ${meal}`, emoji: '🍚', serving: '1 จาน', qty: 1, unit, ...unit, source: 'search', createdAt: now });
    });
    if (ml) water.push({ date, ml, time: '10:00' });
    if (off >= -10) activities.push({ date, time: '18:00', typeKey: 'walk', name: 'เดินเร็ว', emoji: '🚶', intensity: 'moderate', minutes: 30, met: 3.8, weightKg: 74, kcal: 141, source: 'manual' });
  }
  const weights = [
    { date: bangkokISO(-14), kg: 75, createdAt: now },
    { date: bangkokISO(-7), kg: 74.5, createdAt: now },
    { date: bangkokISO(0), kg: 74, createdAt: now },
  ];
  return {
    app: 'kindee', version: 1, exportedAt: new Date().toISOString(),
    data: { profile: [profile], foods: [], entries, water, weights, activities, schedules: [], kv: [] },
  };
}

export async function restoreSeed(page, BASE, seed = buildSeed()) {
  await page.goto(BASE);
  await page.getByText('นับแคลอรี่ง่ายๆ').waitFor();
  await page.getByLabel('เลือกไฟล์สำรอง').setInputFiles({
    name: 'seed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)),
  });
  await page.getByText('คำแนะนำวันนี้').waitFor();
  return seed;
}
