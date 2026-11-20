import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft } from 'lucide-react';
import { Button, Chip, IconButton, NumField, OptionCard, TextField } from '../ui/kit';
import { createProfile } from '../db/repo';
import { useApp } from '../app/context';
import {
  ACTIVITY_LEVELS,
  GOAL_LABEL,
  MACRO_PRESETS,
  PACES,
  bmi,
  bmiCategory,
  buildPlan,
  weeksToGoal,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '../lib/nutrition';
import { validateBody, validateTarget } from '../lib/validate';
import { fmtInt, fmtNum } from '../lib/format';

import { t, tc } from '../i18n';
const GOALS: { key: Goal; title: string; sub: string }[] = [
  { key: 'lose', title: t('ลดน้ำหนัก'), sub: t('กินน้อยกว่าที่ร่างกายใช้เล็กน้อย') },
  { key: 'maintain', title: t('รักษาน้ำหนัก'), sub: t('กินเท่ากับที่ร่างกายใช้') },
  { key: 'gain', title: t('เพิ่มน้ำหนัก'), sub: t('กินมากกว่าที่ร่างกายใช้เล็กน้อย') },
];

export default function Setup() {
  const nav = useNavigate();
  const { today, toast } = useApp();
  const [step, setStep] = useState(1);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<number | null>(null);
  const [heightCm, setHeight] = useState<number | null>(null);
  const [weightKg, setWeight] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<Goal>('lose');
  const [targetKg, setTarget] = useState<number | null>(null);
  const [pace, setPace] = useState<number>(0.5);
  const [presetKey, setPreset] = useState('balanced');

  const bodyErr = validateBody({ age, heightCm, weightKg });
  const bodyOk = Object.keys(bodyErr).length === 0;
  const target = bodyOk ? validateTarget(goal, weightKg!, targetKg, heightCm!) : {};
  const split = MACRO_PRESETS.find((p) => p.key === presetKey)!.split;

  const plan = useMemo(
    () =>
      bodyOk
        ? buildPlan({
            sex,
            weightKg: weightKg!,
            heightCm: heightCm!,
            age: age!,
            activity,
            goal,
            pace: goal === 'maintain' ? 0 : pace,
            split,
          })
        : null,
    [bodyOk, sex, weightKg, heightCm, age, activity, goal, pace, split],
  );

  function next() {
    setTried(true);
    if (step === 1 && !bodyOk) return;
    if (step === 2 && target.error) return;
    setTried(false);
    setStep(step + 1);
  }

  async function finish() {
    if (!plan || saving) return;
    setSaving(true);
    try {
      await createProfile(
        {
          name: name.trim() || t('ผู้ใช้'),
          sex,
          birthYear: new Date().getFullYear() - age!,
          heightCm: heightCm!,
          startWeightKg: weightKg!,
          targetWeightKg: goal === 'maintain' ? weightKg! : targetKg!,
          goal,
          pace: goal === 'maintain' ? 0 : pace,
          activity,
          presetKey,
          split,
          kcalGoal: plan.goal.kcal,
          kcalManual: false,
          waterGoalMl: plan.waterMl,
          waterManual: false,
          autoAdjust: true,
          theme: 'system',
        },
        today,
      );
      nav('/', { replace: true });
    } catch {
      toast(t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'), 'error');
      setSaving(false);
    }
  }

  // ใช้ความเร็วที่ทำได้จริงหลังปรับขั้นต่ำที่ปลอดภัย (ส่วนต่าง kcal/วัน × 7 ÷ 7,700)
  const realPace = plan ? (Math.abs(plan.goal.delta) * 7) / 7700 : 0;
  const weeks = plan && goal !== 'maintain' && targetKg ? weeksToGoal(weightKg!, targetKg, realPace) : 0;

  return (
    <main className="screen has-footer" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))', gap: 14 }}>
      <div className="row-flex" style={{ gap: 6 }} aria-hidden>
        {[1, 2, 3].map((i) => (
          <i key={i} className="grow" style={{ height: 6, borderRadius: 999, background: i <= step ? 'var(--brand)' : 'var(--bg-subtle)' }} />
        ))}
      </div>
      <div className="row-flex">
        {step > 1 ? (
          <IconButton label={t('ย้อนกลับ')} plain onClick={() => setStep(step - 1)}>
            <ChevronLeft size={22} />
          </IconButton>
        ) : null}
        <span className="caption">{t('ขั้นที่ {step} จาก 3', { step })}</span>
      </div>

      {step === 1 && (
        <>
          <div className="col gap4">
            <h1 className="h1">{t('เล่าเกี่ยวกับตัวคุณ')}</h1>
            <p className="t2">{t('ใช้คำนวณพลังงานที่ร่างกายต้องการต่อวัน ข้อมูลถูกคำนวณและเก็บในเครื่องเท่านั้น')}</p>
          </div>
          <TextField label={t('ชื่อเล่น (ไม่บังคับ)')} placeholder={t('เช่น มะนาว')} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
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
          <NumField label={t('น้ำหนักปัจจุบัน')} suffix={t('กก.')} value={weightKg} onChange={setWeight} error={tried ? bodyErr.weightKg : null} />
          <div className="col gap8" role="radiogroup" aria-label={t('ระดับกิจกรรม')}>
            <h2 className="h3" style={{ marginTop: 6 }}>{t('ระดับกิจกรรมในชีวิตประจำวัน')}</h2>
            {ACTIVITY_LEVELS.slice(0, 4).map((a) => (
              <OptionCard key={a.key} checked={activity === a.key} onClick={() => setActivity(a.key)} title={a.label} sub={t('ตัวคูณ ×{factor}', { factor: a.factor })} />
            ))}
          </div>
        </>
      )}

      {step === 2 && plan && (
        <>
          <div className="col gap4">
            <h1 className="h1">{t('เป้าหมายของคุณ')}</h1>
            <p className="t2">{t('เลือกเป้าหมายและความเร็ว แล้วแอปจะคำนวณแคลอรี่ให้')}</p>
          </div>
          <div className="col gap8" role="radiogroup" aria-label={t('เป้าหมาย')}>
            {GOALS.map((g) => (
              <OptionCard key={g.key} checked={goal === g.key} onClick={() => setGoal(g.key)} title={g.title} sub={g.sub} />
            ))}
          </div>
          {goal !== 'maintain' && (
            <>
              <NumField
                label={t('น้ำหนักเป้าหมาย')}
                suffix={t('กก.')}
                value={targetKg}
                onChange={setTarget}
                error={tried ? target.error : null}
                hint={t('ตอนนี้ {weightKg} กก. · BMI {weightKg2} ({weightKg3})', { weightKg: fmtNum(weightKg!), weightKg2: bmi(weightKg!, heightCm!).toFixed(1), weightKg3: bmiCategory(bmi(weightKg!, heightCm!)) })}
              />
              {target.warning && <p className="caption" style={{ color: 'var(--calorie)' }}>⚠️ {target.warning}</p>}
              <div className="field">
                <span className="field-label">{t('ความเร็วที่ต้องการ (กก. ต่อสัปดาห์)')}</span>
                <div className="chips" role="radiogroup" aria-label={t('ความเร็ว')}>
                  {PACES.map((p) => (
                    <Chip key={p} selected={pace === p} onClick={() => setPace(p)} role="radio" aria-checked={pace === p}>{t('{p} กก.', { p })}</Chip>
                  ))}
                </div>
                <span className="field-hint">{t('แนะนำไม่เกิน 0.5–1 กก./สัปดาห์ เพื่อสุขภาพและรักษากล้ามเนื้อ')}</span>
              </div>
            </>
          )}
        </>
      )}

      {step === 3 && plan && (
        <>
          <div className="col gap4">
            <h1 className="h1">{t('แผนของคุณ')}</h1>
            <p className="t2">{t('คำนวณจากสูตร Mifflin-St Jeor ปรับแก้ได้ทุกเมื่อในหน้าโปรไฟล์')}</p>
          </div>
          <div className="hero" aria-label={t('เป้าหมายแคลอรี่ต่อวัน')}>
            <div className="caption">{t('เป้าหมาย · {v1}', { v1: GOAL_LABEL[goal] })}</div>
            <div className="row-flex" style={{ alignItems: 'flex-end', gap: 8 }}>
              <span className="num-xl">{fmtInt(plan.goal.kcal)}</span>
              <span style={{ marginBottom: 10 }}>{t('kcal / วัน')}</span>
            </div>
            {weeks > 0 && <div style={{ opacity: 0.78 }}>{t('ถึง {targetKg} กก. ในประมาณ {weeks} สัปดาห์', { targetKg: fmtNum(targetKg!), weeks })}</div>}
          </div>
          {plan.goal.clamped && (
            <p className="caption" style={{ color: 'var(--calorie)' }}>{t('⚠️ ปรับขึ้นเป็น {minKcal} kcal เพื่อไม่ให้ต่ำกว่าขั้นต่ำที่ปลอดภัย (ลดน้ำหนักช้าลงกว่าที่เลือก)', { minKcal: fmtInt(plan.goal.minKcal) })}</p>
          )}
          <div className="group">
            <div className="list-row"><span className="grow">{t('พลังงานพื้นฐาน (BMR)')}</span><b>{fmtInt(plan.bmr)} kcal</b></div>
            <div className="list-row"><span className="grow">{t('พลังงานที่ใช้ต่อวัน (TDEE)')}</span><b>{fmtInt(plan.tdee)} kcal</b></div>
            <div className="list-row"><span className="grow">{t('เป้าหมายน้ำดื่ม')}</span><b>{t('{waterMl} มล.', { waterMl: fmtInt(plan.waterMl) })}</b></div>
          </div>
          <div className="field">
            <span className="field-label">{t('สัดส่วนสารอาหาร (โปรตีน / คาร์บ / ไขมัน)')}</span>
            <div className="chips" role="radiogroup" aria-label={t('สัดส่วนสารอาหาร')}>
              {MACRO_PRESETS.map((p) => (
                <Chip key={p.key} selected={presetKey === p.key} onClick={() => setPreset(p.key)} role="radio" aria-checked={presetKey === p.key}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <span className="macro-pill protein">{plan.macros.protein} g<small>{t('โปรตีน')}</small></span>
            <span className="macro-pill carb">{plan.macros.carb} g<small>{t('คาร์บ')}</small></span>
            <span className="macro-pill fat">{plan.macros.fat} g<small>{t('ไขมัน')}</small></span>
          </div>
          <p className="caption muted">{t('ค่าทั้งหมดเป็นการประมาณ ไม่ใช่คำแนะนำทางการแพทย์ หากมีโรคประจำตัว ตั้งครรภ์ หรืออายุต่ำกว่า 18 ปี ควรปรึกษาแพทย์ก่อน')}</p>
        </>
      )}

      <div className="footer-bar">
        {step < 3 ? (
          <Button onClick={next}>{t('ถัดไป')}</Button>
        ) : (
          <Button onClick={finish} disabled={saving}>
            <Check size={20} />{' '}{t('เริ่มใช้งาน')}</Button>
        )}
      </div>
    </main>
  );
}
