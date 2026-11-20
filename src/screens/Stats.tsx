import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, Flame, Sparkles, Trophy, Activity as Pulse } from 'lucide-react';
import { useApp, useProfile } from '../app/context';
import { useRangeData } from '../app/hooks';
import { addDays, diffDays, rangeDays, THAI_DOW_SHORT, weekStart, parseISO } from '../lib/date';
import {
  averageKcal,
  buildBars,
  buildHeatmap,
  macroShare,
  rangeWindow,
  summarizeDays,
  weeklyInsights,
  type Insight,
  type StatsRange,
} from '../lib/stats';
import { macroGrams } from '../lib/nutrition';
import { computeStreak } from '../lib/streak';
import { BarChart } from '../ui/charts';
import { Segmented } from '../ui/kit';
import { fmtInt } from '../lib/format';

import { lang, t } from '../i18n';
const RANGES: { value: StatsRange; label: string }[] = [
  { value: 'week', label: t('สัปดาห์') },
  { value: 'month', label: t('เดือน') },
  { value: 'year', label: t('ปี') },
];

const ICONS = { sparkle: Sparkles, pulse: Pulse, drop: Droplet, trophy: Trophy } as const;

function InsightCard({ i }: { i: Insight }) {
  const Icon = ICONS[i.icon];
  return (
    <div className={`tip ${i.tone === 'warn' ? 'warn' : i.tone === 'info' ? 'info' : ''}`} style={{ alignItems: 'flex-start' }}>
      <span className="icon-slot" style={{ background: i.tone === 'warn' ? 'var(--calorie)' : 'var(--brand)', color: '#fff', borderRadius: 999 }}>
        <Icon size={18} />
      </span>
      <span className="col grow">
        <b>{i.title}</b>
        <span className="caption">{i.body}</span>
      </span>
    </div>
  );
}

export default function Stats() {
  const p = useProfile();
  const nav = useNavigate();
  const { today } = useApp();
  const [range, setRange] = useState<StatsRange>('week');

  const win = rangeWindow(range, today);
  const heatStart = addDays(weekStart(today), -21);
  // โหลดครอบคลุมทั้งช่วงของกราฟ + ตารางสตรีค 4 สัปดาห์ + 7 วันสำหรับสรุป
  const start = [win.start, heatStart].sort()[0];
  const end = [win.end, today].sort().reverse()[0];
  const data = useRangeData(start, end);

  const { byDate, all } = useMemo(() => {
    const dates = rangeDays(start, diffDays(end, start) + 1);
    const list = summarizeDays(dates, data.entries, data.water, data.acts);
    return { all: list, byDate: new Map(list.map((d) => [d.date, d])) };
  }, [start, end, data.entries, data.water, data.acts]);

  const inRange = all.filter((d) => d.date >= win.start && d.date <= win.end && d.date <= today);
  const bars = buildBars(range, today, byDate);
  const heat = buildHeatmap(today, byDate, p.kcalGoal);
  const share = macroShare(inRange);
  const avg = averageKcal(inRange);
  const logged = inRange.filter((d) => d.logged);
  const goals = macroGrams(p.kcalGoal, p.split);
  const insights = weeklyInsights(today, all, { kcal: p.kcalGoal, protein: goals.protein, water: p.waterGoalMl });
  const streak = computeStreak(all.filter((d) => d.logged).map((d) => d.date), today);
  const delta = avg - p.kcalGoal;
  const hasData = logged.length > 0;
  const label = range === 'week' ? t('สัปดาห์นี้') : range === 'month' ? t('เดือนนี้') : t('ปี {v1}', { v1: parseISO(today).getFullYear() + (lang === 'th' ? 543 : 0) });

  return (
    <main className="screen" aria-label={t('สถิติ')}>
      <div className="page-title" style={{ padding: 'calc(8px + env(safe-area-inset-top)) 0 0' }}>
        <h1 className="h1" style={{ fontSize: 24 }}>{t('สถิติ')}</h1>
      </div>
      <Segmented value={range} onChange={setRange} options={RANGES} />

      <section className="card card-pad col gap12" aria-label={t('แคลอรี่เฉลี่ย')}>
        <div className="row-flex between" style={{ alignItems: 'flex-end' }}>
          <div className="col">
            <span className="caption">{t('แคลอรี่เฉลี่ย')}{range === 'year' ? t('ต่อวัน') : t('ต่อวัน')} · {label}</span>
            <div className="row-flex" style={{ alignItems: 'flex-end', gap: 6 }}>
              <span className="num-xl" style={{ fontSize: 44 }} data-testid="avg-kcal">{hasData ? fmtInt(avg) : '–'}</span>
              <span className="body-medium t2" style={{ marginBottom: 6 }}>kcal</span>
            </div>
          </div>
          {hasData && (
            <span className={`pill ${delta > p.kcalGoal * 0.05 ? 'calorie' : 'brand'}`}>
              {delta === 0 ? t('ตรงเป้า') : t('{v1}{delta} จากเป้า', { v1: delta > 0 ? '+' : '−', delta: fmtInt(Math.abs(delta)) })}
            </span>
          )}
        </div>
        <BarChart bars={bars} goal={p.kcalGoal} label={range === 'week' ? t('กราฟแคลอรี่รายวัน') : range === 'month' ? t('กราฟแคลอรี่รายวันของเดือน') : t('กราฟแคลอรี่เฉลี่ยรายเดือน')} />
        <p className="caption muted">
          {hasData ? t('บันทึกแล้ว {count} วัน', { count: logged.length }) : t('ยังไม่มีข้อมูลในช่วงนี้')}{' '}{t('· สีส้มคือวันที่เกินเป้าเกิน 5% · แท่งจางคือวันนี้ (ยังบันทึกไม่ครบ)')}</p>
      </section>

      <section className="card card-pad col gap12" aria-label={t('สัดส่วนสารอาหาร')}>
        <h2 className="h3">{t('สัดส่วนสารอาหาร')}</h2>
        {hasData ? (
          <>
            <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden' }} role="img" aria-label={t('โปรตีน {protein}% คาร์บ {carb}% ไขมัน {fat}%', { protein: share.protein, carb: share.carb, fat: share.fat })}>
              <i style={{ width: `${share.protein}%`, background: 'var(--protein)' }} />
              <i style={{ width: `${share.carb}%`, background: 'var(--carb)' }} />
              <i style={{ width: `${share.fat}%`, background: 'var(--fat)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <span className="macro-pill protein">{share.protein}%<small>{t('โปรตีน · {protein} g', { protein: share.avgGrams.protein })}</small></span>
              <span className="macro-pill carb">{share.carb}%<small>{t('คาร์บ · {carb} g', { carb: share.avgGrams.carb })}</small></span>
              <span className="macro-pill fat">{share.fat}%<small>{t('ไขมัน · {fat} g', { fat: share.avgGrams.fat })}</small></span>
            </div>
            <p className="caption muted">{t('เป้าหมายของคุณ {protein}/{carb}/{fat}% · ตัวเลข g คือค่าเฉลี่ยต่อวัน', { protein: p.split.protein, carb: p.split.carb, fat: p.split.fat })}</p>
          </>
        ) : (
          <p className="caption muted">{t('บันทึกอาหารเพื่อดูสัดส่วนโปรตีน คาร์บ ไขมัน')}</p>
        )}
      </section>

      <section className="col gap8" aria-label={t('ข้อมูลเชิงลึก')}>
        <h2 className="h3">{t('สรุปจาก 7 วันที่ผ่านมา')}</h2>
        {insights.map((i, k) => (
          <InsightCard key={k} i={i} />
        ))}
      </section>

      <section className="card card-pad col gap12" aria-label={t('สตรีค')}>
        <div className="row-flex between">
          <h2 className="h3">{t('สตรีคการบันทึก')}</h2>
          <button type="button" className="pill calorie" onClick={() => nav('/rewards')}>
            <Flame size={14} />{' '}{t('{current} วัน', { current: streak.current })}</button>
        </div>
        <div className="heat" role="grid" aria-label={t('ตารางบันทึก 4 สัปดาห์')}>
          {THAI_DOW_SHORT.map((d) => (
            <span key={d} className="dow">{d}</span>
          ))}
          {heat.map((c) => {
            const [kind, base] = c.status.startsWith('today-') ? ['today', c.status.slice(6)] : ['', c.status];
            return (
              <span
                key={c.date}
                role="gridcell"
                aria-label={`${c.date}: ${base === 'ok' ? t('อยู่ในเป้า') : base === 'over' ? t('เกินเป้า') : base === 'future' ? t('ยังไม่ถึง') : t('ไม่ได้บันทึก')}`}
                className={`c ${base === 'ok' ? 'ok' : base === 'over' ? 'over' : base === 'future' ? 'future' : ''} ${kind}`}
              >
                {base === 'ok' || base === 'over' ? <span style={{ fontSize: 11, fontWeight: 700 }}>{parseISO(c.date).getDate()}</span> : null}
              </span>
            );
          })}
        </div>
        <div className="row-flex caption" style={{ gap: 14 }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--brand)', marginRight: 4 }} />{t('อยู่ในเป้า')}</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--calorie)', marginRight: 4 }} />{t('เกินเป้า')}</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--bg-subtle)', marginRight: 4 }} />{t('ไม่ได้บันทึก')}</span>
        </div>
      </section>
    </main>
  );
}
