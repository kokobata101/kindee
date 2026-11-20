import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../app/context';
import { useDay, useWeights } from '../app/hooks';
import { ACTIVITY_TYPES, INTENSITY_LABEL, activityTypeByKey, metFor, type Intensity } from '../lib/activities';
import { activityKcal } from '../lib/nutrition';
import { deleteActivity, logActivity } from '../db/repo';
import { Button, Chip, Empty, Header, Segmented, Stepper } from '../ui/kit';
import { fmtInt, fmtNum } from '../lib/format';
import { formatThaiLong, nowHM } from '../lib/date';
import { useProfile } from '../app/context';

import { t, tc } from '../i18n';
const QUICK_MINUTES = [15, 30, 45, 60];

export default function Activity() {
  const p = useProfile();
  const { date, today, toast, confirm } = useApp();
  const day = useDay(date);
  const { latest } = useWeights();
  const weightKg = latest?.kg ?? p.startWeightKg;

  const [typeKey, setTypeKey] = useState('walk');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [minutes, setMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  const met = metFor(typeKey, intensity);
  const est = activityKcal(met, weightKg, minutes);
  const type = activityTypeByKey(typeKey)!;

  async function save() {
    setSaving(true);
    try {
      await logActivity({ typeKey, intensity, minutes, date, time: nowHM() });
      toast(t('บันทึก{name} {minutes} นาที · {est} kcal', { name: t(type.name), minutes, est: fmtInt(est) }));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('บันทึกไม่สำเร็จ'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title={t('บันทึกกิจกรรม')} />
      <main className="screen no-tabs">
        {date !== today && <p className="pill warn" style={{ alignSelf: 'flex-start' }}>{t('บันทึกย้อนหลัง · {date}', { date: formatThaiLong(date) })}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <div className="macro-pill cal" style={{ padding: 12 }}><span className="num-m">{fmtInt(day.burned)}</span><small>{t('kcal เผาผลาญ')}</small></div>
          <div className="macro-pill protein" style={{ padding: 12, background: 'var(--brand-soft)', color: 'var(--brand-dark)' }}><span className="num-m">{fmtInt(day.activeMinutes)}</span><small>{t('นาที')}</small></div>
          <div className="macro-pill protein" style={{ padding: 12, background: 'var(--water-soft)', color: 'var(--water)' }}><span className="num-m">{day.acts.length}</span><small>{tc('count', 'ครั้ง')}</small></div>
        </div>

        <section className="card card-pad col gap16" aria-label={t('เพิ่มกิจกรรม')}>
          <h2 className="h3">{t('เพิ่มกิจกรรม')}</h2>
          <div className="chips wrap" style={{ flexWrap: 'wrap', overflow: 'visible' }} role="radiogroup" aria-label={t('ชนิดกิจกรรม')}>
            {ACTIVITY_TYPES.map((a) => (
              <Chip key={a.key} selected={typeKey === a.key} role="radio" aria-checked={typeKey === a.key} onClick={() => setTypeKey(a.key)}>
                {a.emoji} {t(a.name)}
              </Chip>
            ))}
          </div>

          <div className="col gap8">
            <div className="row-flex between">
              <span className="body-medium">{t('ระยะเวลา')}</span>
              <Stepper label={t('ระยะเวลา')} value={minutes} onChange={setMinutes} step={5} min={5} max={600} format={(n) => t('{n} นาที', { n })} />
            </div>
            <div className="chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', overflow: 'visible' }} role="group" aria-label={t('เลือกเวลาด่วน')}>
              {QUICK_MINUTES.map((m) => (
                <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)} style={{ justifyContent: 'center', padding: '0 4px' }}>{t('{m} นาที', { m })}</Chip>
              ))}
            </div>
          </div>

          <div className="col gap8">
            <span className="body-medium">{t('ความหนัก')}</span>
            <Segmented
              value={intensity}
              onChange={setIntensity}
              options={(['light', 'moderate', 'vigorous'] as Intensity[]).map((i) => ({ value: i, label: INTENSITY_LABEL[i] }))}
            />
          </div>

          <div className="card-pad" style={{ background: 'var(--calorie-soft)', borderRadius: 18 }} aria-live="polite">
            <div className="caption">{t('ประมาณการเผาผลาญ')}</div>
            <div className="num-l" style={{ color: 'var(--calorie)' }} data-testid="estimate">≈ {fmtInt(est)} kcal</div>
            <div className="caption">{t('MET {met} × น้ำหนัก {weightKg} กก. × {fmtNum} ชม.', { met: fmtNum(met), weightKg: fmtNum(weightKg), fmtNum: fmtNum(minutes / 60, 2) })}</div>
          </div>
          <Button onClick={save} disabled={saving}>{t('บันทึกกิจกรรม')}</Button>
        </section>

        <section className="col gap8" aria-label={t('กิจกรรมที่บันทึก')}>
          <h2 className="h3">{t('บันทึกของวันนี้')}</h2>
          {day.acts.length === 0 && <Empty emoji="🏃" title={t('ยังไม่ได้บันทึกกิจกรรม')}>{t('เดิน วิ่ง หรือยกเวท บันทึกไว้เพื่อให้แคลอรี่คงเหลือแม่นยำขึ้น')}</Empty>}
          {day.acts.map((a) => (
            <div key={a.id} className="food-row">
              <span className="thumb" aria-hidden>{a.emoji}</span>
              <span className="grow col">
                <span className="row-title" style={{ fontWeight: 600 }}>{t(a.name)}</span>
                <span className="row-sub">{t('{minutes} นาที · {v2} · {time}', { minutes: a.minutes, v2: INTENSITY_LABEL[a.intensity], time: a.time })}</span>
              </span>
              <span className="kcal" style={{ color: 'var(--brand)' }}>+{fmtInt(a.kcal)}<small>kcal</small></span>
              <button
                type="button"
                className="round-btn"
                aria-label={t('ลบกิจกรรม {name}', { name: t(a.name) })}
                onClick={async () => {
                  if (await confirm({ title: t('ลบ "{name}" ?', { name: t(a.name) }), confirmLabel: t('ลบ'), danger: true })) {
                    await deleteActivity(a.id!);
                    toast(t('ลบกิจกรรมแล้ว'));
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
        <p className="caption muted">{t('ค่าเผาผลาญคำนวณจากสูตร MET × น้ำหนัก × เวลา เป็นการประมาณ การเผาผลาญจริงต่างกันตามบุคคล')}</p>
      </main>
    </>
  );
}
