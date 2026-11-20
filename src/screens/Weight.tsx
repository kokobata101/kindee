import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp, useProfile } from '../app/context';
import { useWeights } from '../app/hooks';
import { deleteWeight, setWeight } from '../db/repo';
import { Button, Chip, Empty, Header, IconButton, NumField, ProgressBar, Sheet, TextField } from '../ui/kit';
import { LineChart } from '../ui/charts';
import { bmiCategory } from '../lib/nutrition';
import { formatThaiDate } from '../lib/date';
import { fmtKg, fmtNum } from '../lib/format';
import {
  WEIGHT_RANGES,
  reachedTarget,
  weeklyAverages,
  weeksForRange,
  weightStats,
  withDeltas,
  type WeightRange,
} from '../lib/weight';
import { LIMITS } from '../lib/validate';

import { t } from '../i18n';
export default function Weight() {
  const p = useProfile();
  const { today, toast, confirm } = useApp();
  const { logs, latest, loading } = useWeights();
  const [range, setRange] = useState<WeightRange>('8w');
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const stats = weightStats(p, logs);
  const weeks = weeksForRange(range, logs, today);
  const points = useMemo(() => weeklyAverages(logs, today, weeks), [logs, today, weeks]);
  const rows = withDeltas(logs);
  const reached = reachedTarget(p.goal, stats.current, p.targetWeightKg);

  function openAdd() {
    setKg(latest?.kg ?? null);
    setDate(today);
    setNote('');
    setErr(null);
    setOpen(true);
  }

  async function save() {
    if (kg === null || kg < LIMITS.weight.min || kg > LIMITS.weight.max) return setErr(t('ใส่น้ำหนัก {min}–{max} กก.', { min: LIMITS.weight.min, max: LIMITS.weight.max }));
    if (date > today) return setErr(t('เลือกวันที่ไม่เกินวันนี้'));
    const existed = logs.some((l) => l.date === date);
    await setWeight(date, kg, note.trim() || undefined);
    setOpen(false);
    toast(existed ? t('อัปเดตน้ำหนักของวันนั้นแล้ว') : t('บันทึกน้ำหนักแล้ว'));
    if (reachedTarget(p.goal, kg, p.targetWeightKg) && p.goal !== 'maintain') toast(t('ถึงน้ำหนักเป้าหมายแล้ว 🎉'));
  }

  const changeText =
    stats.change === 0 ? t('เท่าตอนเริ่ม') : t('{v1}{change} กก.', { v1: stats.change > 0 ? '+' : '−', change: fmtNum(Math.abs(stats.change)) });
  const good = (p.goal === 'lose' && stats.change < 0) || (p.goal === 'gain' && stats.change > 0) || stats.change === 0;

  return (
    <>
      <Header
        title={t('น้ำหนักและร่างกาย')}
        action={<IconButton label={t('บันทึกน้ำหนัก')} onClick={openAdd}><Plus size={20} /></IconButton>}
      />
      <main className="screen no-tabs">
        <section className="card card-pad col gap12" aria-label={t('น้ำหนักล่าสุด')}>
          <div className="row-flex between" style={{ alignItems: 'flex-start' }}>
            <div className="col">
              <span className="caption">{t('น้ำหนักล่าสุด{v1}', { v1: latest ? ` · ${formatThaiDate(latest.date, false)}` : '' })}</span>
              <div className="row-flex" style={{ alignItems: 'flex-end', gap: 6 }}>
                <span className="num-xl" style={{ fontSize: 48 }} data-testid="weight-now">{fmtKg(stats.current)}</span>
                <span className="body-medium t2" style={{ marginBottom: 8 }}>{t('กก.')}</span>
              </div>
            </div>
            <span className={`pill ${good ? 'brand' : 'warn'}`}>{changeText}</span>
          </div>
          <ProgressBar value={stats.progress} label={t('ความคืบหน้าสู่เป้าหมาย')} />
          <div className="row-flex between caption">
            <span>{t('เริ่ม {start}', { start: fmtKg(stats.start) })}</span>
            <span style={{ fontWeight: 600, color: 'var(--brand-dark)' }}>
              {p.goal === 'maintain' ? t('รักษาน้ำหนัก') : reached ? t('ถึงเป้าหมายแล้ว 🎉') : t('ผ่านมา {round}% ของเป้า {targetWeightKg} กก.', { round: Math.round(stats.progress * 100), targetWeightKg: fmtKg(p.targetWeightKg) })}
            </span>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <div className="card card-pad col center" style={{ padding: 12 }}>
            <b className="num-m">{stats.bmiNow.toFixed(1)}</b>
            <span className="caption">{t('BMI ปัจจุบัน')}</span>
            <span className="caption muted" style={{ fontSize: 11 }}>{bmiCategory(stats.bmiNow)}</span>
          </div>
          <div className="card card-pad col center" style={{ padding: 12 }}>
            <b className="num-m">{stats.bmiAtGoal.toFixed(1)}</b>
            <span className="caption">{t('BMI เมื่อถึงเป้า')}</span>
          </div>
          <div className="card card-pad col center" style={{ padding: 12 }}>
            <b className="num-m">{fmtKg(stats.remaining)}</b>
            <span className="caption">{t('กก. ที่เหลือ')}</span>
          </div>
        </div>

        <section className="card card-pad col gap12" aria-label={t('แนวโน้มน้ำหนัก')}>
          <h2 className="h3">{t('แนวโน้มน้ำหนัก')}</h2>
          <div className="chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', overflow: 'visible' }} role="group" aria-label={t('ช่วงเวลา')}>
            {WEIGHT_RANGES.map((r) => (
              <Chip key={r.key} selected={range === r.key} onClick={() => setRange(r.key)} style={{ justifyContent: 'center', padding: '0 4px' }}>{r.label}</Chip>
            ))}
          </div>
          {logs.length === 0 && !loading ? (
            <Empty emoji="⚖️" title={t('ยังไม่มีข้อมูลน้ำหนัก')} />
          ) : (
            <LineChart
              values={points.map((x) => x.avg)}
              labels={points.map((x) => x.label)}
              target={p.goal === 'maintain' ? undefined : p.targetWeightKg}
              label={t('กราฟน้ำหนักเฉลี่ยรายสัปดาห์ ย้อนหลัง {weeks} สัปดาห์', { weeks })}
            />
          )}
          <p className="caption muted center">{t('น้ำหนักเฉลี่ยรายสัปดาห์ · แกนล่างคือสัปดาห์ที่')}</p>
        </section>

        <section className="col gap8" aria-label={t('บันทึกล่าสุด')}>
          <h2 className="h3">{t('บันทึกล่าสุด')}</h2>
          <div className="group">
            {rows.slice(0, 20).map((r) => (
              <div key={r.date} className="list-row" style={{ minHeight: 56 }}>
                <span className="grow col">
                  <span className="row-title">{formatThaiDate(r.date, false)}</span>
                  {r.note && <span className="row-sub">{r.note}</span>}
                </span>
                <b>{t('{kg} กก.', { kg: fmtKg(r.kg) })}</b>
                {r.delta !== null && (
                  <span className="caption" style={{ minWidth: 40, textAlign: 'right', color: r.delta === 0 ? undefined : (r.delta < 0) === (p.goal !== 'gain') ? 'var(--brand)' : 'var(--calorie)' }}>
                    {r.delta > 0 ? '+' : r.delta < 0 ? '−' : ''}{fmtNum(Math.abs(r.delta))}
                  </span>
                )}
                <button
                  type="button"
                  className="round-btn"
                  aria-label={t('ลบน้ำหนักวันที่ {date}', { date: r.date })}
                  disabled={logs.length <= 1}
                  onClick={async () => {
                    if (await confirm({ title: t('ลบบันทึกน้ำหนักนี้?'), body: formatThaiDate(r.date), confirmLabel: t('ลบ'), danger: true })) {
                      await deleteWeight(r.date);
                      toast(t('ลบแล้ว'));
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <Button onClick={openAdd}>{t('บันทึกน้ำหนัก')}</Button>
      </main>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('บันทึกน้ำหนัก')}>
        <div className="col gap16">
          <NumField label={t('น้ำหนัก')} suffix={t('กก.')} value={kg} onChange={setKg} error={err} />
          <TextField label={t('วันที่')} type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <TextField label={t('หมายเหตุ (ไม่บังคับ)')} placeholder={t('เช่น หลังตื่นนอน')} maxLength={60} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={save}>{t('บันทึก')}</Button>
        </div>
      </Sheet>
    </>
  );
}
