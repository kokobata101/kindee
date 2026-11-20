const nf = new Intl.NumberFormat('en-US');

/** 1,760 */
export const fmtInt = (n: number) => nf.format(Math.round(n));

/** ตัดศูนย์ท้ายทศนิยม: 1.50 -> 1.5, 2.0 -> 2 */
export function fmtNum(n: number, digits = 1): string {
  return String(parseFloat(n.toFixed(digits)));
}

/** 74.0 */
export const fmtKg = (n: number) => n.toFixed(1);

/** ลิตรจากมิลลิลิตร: 1800 -> 1.8 */
export const fmtLiters = (ml: number) => fmtNum(ml / 1000, 1);

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const pct = (part: number, whole: number) => (whole > 0 ? clamp(part / whole, 0, 1) : 0);
