import { useState } from 'react';
import { Button, Chip, NumField, TextField } from './kit';
import { MealChips, mealButtonLabel } from './MealChips';
import type { MealKey } from '../db/types';
import { fmtInt } from '../lib/format';
import { kcalFromMacros } from '../lib/nutrition';
import { validateQuick, type QuickErrors } from '../lib/validate';

import { t } from '../i18n';
export interface QuickForm {
  kcal: number | null;
  name: string;
  protein: number | null;
  carb: number | null;
  fat: number | null;
}

export const EMPTY_QUICK: QuickForm = { kcal: null, name: '', protein: null, carb: null, fat: null };

const PRESETS = [100, 150, 200, 250, 300, 400, 500, 600];

/** ช่องกรอกแคลอรี่ด่วน ใช้ทั้งตอนเพิ่มใหม่และตอนแก้รายการเดิม */
export function QuickFields({
  value,
  onChange,
  errors,
  presets = true,
}: {
  value: QuickForm;
  onChange: (v: QuickForm) => void;
  errors?: QuickErrors;
  presets?: boolean;
}) {
  const hasMacros = value.protein !== null || value.carb !== null || value.fat !== null;
  const [showMacros, setShowMacros] = useState(hasMacros);
  const set = (patch: Partial<QuickForm>) => onChange({ ...value, ...patch });
  const fromMacros = Math.round(kcalFromMacros(value.protein ?? 0, value.carb ?? 0, value.fat ?? 0));
  return (
    <div className="col gap12">
      <NumField label={t('แคลอรี่')} suffix="kcal" decimals={false} placeholder={t('เช่น 400')} value={value.kcal} onChange={(kcal) => set({ kcal })} error={errors?.kcal} />
      {presets && (
        <div className="chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', overflow: 'visible' }} role="group" aria-label={t('เลือกค่าด่วน')}>
          {PRESETS.map((k) => (
            <Chip key={k} selected={value.kcal === k} onClick={() => set({ kcal: k })} style={{ justifyContent: 'center', padding: '0 4px' }}>
              {k}
            </Chip>
          ))}
        </div>
      )}
      <TextField label={t('ชื่อ (ไม่บังคับ)')} placeholder={t('เช่น ข้าวร้านป้า, ขนมที่งาน')} maxLength={60} value={value.name} onChange={(e) => set({ name: e.target.value })} />
      {showMacros || hasMacros ? (
        <>
          <div className="row-flex" style={{ alignItems: 'flex-start' }}>
            <div className="grow"><NumField label={t('โปรตีน')} suffix="g" value={value.protein} onChange={(protein) => set({ protein })} /></div>
            <div className="grow"><NumField label={t('คาร์บ')} suffix="g" value={value.carb} onChange={(carb) => set({ carb })} /></div>
            <div className="grow"><NumField label={t('ไขมัน')} suffix="g" value={value.fat} onChange={(fat) => set({ fat })} /></div>
          </div>
          {errors?.macros && <p className="field-error">{errors.macros}</p>}
          {hasMacros && fromMacros >= 1 && (
            <button type="button" className="link" style={{ textAlign: 'left' }} onClick={() => set({ kcal: fromMacros })}>{t('คำนวณแคลอรี่จากสารอาหาร = {fromMacros} kcal (แตะเพื่อใช้ค่านี้)', { fromMacros })}</button>
          )}
        </>
      ) : (
        <button type="button" className="link" style={{ textAlign: 'left' }} onClick={() => setShowMacros(true)}>{t('+ ใส่โปรตีน/คาร์บ/ไขมันด้วย (ไม่บังคับ)')}</button>
      )}
    </div>
  );
}

export function quickFormValid(f: QuickForm): boolean {
  return Object.keys(validateQuick(f)).length === 0;
}

/** โหมด "แคลอรี่ด่วน" ในหน้าเพิ่มอาหาร */
export function QuickAddPanel({
  meal,
  onMealChange,
  onAdd,
}: {
  meal: MealKey;
  onMealChange: (m: MealKey) => void;
  onAdd: (f: QuickForm) => void | Promise<void>;
}) {
  const [form, setForm] = useState<QuickForm>(EMPTY_QUICK);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors = validateQuick(form);

  async function submit() {
    setTried(true);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      await onAdd(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="col gap12">
        <p className="caption muted">{t('ไม่ต้องหาชื่ออาหาร ใส่แคลอรี่ที่รู้ (จากฉลากหรือประมาณเอง) แล้วบันทึกได้เลย')}</p>
        <MealChips meal={meal} onChange={onMealChange} />
        <QuickFields value={form} onChange={setForm} errors={tried ? errors : undefined} />
        <p className="caption muted">{t('รายการนี้ไม่ผูกกับฐานข้อมูลอาหาร ถ้าไม่ใส่โปรตีน/คาร์บ/ไขมัน จะนับเฉพาะแคลอรี่')}</p>
      </div>
      <div className="footer-bar">
        <div className="col grow">
          <span className="caption">{t('จะบันทึก')}</span>
          <b className="num-m">{fmtInt(form.kcal ?? 0)} kcal</b>
        </div>
        <Button block={false} disabled={busy} onClick={submit}>
          {mealButtonLabel(meal)}
        </Button>
      </div>
    </>
  );
}
