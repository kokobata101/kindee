import { useMemo, useState } from 'react';
import { useApp, useProfile } from '../app/context';
import { useWeights } from '../app/hooks';
import { updateProfile } from '../db/repo';
import {
  ACTIVITY_LEVELS,
  GOAL_LABEL,
  MACRO_PRESETS,
  PACES,
  bmi,
  bmiCategory,
  buildPlan,
  minSafeKcal,
  weeksToGoal,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '../lib/nutrition';
import { profileAge } from '../lib/goals';
import { validateBody, validateTarget } from '../lib/validate';
import { fmtInt, fmtNum } from '../lib/format';
import { Button, Chip, Header, NumField, OptionCard, TextField, Toggle, useBack } from '../ui/kit';

import { t, tc } from '../i18n';
const GOALS: { key: Goal; title: string; sub: string }[] = [
  { key: 'lose', title: t('ลดน้ำหนัก'), sub: t('กินน้อยกว่าที่ร่างกายใช้เล็กน้อย') },
  { key: 'maintain', title: t('รักษาน้ำหนัก'), sub: t('กินเท่ากับที่ร่างกายใช้') },
  { key: 'gain', title: t('เพิ่มน้ำหนัก'), sub: t('กินมากกว่าที่ร่างกายใช้เล็กน้อย') },
];

const KCAL_MIN = 800;
const KCAL_MAX = 6000;
const WATER_MIN = 500;
const WATER_MAX = 8000;

export default function Goals() {
  const p = useProfile();
  const back = useBack('/me');
  const { toast } = useApp();
  const { latest } = useWeights();
  const weightNow = latest?.kg ?? p.startWeightKg;

  const [name, setName] = useState(p.name);
  const [sex, setSex] = useState<Sex>(p.sex);
  const [age, setAge] = useState<number | null>(profileAge(p));
  const [heightCm, setHeight] = useState<number | null>(p.heightCm);
  const [activity, setActivity] = useState<ActivityLevel>(p.activity);
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [targetKg, setTarget] = useState<number | null>(p.goal === 'maintain' ? null : p.targetWeightKg);
  const [pace, setPace] = useState<number>(p.pace || 0.5);
  const [presetKey, setPreset] = useState(p.presetKey);
  const [kcalManual, setKcalManual] = useState(p.kcalManual);
  const [kcalValue, setKcalValue] = useState<number | null>(p.kcalGoal);
  const [waterManual, setWaterManual] = useState(p.waterManual);
  const [waterValue, setWaterValue] = useState<number | null>(p.waterGoalMl);
  const [autoAdjust, setAutoAdjust] = useState(p.autoAdjust);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const bodyErr = validateBody({ age, heightCm, weightKg: weightNow });
  const bodyOk = Object.keys(bodyErr).length === 0;
  const target = bodyOk ? validateTarget(goal, weightNow, targetKg, heightCm!) : {};
  const split = (MACRO_PRESETS.find((m) => m.key === presetKey) ?? MACRO_PRESETS[0]).split;

  const plan = useMemo(
    () =>
      bodyOk
        ? buildPlan({ sex, weightKg: weightNow, heightCm: heightCm!, age: age!, activity, goal, pace: goal === 'maintain' ? 0 : pace, split })
        : null,
    [bodyOk, sex, weightNow, heightCm, age, activity, goal, pace, split],
  );

  const kcalErr = kcalManual && (kcalValue === null || kcalValue < KCAL_MIN || kcalValue > KCAL_MAX) ? t('ใส่ {KCAL_MIN}–{KCAL_MAX} kcal', { KCAL_MIN: fmtInt(KCAL_MIN), KCAL_MAX: fmtInt(KCAL_MAX) }) : null;
  const waterErr = waterManual && (waterValue === null || waterValue < WATER_MIN || waterValue > WATER_MAX) ? t('ใส่ {WATER_MIN}–{WATER_MAX} มล.', { WATER_MIN: fmtInt(WATER_MIN), WATER_MAX: fmtInt(WATER_MAX) }) : null;

  const effectiveKcal = plan ? (kcalManual && kcalValue ? kcalValue : plan.goal.kcal) : 0;
  // ความเร็วจริงจากแคลอรี่ที่ใช้ (รวมกรณีตั้งเอง): ต้องไปในทิศทางเดียวกับเป้าหมายจึงจะคำนวณสัปดาห์ได้
  const effDelta = plan ? effectiveKcal - plan.tdee : 0;
  const towardGoal = (goal === 'lose' && effDelta < 0) || (goal === 'gain' && effDelta > 0);
  const realPace = plan && towardGoal ? (Math.abs(effDelta) * 7) / 7700 : 0;
  const weeks = plan && goal !== 'maintain' && targetKg ? weeksToGoal(weightNow, targetKg, realPace) : 0;
  const lowKcal = kcalManual && kcalValue !== null && kcalValue < minSafeKcal(sex);

  async function save() {
    setTried(true);
    if (!plan || !bodyOk || target.error || kcalErr || waterErr || saving) return;
    setSaving(true);
    try {
      const newTarget = goal === 'maintain' ? weightNow : targetKg!;
      const planChanged = goal !== p.goal || newTarget !== p.targetWeightKg;
      await updateProfile({
        name: name.trim() || t('ผู้ใช้'),
        sex,
        birthYear: new Date().getFullYear() - age!,
        heightCm: heightCm!,
        activity,
        goal,
        pace: goal === 'maintain' ? 0 : pace,
        targetWeightKg: newTarget,
        // เปลี่ยนเป้าหมายแล้ว นับความคืบหน้าใหม่จากน้ำหนักปัจจุบัน
        startWeightKg: planChanged ? weightNow : p.startWeightKg,
        presetKey,
        split,
        kcalManual,
        kcalGoal: kcalManual ? kcalValue! : plan.goal.kcal,
        waterManual,
        waterGoalMl: waterManual ? waterValue! : plan.waterMl,
        autoAdjust,
      });
      toast(t('บันทึกเป้าหมายแล้ว'));
      back();
    } catch {
      toast(t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'), 'error');
      setSaving(false);
    }
  }

  return (
    <>
      <Header title={t('เป้าหมายและแผนของฉัน')} />
      <main className="screen no-tabs has-footer">
        {plan && (
          <section className="hero" aria-label={t('แผนที่คำนวณได้')} data-testid="plan-preview">
            <div className="caption">{t('เป้าหมายใหม่ · {v1}', { v1: GOAL_LABEL[goal] })}</div>
            <div className="row-flex" style={{ alignItems: 'flex-end', gap: 8 }}>
              <span className="num-xl" data-testid="plan-kcal">{fmtInt(effectiveKcal)}</span>
              <span style={{ marginBottom: 10 }}>{t('kcal / วัน')}</span>
            </div>
            <div style={{ opacity: 0.78 }}>
              BMR {fmtInt(plan.bmr)} · TDEE {fmtInt(plan.tdee)}
              {weeks > 0 ? t(' · ถึง {targetKg} กก. ใน ~{weeks} สัปดาห์', { targetKg: fmtNum(targetKg!), weeks }) : ''}
            </div>
          </section>
        )}
        {plan?.goal.clamped && !kcalManual && (
          <p className="caption" style={{ color: 'var(--calorie)' }}>{t('⚠️ ปรับขึ้นเป็น {minKcal} kcal เพื่อไม่ให้ต่ำกว่าขั้นต่ำที่ปลอดภัย', { minKcal: fmtInt(plan.goal.minKcal) })}</p>
        )}

        <section className="col gap12" aria-label={t('ข้อมูลร่างกาย')}>
          <h2 className="h3">{t('ข้อมูลของฉัน')}</h2>
          <TextField label={t('ชื่อเล่น')} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          <div className="field">
            <span className="field-label">{t('เพศทางชีวภาพ (ใช้ในสูตรคำนวณเท่านั้น)')}</span>
            <div className="chips" role="radiogroup" aria-label={t('เพศทางชีวภาพ')}>
              <Chip selected={sex === 'male'} onClick={() => setSex('male')} role="radio" aria-checked={sex === 'male'}>{t('ชาย')}</Chip>
              <Chip selected={sex === 'female'} onClick={() => setSex('female')} role="radio" aria-checked={sex === 'female'}>{t('หญิง')}</Chip>
            </div>
          </div>
          <div className="row-flex" style={{ alignItems: 'flex-start' }}>
            <div className="grow"><NumField label={t('อายุ')} suffix={tc('age', 'ปี')} decimals={false} value={age} onChange={setAge} error={tried ? bodyErr.age : null} /></div>
            <div className="grow"><NumField label={t('ส่วนสูง')} suffix={t('ซม.')} decimals={false} value={heightCm} onChange={setHeight} error={tried ? bodyErr.heightCm : null} /></div>
          </div>
          <p className="caption muted">{t('น้ำหนักปัจจุบัน {weightNow} กก. · BMI {v2} · อัปเดตน้ำหนักได้ในหน้า "น้ำหนักและร่างกาย"', { weightNow: fmtNum(weightNow), v2: bodyOk ? `${bmi(weightNow, heightCm!).toFixed(1)} (${bmiCategory(bmi(weightNow, heightCm!))})` : '–' })}</p>
        </section>

        <section className="col gap8" role="radiogroup" aria-label={t('ระดับกิจกรรม')}>
          <h2 className="h3">{t('ระดับกิจกรรมในชีวิตประจำวัน')}</h2>
          {ACTIVITY_LEVELS.map((a) => (
            <OptionCard key={a.key} checked={activity === a.key} onClick={() => setActivity(a.key)} title={a.label} sub={t('ตัวคูณ ×{factor}', { factor: a.factor })} />
          ))}
        </section>

        <section className="col gap8" role="radiogroup" aria-label={t('เป้าหมาย')}>
          <h2 className="h3">{t('เป้าหมาย')}</h2>
          {GOALS.map((g) => (
            <OptionCard key={g.key} checked={goal === g.key} onClick={() => setGoal(g.key)} title={g.title} sub={g.sub} />
          ))}
          {goal !== 'maintain' && (
            <>
              <NumField label={t('น้ำหนักเป้าหมาย')} suffix={t('กก.')} value={targetKg} onChange={setTarget} error={tried || targetKg !== null ? target.error : null} />
              {target.warning && <p className="caption" style={{ color: 'var(--calorie)' }}>⚠️ {target.warning}</p>}
              <div className="field">
                <span className="field-label">{t('ความเร็วที่ต้องการ (กก. ต่อสัปดาห์)')}</span>
                <div className="chips" role="radiogroup" aria-label={t('ความเร็ว')}>
                  {PACES.map((v) => (
                    <Chip key={v} selected={pace === v} onClick={() => setPace(v)} role="radio" aria-checked={pace === v}>{t('{v} กก.', { v })}</Chip>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="col gap8" aria-label={t('สัดส่วนสารอาหาร')}>
          <h2 className="h3">{t('สัดส่วนสารอาหาร')}</h2>
          <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }} role="radiogroup" aria-label={t('สัดส่วนสารอาหาร')}>
            {MACRO_PRESETS.map((m) => (
              <Chip key={m.key} selected={presetKey === m.key} onClick={() => setPreset(m.key)} role="radio" aria-checked={presetKey === m.key}>{m.label}</Chip>
            ))}
          </div>
          {plan && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <span className="macro-pill protein">{Math.round((effectiveKcal * split.protein) / 400)} g<small>{t('โปรตีน')}</small></span>
              <span className="macro-pill carb">{Math.round((effectiveKcal * split.carb) / 400)} g<small>{t('คาร์บ')}</small></span>
              <span className="macro-pill fat">{Math.round((effectiveKcal * split.fat) / 900)} g<small>{t('ไขมัน')}</small></span>
            </div>
          )}
        </section>

        <section className="group" aria-label={t('ตั้งค่าเอง')}>
          <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => setKcalManual(!kcalManual)}>
            <span className="grow col">
              <span className="row-title">{t('ตั้งแคลอรี่เป้าหมายเอง')}</span>
              <span className="row-sub">{kcalManual ? t('ใช้ค่าที่คุณกำหนด ไม่คำนวณใหม่อัตโนมัติ') : plan ? t('ใช้ค่าที่คำนวณได้ {kcal} kcal', { kcal: fmtInt(plan.goal.kcal) }) : ''}</span>
            </span>
            <Toggle checked={kcalManual} onChange={setKcalManual} label={t('ตั้งแคลอรี่เป้าหมายเอง')} />
          </div>
          {kcalManual && (
            <div style={{ padding: '0 16px 16px' }}>
              <NumField label={t('แคลอรี่ต่อวัน')} suffix="kcal" decimals={false} value={kcalValue} onChange={setKcalValue} error={kcalErr} hint={plan ? t('ค่าที่แอปแนะนำ {kcal} kcal', { kcal: fmtInt(plan.goal.kcal) }) : undefined} />
              {lowKcal && <p className="caption" style={{ color: 'var(--calorie)', marginTop: 8 }}>{t('⚠️ ต่ำกว่าขั้นต่ำที่ปลอดภัย ({sex} kcal) ควรปรึกษาแพทย์หรือนักกำหนดอาหาร', { sex: fmtInt(minSafeKcal(sex)) })}</p>}
              {plan && <Button variant="outline" small block={false} style={{ marginTop: 8 }} onClick={() => setKcalValue(plan.goal.kcal)}>{t('ใช้ค่าแนะนำ')}</Button>}
            </div>
          )}
          <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => setWaterManual(!waterManual)}>
            <span className="grow col">
              <span className="row-title">{t('ตั้งเป้าน้ำดื่มเอง')}</span>
              <span className="row-sub">{waterManual ? t('ใช้ค่าที่คุณกำหนด') : plan ? t('ใช้ค่าที่คำนวณได้ {waterMl} มล.', { waterMl: fmtInt(plan.waterMl) }) : ''}</span>
            </span>
            <Toggle checked={waterManual} onChange={setWaterManual} label={t('ตั้งเป้าน้ำดื่มเอง')} />
          </div>
          {waterManual && (
            <div style={{ padding: '0 16px 16px' }}>
              <NumField label={t('น้ำดื่มต่อวัน')} suffix={t('มล.')} decimals={false} value={waterValue} onChange={setWaterValue} error={waterErr} />
            </div>
          )}
          <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => setAutoAdjust(!autoAdjust)}>
            <span className="grow col">
              <span className="row-title">{t('ปรับเป้าอัตโนมัติ')}</span>
              <span className="row-sub">{t('คำนวณเป้าใหม่ทุกครั้งที่บันทึกน้ำหนักใหม่ (ไม่ทับค่าที่ตั้งเอง)')}</span>
            </span>
            <Toggle checked={autoAdjust} onChange={setAutoAdjust} label={t('ปรับเป้าอัตโนมัติ')} />
          </div>
        </section>
        <p className="caption muted">{t('ค่าเป็นการประมาณจากสูตร Mifflin-St Jeor ไม่ใช่คำแนะนำทางการแพทย์ หากมีโรคประจำตัวหรือตั้งครรภ์ ควรปรึกษาแพทย์')}</p>
      </main>
      <div className="footer-bar">
        <Button onClick={save} disabled={saving}>{t('บันทึกเป้าหมาย')}</Button>
      </div>
    </>
  );
}
