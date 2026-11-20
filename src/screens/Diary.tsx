import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsRight, Copy, Plus, Repeat, Utensils } from 'lucide-react';
import { useApp, useProfile } from '../app/context';
import { useDay } from '../app/hooks';
import { MEALS, type Entry } from '../db/types';
import { addDays, dowIndex, formatThaiDate, THAI_DOW_FULL } from '../lib/date';
import { fmtInt, pct } from '../lib/format';
import { remainingKcal } from '../lib/diary';
import { copyDay, deleteActivity, findPreviousLoggedDay } from '../db/repo';
import { Button, IconButton } from '../ui/kit';
import { EntrySheet, MealSection } from '../ui/parts';
import { Trash2 } from 'lucide-react';

import { t } from '../i18n';
export default function Diary() {
  const p = useProfile();
  const { today, date, setDate, toast, confirm } = useApp();
  const nav = useNavigate();
  const day = useDay(date);
  const [editing, setEditing] = useState<Entry | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  const remaining = remainingKcal(p.kcalGoal, day.totals.kcal, day.burned);
  const isToday = date === today;
  const budget = p.kcalGoal + day.burned;
  // แถบแบ่งตามพลังงานจากโปรตีน/คาร์บ/ไขมัน (4/4/9 kcal ต่อ g) เทียบกับโควตาวัน
  const segs = (() => {
    const parts = [
      { key: 'protein', kcal: day.totals.protein * 4 },
      { key: 'carb', kcal: day.totals.carb * 4 },
      { key: 'fat', kcal: day.totals.fat * 9 },
    ];
    const macroKcal = parts.reduce((s, x) => s + x.kcal, 0);
    const used = Math.min(1, budget > 0 ? day.totals.kcal / budget : 0) * 100;
    return parts.map((x) => ({ key: x.key, pct: macroKcal > 0 ? (x.kcal / macroKcal) * used : 0 }));
  })();

  async function copyFromPrevious() {
    const from = await findPreviousLoggedDay(date);
    if (!from) {
      toast(t('ไม่พบวันที่มีบันทึกใน 7 วันก่อนหน้า'), 'error');
      return;
    }
    const ok = await confirm({
      title: t('คัดลอกจาก {from} ?', { from: formatThaiDate(from, false) }),
      body: day.entries.length ? t('รายการจะถูกเพิ่มต่อจากที่มีอยู่แล้วในวันนี้') : t('ทุกมื้อของวันนั้นจะถูกคัดลอกมาที่วันนี้'),
      confirmLabel: t('คัดลอก'),
    });
    if (!ok) return;
    const n = await copyDay(from, date);
    toast(t('คัดลอก {n} รายการแล้ว', { n }));
  }

  return (
    <main className="screen" aria-label={t('ไดอารี่')}>
      <div className="page-title" style={{ padding: 'calc(8px + env(safe-area-inset-top)) 0 0' }}>
        <h1 className="h1" style={{ fontSize: 24 }}>{t('ไดอารี่')}</h1>
        <IconButton label={t('เลือกวันที่')} onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.click()}>
          <CalendarDays size={20} />
        </IconButton>
        <input
          ref={dateInput}
          type="date"
          aria-label={t('เลือกวันที่')}
          max={today}
          value={date}
          onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
          tabIndex={-1}
        />
      </div>

      <div className="card row-flex between" style={{ padding: '8px 10px' }}>
        <IconButton label={t('วันก่อนหน้า')} plain onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <div className="col center">
          <span className="caption">{isToday ? t('วันนี้') : THAI_DOW_FULL[dowIndex(date)]}</span>
          <b data-testid="diary-date">{formatThaiDate(date)}</b>
        </div>
        <IconButton label={t('วันถัดไป')} plain disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <section className="card card-pad col gap12" aria-label={t('สรุปแคลอรี่')}>
        <div className="col" style={{ gap: 2 }}>
          <span className="caption">{t('แคลอรี่คงเหลือ')}</span>
          <span className="row-flex" style={{ alignItems: 'baseline', gap: 6 }}>
            <b className="num-xl" data-testid="diary-remaining" style={{ color: remaining < 0 ? 'var(--calorie)' : undefined }}>{fmtInt(remaining)}</b>
            <span className="caption">kcal</span>
          </span>
        </div>
        <div
          className={`segbar ${remaining < 0 ? 'over' : ''}`}
          role="progressbar"
          aria-label={t('แคลอรี่ที่กินแล้ว')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct(day.totals.kcal, budget) * 100)}
        >
          {segs.map((s) => (
            <i key={s.key} className={`s-${s.key}`} style={{ width: `${s.pct}%` }} />
          ))}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--sky-deep)' }} />{t('โปรตีน')} {Math.round(day.totals.protein)} g</span>
          <span><i style={{ background: 'var(--mint-deep)' }} />{t('คาร์บ')} {Math.round(day.totals.carb)} g</span>
          <span><i style={{ background: '#f2d94a' }} />{t('ไขมัน')} {Math.round(day.totals.fat)} g</span>
        </div>
        <div className="row-flex between glass" style={{ textAlign: 'center', padding: '10px 12px', background: 'var(--bg-subtle)' }}>
          <div className="col"><b className="num-m">{fmtInt(p.kcalGoal)}</b><span className="caption">{t('เป้าหมาย')}</span></div>
          <span className="muted">−</span>
          <div className="col"><b className="num-m" style={{ color: 'var(--calorie)' }}>{fmtInt(day.totals.kcal)}</b><span className="caption">{t('อาหาร')}</span></div>
          <span className="muted">+</span>
          <div className="col"><b className="num-m" style={{ color: 'var(--brand-dark)' }}>{fmtInt(day.burned)}</b><span className="caption">{t('กิจกรรม')}</span></div>
          <span className="muted">=</span>
          <div className="col"><b className="num-m">{fmtInt(remaining)}</b><span className="caption">{t('คงเหลือ')}</span></div>
        </div>
      </section>

      {MEALS.map((m) => (
        <MealSection key={m.key} meal={m.key} entries={day.byMeal[m.key]} date={date} onEdit={setEditing} />
      ))}

      {day.acts.length > 0 && (
        <section className="col gap8" aria-label={t('กิจกรรม')}>
          <div className="meal-head">
            <span>{t('🏃 กิจกรรม')}</span>
            <span className="t">{fmtInt(day.burned)} kcal</span>
          </div>
          {day.acts.map((a) => (
            <div key={a.id} className="food-row">
              <span className="thumb" aria-hidden>{a.emoji}</span>
              <span className="grow col">
                <span className="row-title" style={{ fontWeight: 600 }}>{t(a.name)}</span>
                <span className="row-sub">{t('{minutes} นาที · {time}', { minutes: a.minutes, time: a.time })}</span>
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
      )}

      <button type="button" className="cta-pill" onClick={() => nav(`/add?date=${date}`)}>
        <span className="cta-ico"><Plus size={22} /></span>
        <span className="cta-label">{t('นับแคลอรี่')} <ChevronsRight size={22} /></span>
        <span className="cta-ico" aria-hidden><Utensils size={20} /></span>
      </button>

      <div className="row-flex" style={{ alignItems: 'stretch' }}>
        <Button variant="outline" small onClick={copyFromPrevious}>
          <Copy size={16} />{' '}{t('คัดลอกจากวันก่อน')}</Button>
        <Button variant="outline" small onClick={() => nav('/schedules')}>
          <Repeat size={16} />{' '}{t('ตั้งเวลาอัตโนมัติ')}</Button>
      </div>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </main>
  );
}
