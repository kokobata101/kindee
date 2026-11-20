// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ShareError,
  buildReport,
  decodeReport,
  encodeReport,
  fromBase64Url,
  isEncrypted,
  reportStats,
  reportUrl,
  toBase64Url,
} from '../src/lib/share';
import type { DaySummary } from '../src/lib/stats';

const day = (date: string, kcal: number, extra: Partial<DaySummary> = {}): DaySummary => ({
  date, kcal, protein: 80, carb: 200, fat: 60, water: 2000, burned: 100, logged: kcal > 0, entryCount: kcal > 0 ? 3 : 0, ...extra,
});

const sample = () =>
  buildReport({
    name: 'มะนาว',
    from: '2026-10-01',
    to: '2026-10-05',
    goal: { kcal: 1800, protein: 135, water: 2500, label: 'ลดน้ำหนัก' },
    days: [day('2026-10-01', 1700), day('2026-10-02', 2100), day('2026-10-03', 0), day('2026-10-04', 1800), day('2026-10-05', 1900)],
    weights: [
      { date: '2026-09-30', kg: 80 },
      { date: '2026-10-01', kg: 79.5 },
      { date: '2026-10-05', kg: 78.8 },
    ],
    now: new Date('2026-10-06T00:00:00Z'),
  });

describe('base64url', () => {
  it('round-trips arbitrary bytes without + / =', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256);
    const s = toBase64Url(bytes);
    expect(s).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64Url(s))).toEqual(Array.from(bytes));
  });
  it('rejects garbage', () => {
    expect(() => fromBase64Url('***')).toThrow(ShareError);
  });
});

describe('buildReport / reportStats', () => {
  it('keeps only weights inside the range', () => {
    expect(sample().weights.map((w) => w[0])).toEqual(['2026-10-01', '2026-10-05']);
  });
  it('computes stats from logged days only', () => {
    const s = reportStats(sample());
    expect(s.loggedDays).toBe(4);
    expect(s.totalDays).toBe(5);
    expect(s.avgKcal).toBe(Math.round((1700 + 2100 + 1800 + 1900) / 4));
    expect(s.overDays).toBe(2); // เกิน 5% ของเป้า (>1,890): 2100 และ 1900
    expect(s.weightChange).toBe(-0.7);
    expect(s.avgWaterMl).toBe(2000); // วันที่ไม่บันทึกอะไรเลย (3 ต.ค.) ไม่ถูกนับ
    expect(s.share.protein + s.share.carb + s.share.fat).toBe(100);
  });
  it('no weight change with a single weigh-in', () => {
    const r = sample();
    r.weights = [['2026-10-01', 79]];
    expect(reportStats(r).weightChange).toBeNull();
  });
  it('caps the number of days', () => {
    const many = Array.from({ length: 60 }, (_, i) => day(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`, 1500));
    expect(buildReport({ name: '', from: 'a', to: 'b', goal: { kcal: 1, protein: 1, water: 1, label: '' }, days: many, weights: [] }).days).toHaveLength(31);
  });
});

describe('encode / decode', () => {
  it('round-trips without password', async () => {
    const r = sample();
    const p = await encodeReport(r);
    expect(isEncrypted(p)).toBe(false);
    expect(await decodeReport(p)).toEqual(r);
  });
  it('round-trips with password and flags it as encrypted', async () => {
    const r = sample();
    const p = await encodeReport(r, 'รหัส-ลับ 123');
    expect(isEncrypted(p)).toBe(true);
    expect(p).not.toContain('มะนาว');
    expect(await decodeReport(p, 'รหัส-ลับ 123')).toEqual(r);
  });
  it('wrong or missing password fails clearly', async () => {
    const p = await encodeReport(sample(), 'abc12345');
    await expect(decodeReport(p, 'wrong')).rejects.toThrow('รหัสผ่านไม่ถูกต้อง');
    await expect(decodeReport(p)).rejects.toThrow('ต้องใช้รหัสผ่าน');
  });
  it('two encryptions of the same data differ (random salt/iv)', async () => {
    const a = await encodeReport(sample(), 'pw123456');
    const b = await encodeReport(sample(), 'pw123456');
    expect(a).not.toBe(b);
  });
  it('tampered payload is rejected', async () => {
    const p = await encodeReport(sample(), 'pw123456');
    const raw = fromBase64Url(p);
    raw[raw.length - 3] ^= 0xff;
    await expect(decodeReport(toBase64Url(raw), 'pw123456')).rejects.toThrow(ShareError);
  });
  it('truncated link is rejected', async () => {
    const p = await encodeReport(sample());
    await expect(decodeReport(p.slice(0, 10))).rejects.toThrow(ShareError);
  });
  it('a 31-day report fits comfortably in a QR (under ~1.5 KB)', async () => {
    const days = Array.from({ length: 31 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`, 1500 + i * 13, { protein: 70 + i, carb: 190 + i, fat: 55 + (i % 9), water: 1800 + i * 20 }));
    const weights = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(i * 3 + 1).padStart(2, '0')}`, kg: 80 - i * 0.2 }));
    const p = await encodeReport(
      buildReport({ name: 'มะนาว', from: '2026-10-01', to: '2026-10-31', goal: { kcal: 1800, protein: 135, water: 2500, label: 'ลดน้ำหนัก' }, days, weights }),
      'pw123456',
    );
    expect(p.length).toBeLessThan(1500);
  });
});

describe('reportUrl', () => {
  it('builds a hash-router link', () => {
    expect(reportUrl('abc', { origin: 'https://x.dev', pathname: '/kindee/' })).toBe('https://x.dev/kindee/#/report?d=abc');
  });
  it('does not produce "null/..." when opened from a local file', () => {
    expect(reportUrl('abc', { origin: 'null', pathname: '/home/u/kindee/index.html' })).toBe('file:///home/u/kindee/index.html#/report?d=abc');
  });
});
