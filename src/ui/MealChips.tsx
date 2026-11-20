import { MEALS, mealLabel, type MealKey } from '../db/types';
import { Chip } from './kit';

import { t } from '../i18n';
/** ปุ่มเลือกมื้อ (เช้า/กลางวัน/เย็น/ของว่าง) ที่ใช้ซ้ำในหน้าเพิ่มอาหารทุกโหมด */
export function MealChips({ meal, onChange }: { meal: MealKey; onChange: (m: MealKey) => void }) {
  return (
    <div className="chips" role="group" aria-label={t('บันทึกลงมื้อ')}>
      {MEALS.map((m) => (
        <Chip key={m.key} selected={meal === m.key} onClick={() => onChange(m.key)}>
          {m.emoji} {m.label}
        </Chip>
      ))}
    </div>
  );
}

export const mealButtonLabel = (m: MealKey) => t('เพิ่มลง{m}', { m: mealLabel(m) });
