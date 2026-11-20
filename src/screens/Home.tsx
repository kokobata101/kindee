import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Bookmark, Droplet, Flame, Minus, ScanLine, Search, Sparkles, TrendingDown, TrendingUp, Utensils, Zap } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useApp, useProfile } from '../app/context';
import { useDay, useRangeData, useWeights } from '../app/hooks';
import { MEALS, type Entry } from '../db/types';
import { addDays, dowIndex, formatThaiLong, greetingFor, parseISO, rangeDays, THAI_DOW_SHORT, weekStart } from '../lib/date';
import { macroGrams } from '../lib/nutrition';
import { fmtInt, fmtKg, fmtLiters, pct } from '../lib/format';
import { remainingKcal } from '../lib/diary';
import { summarizeDays, todayTip } from '../lib/stats';
import { computeStreak } from '../lib/streak';
import { weightStats } from '../lib/weight';
import { addWater } from '../db/repo';
import { nowHM } from '../lib/date';
import { Gauge, IconSlot, Ring, Sparkline } from '../ui/kit';
import { EntrySheet, MealSection } from '../ui/parts';

import { t } from '../i18n';
export default function Home() {
  const p = useProfile();
  const { today, date, setDate, toast } = useApp();
  const nav = useNavigate();
  const day = useDay(date);
  const [editing, setEditing] = useState<Entry | null>(null);

  const ws = weekStart(date);
  const week = rangeDays(ws, 7);
  // ช่วงเดียวครอบคลุมทั้งสัปดาห์ที่เลือกและ 7 วันล่าสุดที่นับถึงวันที่เลือก
  const range = useRangeData(addDays(date, -6), addDays(ws, 6));
  const weekSum = summarizeDays(week, range.entries, range.water, range.acts);
  const last7 = summarizeDays(rangeDays(addDays(date, -6), 7), range.entries, range.water, range.acts);
  const loggedInWeek = new Set(weekSum.filter((d) => d.logged).map((d) => d.date));
  const sparkValues = last7.map((d) => d.kcal);
  const loggedDays = last7.filter((d) => d.logged);
  const avg7 = loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0;
  const streakDays = useLiveQuery(async () => (await db.entries.orderBy('date').uniqueKeys()) as string[], []);
  const streak = computeStreak(streakDays ?? [], today);
  const weights = useWeights();
  const ws2 = weightStats(p, weights.logs);

  const goal = p.kcalGoal;
  const remaining = remainingKcal(goal, day.totals.kcal, day.burned);
  const budget = goal + day.burned;
  const over = remaining < 0;
  const macroGoal = macroGrams(goal, p.split);
  const hour = new Date().getHours();
  const tip = todayTip(day.totals, { kcal: goal, protein: macroGoal.protein, water: p.waterGoalMl }, day.burned, day.waterMl, hour);
  const isToday = date === today;
  const eatenPct = budget > 0 ? Math.round((day.totals.kcal / budget) * 100) : 0;
  const DeltaIcon = ws2.change < 0 ? TrendingDown : ws2.change > 0 ? TrendingUp : Minus;
  const maxWater = Math.max(p.waterGoalMl, ...weekSum.map((d) => d.water), 1);

  return (
    <main className="screen" aria-label={t('หน้าหลัก')}>
      <div className="page-title" style={{ padding: 'calc(8px + env(safe-area-inset-top)) 0 0', gap: 12 }}>
        <span className="avatar" aria-hidden>{Array.from(p.name.trim())[0]?.toUpperCase() ?? '🙂'}</span>
        <div className="col grow">
          <span className="caption">
            {greetingFor(hour)}, {p.name}
          </span>
          <h1 className="h1" style={{ fontSize: 22 }}>{formatThaiLong(date)}</h1>
        </div>
        <button type="button" className="pill calorie" onClick={() => nav('/rewards')} aria-label={t('ต่อเนื่อง {current} วัน ดูรางวัล', { current: streak.current })}>
          <Flame size={14} />{' '}{t('{current} วัน', { current: streak.current })}</button>
      </div>

      <div className="week-strip" role="group" aria-label={t('เลือกวัน')}>
        {week.map((d) => {
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              className={`day-btn ${d === date ? 'sel' : ''}`}
              disabled={future}
              aria-pressed={d === date}
              aria-label={formatThaiLong(d)}
              onClick={() => setDate(d)}
              style={future ? { opacity: 0.45 } : undefined}
            >
              {THAI_DOW_SHORT[dowIndex(d)]}
              <b>{parseISO(d).getDate()}</b>
              <i className={`dot ${loggedInWeek.has(d) ? '' : 'off'}`} />
            </button>
          );
        })}
      </div>
      {!isToday && (
        <button type="button" className="pill brand" style={{ alignSelf: 'flex-start' }} onClick={() => setDate(today)}>{t('← กลับไปวันนี้')}</button>
      )}

      <section className="card tone-sky hero-card" aria-label={t('แคลอรี่')}>
        <div className="hero-top">
          <span className="row-flex">
            <span className="chip-ico"><Utensils size={18} /></span>
            <h2 className="h3">{isToday ? t('แคลอรี่วันนี้') : t('แคลอรี่ของวันที่เลือก')}</h2>
          </span>
          <span className="pill" style={{ background: 'rgba(255,255,255,.75)', color: '#17231c' }}>{t('🎯 เป้าหมาย {goal}', { goal: fmtInt(goal) })}</span>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <span className="caption">{t('ใช้ไปแล้ว')}</span>
          <span className="big-pct" style={over ? { color: 'var(--calorie)' } : undefined}>{eatenPct}<small>%</small></span>
          <span className="caption">{t('ของโควตาวันนี้')}</span>
        </div>
        <Ring size={168} stroke={18} value={pct(day.totals.kcal, budget)} color={over ? 'var(--calorie)' : '#fff'} track="rgba(255,255,255,.45)">
          <span className="num-l" style={{ fontSize: 38, color: over ? 'var(--calorie)' : undefined }} data-testid="remaining">
            {fmtInt(Math.abs(remaining))}
          </span>
          <span className="caption">kcal {over ? t('เกินเป้า') : t('เหลือ')}</span>
        </Ring>
        <div className="hero-stats">
          <div className="glass">
            <span className="chip-ico"><Utensils size={18} /></span>
            <span className="col"><b>{fmtInt(day.totals.kcal)}</b><span className="caption">{t('กินแล้ว')}</span></span>
          </div>
          <div className="glass">
            <span className="chip-ico"><Flame size={18} /></span>
            <span className="col"><b>{fmtInt(day.burned)}</b><span className="caption">{t('เผาผลาญ')}</span></span>
          </div>
        </div>
        <p className="caption center" style={{ gridColumn: '1 / -1' }}>{t('เหลือ = เป้าหมาย − อาหาร + กิจกรรม')}</p>
      </section>

      <div className="row-flex" style={{ alignItems: 'stretch' }}>
        <button type="button" className="card tone-gray mini-card grow" onClick={() => nav('/weight')} aria-label={t('น้ำหนักปัจจุบัน {kg} กก.', { kg: fmtKg(ws2.current) })}>
          <span className="mini-top">
            <span className="caption">{t('น้ำหนักปัจจุบัน')}</span>
            <span className="chip-ico" style={{ width: 32, height: 32 }}><Activity size={16} /></span>
          </span>
          <span className="mini-val">{fmtKg(ws2.current)}<small>{t('กก.')}</small></span>
          <span className="delta"><DeltaIcon size={15} /> {ws2.change === 0 ? t('เท่าตอนเริ่ม') : t('{kg} กก. จากตอนเริ่ม', { kg: `${ws2.change > 0 ? '+' : ''}${fmtKg(ws2.change)}` })}</span>
        </button>
        <section className="card tone-gray mini-card grow" aria-label={t('แคลอรี่ 7 วันล่าสุด')}>
          <span className="mini-top">
            <span className="caption">{t('เฉลี่ย 7 วันล่าสุด')}</span>
            <span className="chip-ico" style={{ width: 32, height: 32 }}><Flame size={16} /></span>
          </span>
          <span className="mini-val">{fmtInt(avg7)}<small>kcal</small></span>
          <span style={{ color: 'var(--brand)' }}><Sparkline values={sparkValues} color="var(--brand)" /></span>
        </section>
      </div>

      <section className={`tip ${tip.tone === 'warn' ? 'warn' : ''}`} aria-label={t('คำแนะนำ')}>
        <IconSlot round><Sparkles size={18} /></IconSlot>
        <div className="col">
          <b>{t('คำแนะนำวันนี้')}</b>
          <span>{tip.text}</span>
        </div>
      </section>

      <section className="card card-pad col gap12" aria-label={t('สารอาหารหลัก')}>
        <h2 className="h3">{t('สารอาหารหลัก')}</h2>
        <div className="gauges">
          <Gauge tone="cal" label={t('แคลอรี่')} display={fmtInt(day.totals.kcal)} sub={`/ ${fmtInt(budget)}`} value={pct(day.totals.kcal, budget)} />
          <Gauge tone="protein" label={t('โปรตีน')} display={`${Math.round(day.totals.protein)}`} sub={`/ ${macroGoal.protein} g`} value={pct(day.totals.protein, macroGoal.protein)} />
          <Gauge tone="carb" label={t('คาร์บ')} display={`${Math.round(day.totals.carb)}`} sub={`/ ${macroGoal.carb} g`} value={pct(day.totals.carb, macroGoal.carb)} />
          <Gauge tone="fat" label={t('ไขมัน')} display={`${Math.round(day.totals.fat)}`} sub={`/ ${macroGoal.fat} g`} value={pct(day.totals.fat, macroGoal.fat)} />
        </div>
      </section>

      <section className="col gap8" aria-label={t('บันทึกด่วน')}>
        <h2 className="h3">{t('บันทึกด่วน')}</h2>
        <div className="quick-grid cols3">
          <button type="button" className="quick" onClick={() => nav(`/add?date=${date}`)}>
            <IconSlot round><Search size={20} /></IconSlot>{t('ค้นหาอาหาร')}</button>
          <button type="button" className="quick" onClick={() => nav(`/scan?date=${date}`)}>
            <IconSlot tone="water" round><ScanLine size={20} /></IconSlot>{t('สแกน')}</button>
          <button type="button" className="quick" onClick={() => nav(`/add?mode=quick&date=${date}`)}>
            <IconSlot tone="carb" round><Zap size={20} /></IconSlot>{t('แคลอรี่ด่วน')}</button>
          <button type="button" className="quick" onClick={() => nav(`/add?mode=combos&date=${date}`)}>
            <IconSlot round><Bookmark size={20} /></IconSlot>{t('มื้อประจำ')}</button>
          <button type="button" className="quick" onClick={() => nav('/activity')}>
            <IconSlot tone="calorie" round><Activity size={20} /></IconSlot>{t('กิจกรรม')}</button>
          <button
            type="button"
            className="quick"
            onClick={async () => {
              await addWater(250, date, nowHM());
              toast(t('เพิ่มน้ำ 250 มล. แล้ว'));
            }}
          >
            <IconSlot tone="water" round><Droplet size={20} /></IconSlot>{t('+ น้ำ 250')}</button>
        </div>
      </section>

      <section className="col gap12" aria-label={t('มื้ออาหาร')}>
        <div className="row-flex between">
          <h2 className="h3">{t('มื้ออาหาร')}</h2>
          <button type="button" className="link" onClick={() => nav('/diary')}>{t('ดูไดอารี่')}</button>
        </div>
        {MEALS.map((m) => (
          <MealSection key={m.key} meal={m.key} entries={day.byMeal[m.key]} date={date} onEdit={setEditing} />
        ))}
      </section>

      <section className="col gap8" aria-label={t('ติดตามประจำวัน')}>
        <h2 className="h3">{t('ติดตามประจำวัน')}</h2>
        <div className="row-flex" style={{ alignItems: 'stretch' }}>
          <button type="button" className="card tone-gray mini-card grow" onClick={() => nav('/activity')}>
            <span className="mini-top">
              <b>{t('กิจกรรม')}</b>
              <span className="chip-ico" style={{ width: 32, height: 32 }}><Activity size={16} /></span>
            </span>
            <span className="row-flex" style={{ justifyContent: 'center', margin: '2px 0' }}>
              <Ring size={92} stroke={11} value={pct(day.activeMinutes, 30)} color="var(--calorie)" track="var(--bg-card)">
                <span className="num-m">{fmtInt(day.activeMinutes)}</span>
                <span className="caption" style={{ fontSize: 11 }}>{t('นาที')}</span>
              </Ring>
            </span>
            <span className="sr-only">{t('{activeMinutes} นาที', { activeMinutes: fmtInt(day.activeMinutes) })}</span>
            <span className="caption center">{t('เผาผลาญ {burned} kcal', { burned: fmtInt(day.burned) })}</span>
          </button>
          <button type="button" className="card tone-sky mini-card grow" onClick={() => nav('/water')}>
            <span className="mini-top">
              <b>{t('น้ำดื่ม')}</b>
              <span className="chip-ico" style={{ width: 32, height: 32 }}><Droplet size={16} /></span>
            </span>
            <span className="num-m" style={{ fontSize: 17 }}>{t('{waterMl} / {waterGoalMl} ลิตร', { waterMl: fmtLiters(day.waterMl), waterGoalMl: fmtLiters(p.waterGoalMl) })}</span>
            <span className="wbars" aria-hidden>
              {weekSum.map((d) => (
                <span key={d.date} className={`wbar ${d.date === date ? 'sel' : ''}`}>
                  <span className="wbar-track"><i className="wbar-fill" style={{ height: `${Math.round(pct(d.water, maxWater) * 100)}%` }} /></span>
                  <span>{THAI_DOW_SHORT[dowIndex(d.date)]}</span>
                </span>
              ))}
            </span>
            <span className="caption">
              {day.waterMl >= p.waterGoalMl ? t('ครบเป้าแล้ว 🎉') : t('เหลืออีก {fmtInt} มล.', { fmtInt: fmtInt(p.waterGoalMl - day.waterMl) })}
            </span>
          </button>
        </div>
      </section>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </main>
  );
}
