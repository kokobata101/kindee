
import { t } from '../i18n';
// ค่า MET โดยประมาณจาก Compendium of Physical Activities (Ainsworth et al., 2011)
// ใช้ประมาณการเท่านั้น — การเผาผลาญจริงต่างกันตามบุคคล

export type Intensity = 'light' | 'moderate' | 'vigorous';

export const INTENSITY_LABEL: Record<Intensity, string> = {
  light: t('เบา'),
  moderate: t('ปานกลาง'),
  vigorous: t('หนัก'),
};

export interface ActivityType {
  key: string;
  name: string;
  emoji: string;
  met: Record<Intensity, number>;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  // ชื่อเก็บเป็นไทย (ต้นฉบับ) แล้วแปลตอนแสดงผลด้วย t(name)
  { key: 'walk', name: 'เดินเร็ว', emoji: '🚶', met: { light: 2.8, moderate: 3.8, vigorous: 5.0 } },
  { key: 'run', name: 'วิ่ง', emoji: '🏃', met: { light: 7.0, moderate: 9.8, vigorous: 11.5 } },
  { key: 'bike', name: 'ปั่นจักรยาน', emoji: '🚴', met: { light: 4.0, moderate: 6.8, vigorous: 10.0 } },
  { key: 'swim', name: 'ว่ายน้ำ', emoji: '🏊', met: { light: 5.8, moderate: 7.0, vigorous: 9.8 } },
  { key: 'weights', name: 'ยกเวท', emoji: '🏋️', met: { light: 3.5, moderate: 4.5, vigorous: 6.0 } },
  { key: 'yoga', name: 'โยคะ', emoji: '🧘', met: { light: 2.5, moderate: 3.0, vigorous: 4.0 } },
  { key: 'badminton', name: 'แบดมินตัน', emoji: '🏸', met: { light: 4.5, moderate: 5.5, vigorous: 7.0 } },
  { key: 'aerobic', name: 'แอโรบิก/ซุมบ้า', emoji: '💃', met: { light: 5.0, moderate: 6.5, vigorous: 7.3 } },
  { key: 'football', name: 'ฟุตบอล', emoji: '⚽', met: { light: 5.0, moderate: 7.0, vigorous: 10.0 } },
  { key: 'chores', name: 'งานบ้าน', emoji: '🧹', met: { light: 2.3, moderate: 3.3, vigorous: 4.5 } },
];

export const activityTypeByKey = (key: string) => ACTIVITY_TYPES.find((a) => a.key === key);

export function metFor(key: string, intensity: Intensity): number {
  const t = activityTypeByKey(key);
  if (!t) throw new Error(`unknown activity type: ${key}`);
  return t.met[intensity];
}
