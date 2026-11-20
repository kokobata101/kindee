// แชร์รายงานให้โค้ช/แพทย์โดยไม่ต้องมีเซิร์ฟเวอร์
// ข้อมูลทั้งหมดอยู่ใน "ส่วนหลัง #" ของ URL ซึ่งเบราว์เซอร์ไม่ส่งไปยังเซิร์ฟเวอร์ใดๆ
// รูปแบบ: ไบต์แรก = flags (bit0 = เข้ารหัส, bit1 = บีบอัด) แล้วตามด้วยข้อมูล → base64url
// เข้ารหัสด้วย AES-GCM 256 บิต กุญแจมาจากรหัสผ่านด้วย PBKDF2-SHA256 (210,000 รอบ)

import type { DaySummary } from './stats';
import { averageKcal, isOverGoal, macroShare } from './stats';

import { t } from '../i18n';
export interface ReportData {
  v: 1;
  /** ชื่อที่ผู้ใช้เลือกแสดง (อาจว่าง) */
  name: string;
  from: string;
  to: string;
  goal: { kcal: number; protein: number; water: number; label: string };
  /** [date, kcal, protein, carb, fat, waterMl, burnedKcal, logged(0/1)] */
  days: [string, number, number, number, number, number, number, number][];
  /** [date, kg] */
  weights: [string, number][];
  createdAt: string;
}

export const MAX_REPORT_DAYS = 31;

export function buildReport(args: {
  name: string;
  from: string;
  to: string;
  goal: ReportData['goal'];
  days: DaySummary[];
  weights: { date: string; kg: number }[];
  now?: Date;
}): ReportData {
  const days = args.days.slice(0, MAX_REPORT_DAYS);
  return {
    v: 1,
    name: args.name,
    from: args.from,
    to: args.to,
    goal: args.goal,
    days: days.map((d) => [d.date, d.kcal, Math.round(d.protein), Math.round(d.carb), Math.round(d.fat), d.water, d.burned, d.logged ? 1 : 0]),
    weights: args.weights.filter((w) => w.date >= args.from && w.date <= args.to).map((w) => [w.date, w.kg]),
    createdAt: (args.now ?? new Date()).toISOString(),
  };
}

export interface ReportStats {
  loggedDays: number;
  totalDays: number;
  avgKcal: number;
  overDays: number;
  avgProtein: number;
  avgWaterMl: number;
  totalBurned: number;
  share: { protein: number; carb: number; fat: number };
  weightFirst: number | null;
  weightLast: number | null;
  weightChange: number | null;
}

export function reportDays(r: ReportData): DaySummary[] {
  return r.days.map(([date, kcal, protein, carb, fat, water, burned, logged]) => ({
    date,
    kcal,
    protein,
    carb,
    fat,
    water,
    burned,
    logged: logged === 1,
    entryCount: logged === 1 ? 1 : 0,
  }));
}

export function reportStats(r: ReportData): ReportStats {
  const days = reportDays(r);
  const logged = days.filter((d) => d.logged);
  const n = Math.max(1, logged.length);
  const ws = [...r.weights].sort((a, b) => a[0].localeCompare(b[0]));
  const first = ws.length ? ws[0][1] : null;
  const last = ws.length ? ws[ws.length - 1][1] : null;
  const s = macroShare(days);
  return {
    loggedDays: logged.length,
    totalDays: days.length,
    avgKcal: averageKcal(days),
    overDays: logged.filter((d) => isOverGoal(d.kcal, r.goal.kcal)).length,
    avgProtein: Math.round(logged.reduce((a, d) => a + d.protein, 0) / n),
    // เฉลี่ยเฉพาะวันที่มีการบันทึกอะไรสักอย่าง (เหมือนแคลอรี่) ไม่ให้ช่วงก่อนเริ่มใช้แอปดึงค่าเฉลี่ยลง
    avgWaterMl: (() => {
      const active = days.filter((d) => d.logged || d.water > 0);
      return active.length ? Math.round(active.reduce((a, d) => a + d.water, 0) / active.length) : 0;
    })(),
    totalBurned: days.reduce((a, d) => a + d.burned, 0),
    share: { protein: s.protein, carb: s.carb, fat: s.fat },
    weightFirst: first,
    weightLast: last,
    weightChange: first !== null && last !== null && ws.length > 1 ? Math.round((last - first) * 10) / 10 : null,
  };
}

// ───────────── เข้ารหัส/บีบอัด ─────────────

export class ShareError extends Error {}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const b = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b + '='.repeat((4 - (b.length % 4)) % 4);
  try {
    const bin = atob(padded);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    throw new ShareError(t('ลิงก์รายงานไม่สมบูรณ์ (อาจถูกตัดเมื่อคัดลอก)'));
  }
}

const hasCompression = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const ITER = 210_000;

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function encodeReport(data: ReportData, password?: string): Promise<string> {
  let flags = 0;
  let body: Uint8Array = enc.encode(JSON.stringify(data));
  if (hasCompression()) {
    body = await pipe(body, new CompressionStream('deflate-raw'));
    flags |= 2;
  }
  if (password) {
    flags |= 1;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body as BufferSource));
    const out = new Uint8Array(1 + 16 + 12 + ct.length);
    out[0] = flags;
    out.set(salt, 1);
    out.set(iv, 17);
    out.set(ct, 29);
    return toBase64Url(out);
  }
  const out = new Uint8Array(1 + body.length);
  out[0] = flags;
  out.set(body, 1);
  return toBase64Url(out);
}

/** ลิงก์นี้เข้ารหัสไว้หรือไม่ (ดูจากไบต์แรก ไม่ต้องใช้รหัสผ่าน) */
export function isEncrypted(payload: string): boolean {
  try {
    return (fromBase64Url(payload.slice(0, 4))[0] & 1) === 1;
  } catch {
    return false;
  }
}

export async function decodeReport(payload: string, password?: string): Promise<ReportData> {
  const raw = fromBase64Url(payload);
  if (raw.length < 2) throw new ShareError(t('ลิงก์รายงานไม่สมบูรณ์'));
  const flags = raw[0];
  let body: Uint8Array;
  if (flags & 1) {
    if (!password) throw new ShareError(t('ต้องใช้รหัสผ่านเพื่อเปิดรายงานนี้'));
    if (raw.length < 30) throw new ShareError(t('ลิงก์รายงานไม่สมบูรณ์'));
    const key = await deriveKey(password, raw.slice(1, 17), ['decrypt']);
    try {
      body = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(17, 29) as BufferSource }, key, raw.slice(29) as BufferSource));
    } catch {
      throw new ShareError(t('รหัสผ่านไม่ถูกต้อง'));
    }
  } else {
    body = raw.slice(1);
  }
  if (flags & 2) {
    if (!hasCompression()) throw new ShareError(t('เบราว์เซอร์นี้เปิดรายงานแบบบีบอัดไม่ได้ ลองใช้เบราว์เซอร์รุ่นใหม่'));
    try {
      body = await pipe(body, new DecompressionStream('deflate-raw'));
    } catch {
      throw new ShareError(t('ลิงก์รายงานเสียหาย'));
    }
  }
  let obj: unknown;
  try {
    obj = JSON.parse(dec.decode(body));
  } catch {
    throw new ShareError(t('ลิงก์รายงานเสียหาย'));
  }
  const r = obj as Partial<ReportData> | null;
  if (!r || r.v !== 1 || !Array.isArray(r.days) || !Array.isArray(r.weights) || !r.goal || typeof r.from !== 'string' || typeof r.to !== 'string') {
    throw new ShareError(t('รูปแบบรายงานไม่ถูกต้อง'));
  }
  return r as ReportData;
}

/** ลิงก์เต็มสำหรับเปิดรายงาน (ใช้ HashRouter จึงต่อท้ายด้วย #/report) */
export function reportUrl(payload: string, loc: { origin: string; pathname: string } = window.location): string {
  // เปิดจากไฟล์ในเครื่อง (file://) origin จะเป็นข้อความ "null"
  const base = loc.origin === 'null' ? `file://${loc.pathname}` : `${loc.origin}${loc.pathname}`;
  return `${base}#/report?d=${payload}`;
}
