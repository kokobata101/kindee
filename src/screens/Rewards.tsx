import { useLiveQuery } from 'dexie-react-hooks';
import { Flame } from 'lucide-react';
import { db } from '../db/db';
import { useApp, useProfile } from '../app/context';
import { computeRewards } from '../lib/rewards';
import { macroGrams } from '../lib/nutrition';
import { reachedTarget, latestWeight } from '../lib/weight';
import { formatThaiDate } from '../lib/date';
import { Header, ProgressBar } from '../ui/kit';

import { t } from '../i18n';
export default function Rewards() {
  const p = useProfile();
  const { today } = useApp();

  const data = useLiveQuery(async () => {
    const [entries, water, acts, weights] = await Promise.all([
      db.entries.toArray(),
      db.water.toArray(),
      db.activities.count(),
      db.weights.toArray(),
    ]);
    const logged = new Set<string>();
    const protein = new Map<string, number>();
    for (const e of entries) {
      logged.add(e.date);
      protein.set(e.date, (protein.get(e.date) ?? 0) + e.protein);
    }
    const waterByDay = new Map<string, number>();
    for (const w of water) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml);
    return { logged, protein, waterByDay, acts, weights };
  }, []);

  const proteinGoal = macroGrams(p.kcalGoal, p.split).protein;
  const summary = data
    ? computeRewards({
        today,
        loggedDays: data.logged,
        waterGoalDays: new Set([...data.waterByDay].filter(([, ml]) => ml >= p.waterGoalMl).map(([d]) => d)),
        proteinGoalDays: new Set([...data.protein].filter(([, g]) => g >= proteinGoal * 0.95).map(([d]) => d)),
        scanCount: 0,
        activityCount: data.acts,
        reachedWeightGoal: p.goal !== 'maintain' && reachedTarget(p.goal, latestWeight(data.weights)?.kg ?? p.startWeightKg, p.targetWeightKg),
      })
    : null;

  // เหรียญ "นักสแกน" จะแสดงเมื่อมีฟีเจอร์สแกนในเฟส 2–3 (ตอนนี้ยังไม่มีให้สะสม)
  const badges = summary?.badges.filter((b) => b.key !== 'scan50') ?? [];
  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <>
      <Header title={t('รางวัลและสตรีค')} />
      <main className="screen no-tabs">
        {!summary ? (
          <p className="muted center" role="status">{t('กำลังโหลด…')}</p>
        ) : (
          <>
            <section className="hero" aria-label={t('สตรีคปัจจุบัน')}>
              <div className="row-flex" style={{ gap: 12 }}>
                <span style={{ fontSize: 44 }} aria-hidden>🔥</span>
                <div className="col">
                  <span className="num-xl" data-testid="streak-now">{summary.streak.current}</span>
                  <span style={{ opacity: 0.78 }}>{t('วันต่อเนื่อง')}</span>
                </div>
              </div>
              <div style={{ opacity: 0.78, marginTop: 8 }}>
                {summary.streak.current === 0
                  ? t('บันทึกอาหารวันนี้เพื่อเริ่มสตรีค')
                  : summary.streak.todayDone
                    ? t('ตั้งแต่ {streakSince} · วันนี้บันทึกแล้ว ✓', { streakSince: formatThaiDate(summary.streakSince!, false) })
                    : t('ตั้งแต่ {streakSince} · บันทึกวันนี้เพื่อไม่ให้สตรีคขาด', { streakSince: formatThaiDate(summary.streakSince!, false) })}
              </div>
              <div style={{ opacity: 0.78, marginTop: 4 }}>{t('สตรีคยาวที่สุด {longest} วัน', { longest: summary.streak.longest })}</div>
              {summary.nextStreakGoal && (
                <div style={{ marginTop: 14 }}>
                  <div className="row-flex between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span>{t('เป้าถัดไป {nextStreakGoal} วัน', { nextStreakGoal: summary.nextStreakGoal })}</span>
                    <span>{summary.streak.current}/{summary.nextStreakGoal}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.7)', overflow: 'hidden' }}>
                    <i style={{ display: 'block', height: '100%', width: `${(summary.streak.current / summary.nextStreakGoal) * 100}%`, background: 'var(--calorie)' }} />
                  </div>
                </div>
              )}
            </section>

            <section className="col gap8" aria-label={t('เหรียญรางวัล')}>
              <div className="row-flex between">
                <h2 className="h3">{t('เหรียญรางวัล')}</h2>
                <span className="pill brand"><Flame size={14} /> {unlocked}/{badges.length}</span>
              </div>
              <div className="badge-grid">
                {badges.map((b) => (
                  <div key={b.key} className={`badge ${b.unlocked ? 'on' : ''}`} data-unlocked={b.unlocked} aria-label={`${b.title} ${b.unlocked ? t('ปลดล็อกแล้ว') : t('{progress} จาก {target}', { progress: b.progress, target: b.target })}`}>
                    <span className="em" aria-hidden>{b.emoji}</span>
                    <b className="name" style={{ fontSize: 13 }}>{b.title}</b>
                    <span className="caption" style={{ fontSize: 11 }}>{b.desc}</span>
                    {!b.unlocked && b.target > 1 && <div style={{ width: '80%' }}><ProgressBar value={b.progress / b.target} label={t('{title} ความคืบหน้า', { title: b.title })} /></div>}
                    {b.unlocked && <span className="caption" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>{t('✓ ได้แล้ว')}</span>}
                  </div>
                ))}
              </div>
            </section>
            <p className="caption muted">{t('ทุกเหรียญคำนวณจากข้อมูลที่บันทึกในเครื่องคุณ ไม่มีการเก็บเงินหรือปลดล็อกด้วยการจ่าย')}</p>
          </>
        )}
      </main>
    </>
  );
}
