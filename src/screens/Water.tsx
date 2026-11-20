import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, Plus, Trash2 } from 'lucide-react';
import { useApp, useProfile } from '../app/context';
import { useDay } from '../app/hooks';
import { addWater, deleteWater } from '../db/repo';
import { Button, Empty, Header, NumField, Ring, Sheet } from '../ui/kit';
import { fmtInt, fmtLiters, pct } from '../lib/format';
import { formatThaiLong, nowHM } from '../lib/date';

import { t } from '../i18n';
const QUICK = [150, 250, 350, 500];

export default function Water() {
  const p = useProfile();
  const nav = useNavigate();
  const { date, today, toast } = useApp();
  const day = useDay(date);
  const [custom, setCustom] = useState(false);
  const [ml, setMl] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const left = Math.max(0, p.waterGoalMl - day.waterMl);
  const done = day.waterMl >= p.waterGoalMl;

  async function add(n: number) {
    await addWater(n, date, nowHM());
    toast(t('+{n} มล.', { n: fmtInt(n) }));
  }

  return (
    <>
      <Header title={t('น้ำดื่ม')} />
      <main className="screen no-tabs">
        {date !== today && <p className="pill warn" style={{ alignSelf: 'flex-start' }}>{t('บันทึกย้อนหลัง · {date}', { date: formatThaiLong(date) })}</p>}
        <section className="card tone-sky card-pad col gap12" style={{ alignItems: 'center', borderRadius: 36 }} aria-label={t('น้ำดื่มวันนี้')}>
          <Ring size={220} stroke={20} value={pct(day.waterMl, p.waterGoalMl)} color="var(--water)" track="rgba(255,255,255,.6)">
            <span className="num-xl" style={{ fontSize: 52 }} data-testid="water-liters">{fmtLiters(day.waterMl)}</span>
            <span className="caption">{t('/ {waterGoalMl} ลิตร', { waterGoalMl: fmtLiters(p.waterGoalMl) })}</span>
          </Ring>
          <span className="pill" style={{ background: 'rgba(255,255,255,.8)', color: '#0f6f94' }}>
            <Droplet size={14} /> {done ? t('ครบเป้าแล้ว 🎉') : t('เหลืออีก {left} มล. ถึงเป้าหมาย', { left: fmtInt(left) })}
          </span>
        </section>

        <section className="col gap8" aria-label={t('เพิ่มน้ำด่วน')}>
          <h2 className="h3">{t('เพิ่มด่วน')}</h2>
          <div className="quick-grid">
            {QUICK.map((n) => (
              <button key={n} type="button" className="quick" style={{ background: 'var(--sky)', boxShadow: 'none' }} onClick={() => add(n)} aria-label={t('เพิ่มน้ำ {n} มิลลิลิตร', { n })}>
                <Droplet size={20} color="var(--water)" />
                <b>+{n}</b>{t('มล.')}</button>
            ))}
          </div>
          <Button variant="outline" small onClick={() => { setMl(null); setErr(null); setCustom(true); }}>
            <Plus size={16} />{' '}{t('กำหนดปริมาณเอง')}</Button>
        </section>

        <section className="col gap8" aria-label={t('บันทึกน้ำ')}>
          <div className="row-flex between">
            <h2 className="h3">{t('วันนี้ · {count} ครั้ง', { count: day.water.length })}</h2>
            <span className="caption">{t('รวม {waterMl} มล.', { waterMl: fmtInt(day.waterMl) })}</span>
          </div>
          {day.water.length === 0 && <Empty emoji="💧" title={t('ยังไม่ได้ดื่มน้ำ')}>{t('แตะปุ่มด้านบนทุกครั้งที่ดื่มน้ำ')}</Empty>}
          {day.water.length > 0 && (
            <div className="group">
              {day.water.map((w) => (
                <div key={w.id} className="list-row" style={{ minHeight: 52 }}>
                  <span className="icon-slot water round" style={{ width: 34, height: 34 }}><Droplet size={16} /></span>
                  <b className="grow">{t('{ml} มล.', { ml: fmtInt(w.ml) })}</b>
                  <span className="caption">{w.time}</span>
                  <button type="button" className="round-btn" aria-label={t('ลบน้ำ {ml} มล. เวลา {time}', { ml: w.ml, time: w.time })} onClick={async () => { await deleteWater(w.id!); toast(t('ลบแล้ว')); }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="caption muted">{t('เป้าหมาย {waterGoalMl} มล.', { waterGoalMl: fmtInt(p.waterGoalMl) })}{p.waterManual ? t(' (ตั้งเอง)') : t(' ≈ 35 มล. × น้ำหนักตัว')} ·{' '}
          <button type="button" className="link" onClick={() => nav('/goals')}>{t('แก้ไขเป้าหมาย')}</button>
        </p>
      </main>

      <Sheet open={custom} onClose={() => setCustom(false)} title={t('กำหนดปริมาณน้ำ')}>
        <div className="col gap16">
          <NumField label={t('ปริมาณ')} suffix={t('มล.')} decimals={false} value={ml} onChange={setMl} error={err} />
          <Button
            onClick={async () => {
              if (ml === null || ml <= 0 || ml > 5000) return setErr(t('ใส่ปริมาณ 1–5,000 มล.'));
              await add(ml);
              setCustom(false);
            }}
          >{t('บันทึก')}</Button>
        </div>
      </Sheet>
    </>
  );
}
