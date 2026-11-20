import { describe, expect, it } from 'vitest';
// @ts-expect-error ไฟล์สคริปต์ .mjs ไม่มีไทป์
import { check } from '../scripts/i18n-lib.mjs';
import { en } from '../src/i18n/en';
import { interpolate, translate } from '../src/i18n';
import { BUILTIN_FOODS } from '../src/data/foods';
import { qtyLabel } from '../src/lib/diary';

describe('i18n', () => {
  it('ทุกข้อความไทยในโค้ดมีคำแปลอังกฤษ และตัวแปร {…} ตรงกัน (ถ้าเพิ่มข้อความใหม่ ให้เพิ่มใน src/i18n/en.ts)', async () => {
    const r = await check();
    expect(r.missing).toEqual([]);
    expect(r.badPlaceholders).toEqual([]);
    expect(r.thaiLeft).toEqual([]);
  });

  it('ไม่มีคำแปลค้างที่ไม่ได้ใช้แล้ว', async () => {
    expect((await check()).unused).toEqual([]);
  });

  it('แทนค่าตัวแปรและเลือกเอกพจน์/พหูพจน์', () => {
    expect(interpolate('เพิ่ม {n} รายการ', { n: 3 })).toBe('เพิ่ม 3 รายการ');
    expect(interpolate('{n} {n?item:items}', { n: 1 })).toBe('1 item');
    expect(interpolate('{n} {n?item:items}', { n: 2 })).toBe('2 items');
    expect(interpolate('{n} {n?item:items}', { n: 0 })).toBe('0 items');
    expect(interpolate('{ไม่มี}', {})).toBe('{ไม่มี}');
  });

  it('translate: ไทยคงเดิม อังกฤษแปล ไม่มีคำแปลใช้ข้อความเดิม', () => {
    expect(translate('th', 'เพิ่มอาหาร')).toBe('เพิ่มอาหาร');
    expect(translate('en', 'เพิ่มอาหาร')).toBe('Add food');
    expect(translate('en', 'บันทึก {count} รายการแล้ว', { count: 1 })).toBe('Logged 1 item');
    expect(translate('en', 'ข้อความที่ไม่มีในพจนานุกรม')).toBe('ข้อความที่ไม่มีในพจนานุกรม');
  });

  it('อาหารตั้งต้นทุกรายการมีชื่ออังกฤษ และหน่วยบริโภคทุกแบบมีคำแปล', () => {
    for (const f of BUILTIN_FOODS) {
      expect(f.nameEn, f.id).toBeTruthy();
      const unit = f.serving.replace(/^\d+(?:\.\d+)?(?:\/\d+)?\s*/, '');
      expect(unit in en, `${f.id} หน่วย "${unit}"`).toBe(true);
    }
  });

  it('จำนวนที่แสดง: ไทยไม่เปลี่ยน, เศษส่วนในหน่วย (1/2 ผล) คำนวณถูก', () => {
    expect(qtyLabel(2, '1/2 ผล')).toBe('1 ผล');
    expect(qtyLabel(1, '1/2 ผล')).toBe('0.5 ผล');
  });
});
