import { BarChart, LineChart } from './charts';
import { fmtInt, fmtNum } from '../lib/format';
import { formatThaiDate, parseISO } from '../lib/date';
import { isOverGoal } from '../lib/stats';
import { reportDays, reportStats, type ReportData } from '../lib/share';
import type { Bar } from '../lib/stats';

import { t } from '../i18n';
/** รายงานสรุปสำหรับโค้ช/แพทย์ ใช้ทั้งหน้าตัวอย่าง หน้าพิมพ์ PDF และหน้าเปิดจากลิงก์ */
export function ReportView({ r }: { r: ReportData }) {
  const s = reportStats(r);
  const days = reportDays(r);
  const bars: Bar[] = days.map((d) => ({ label: String(parseISO(d.date).getDate()), value: d.logged ? d.kcal : 0, date: d.date }));
  const ws = [...r.weights].sort((a, b) => a[0].localeCompare(b[0]));
  const shortDate = (iso: string) => `${parseISO(iso).getDate()}/${parseISO(iso).getMonth() + 1}`;

  return (
    <article className="col gap16 report" aria-label={t('รายงานโภชนาการ')} data-testid="report">
      <header className="col gap4">
        <span className="caption">{t('รายงานโภชนาการและน้ำหนัก')}</span>
        <h2 className="h2">{r.name ? `${r.name} · ` : ''}{formatThaiDate(r.from)} – {formatThaiDate(r.to)}</h2>
        <span className="caption muted">{t('เป้าหมาย: {label} · {kcal} kcal/วัน · โปรตีน {protein} g · น้ำ {water} มล.', { label: r.goal.label, kcal: fmtInt(r.goal.kcal), protein: fmtInt(r.goal.protein), water: fmtInt(r.goal.water) })}</span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        <div className="card card-pad col"><span className="caption">{t('แคลอรี่เฉลี่ย/วัน')}</span><b className="num-l" data-testid="r-avg">{s.loggedDays ? fmtInt(s.avgKcal) : '–'}</b><span className="caption muted">{t('เฉพาะวันที่บันทึก')}</span></div>
        <div className="card card-pad col"><span className="caption">{t('วันที่บันทึก')}</span><b className="num-l" data-testid="r-days">{s.loggedDays}/{s.totalDays}</b><span className="caption muted">{t('เกินเป้า {overDays} วัน', { overDays: s.overDays })}</span></div>
        <div className="card card-pad col"><span className="caption">{t('โปรตีนเฉลี่ย')}</span><b className="num-l">{s.loggedDays ? fmtInt(s.avgProtein) : '–'}<small className="caption"> g</small></b><span className="caption muted">{t('เป้า {protein} g', { protein: fmtInt(r.goal.protein) })}</span></div>
        <div className="card card-pad col"><span className="caption">{t('น้ำดื่มเฉลี่ย')}</span><b className="num-l">{fmtInt(s.avgWaterMl)}<small className="caption">{' '}{t('มล.')}</small></b><span className="caption muted">{t('เผาผลาญจากกิจกรรม {totalBurned} kcal', { totalBurned: fmtInt(s.totalBurned) })}</span></div>
      </div>

      <section className="card card-pad col gap8">
        <h3 className="h3">{t('แคลอรี่รายวัน')}</h3>
        <BarChart bars={bars} goal={r.goal.kcal} label={t('กราฟแคลอรี่รายวัน')} />
      </section>

      {s.loggedDays > 0 && (
        <section className="card card-pad col gap8">
          <h3 className="h3">{t('สัดส่วนพลังงานจากสารอาหาร')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <span className="macro-pill protein">{s.share.protein}%<small>{t('โปรตีน')}</small></span>
            <span className="macro-pill carb">{s.share.carb}%<small>{t('คาร์บ')}</small></span>
            <span className="macro-pill fat">{s.share.fat}%<small>{t('ไขมัน')}</small></span>
          </div>
        </section>
      )}

      {ws.length > 0 && (
        <section className="card card-pad col gap8">
          <div className="row-flex between">
            <h3 className="h3">{t('น้ำหนัก')}</h3>
            {s.weightChange !== null && (
              <span className="pill brand">{s.weightChange === 0 ? t('ไม่เปลี่ยน') : t('{v1}{weightChange} กก.', { v1: s.weightChange > 0 ? '+' : '−', weightChange: fmtNum(Math.abs(s.weightChange)) })}</span>
            )}
          </div>
          <LineChart values={ws.map((w) => w[1])} labels={ws.map((w) => shortDate(w[0]))} label={t('กราฟน้ำหนัก')} />
          <span className="caption muted">{ws.map((w) => `${shortDate(w[0])}: ${fmtNum(w[1])}`).join(' · ')}</span>
        </section>
      )}

      <section className="card card-pad col gap8" style={{ overflowX: 'auto' }}>
        <h3 className="h3">{t('รายวัน')}</h3>
        <table className="report-table">
          <thead>
            <tr><th>{t('วันที่')}</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>{t('น้ำ')}</th><th>{t('เผาผลาญ')}</th></tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className={d.logged ? '' : 'none'}>
                <td>{formatThaiDate(d.date, false)}</td>
                <td className={d.logged && isOverGoal(d.kcal, r.goal.kcal) ? 'over' : ''}>{d.logged ? fmtInt(d.kcal) : '–'}</td>
                <td>{d.logged ? d.protein : '–'}</td>
                <td>{d.logged ? d.carb : '–'}</td>
                <td>{d.logged ? d.fat : '–'}</td>
                <td>{d.water ? fmtInt(d.water) : '–'}</td>
                <td>{d.burned ? fmtInt(d.burned) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span className="caption muted">{t('P = โปรตีน, C = คาร์บ, F = ไขมัน (กรัม) · น้ำเป็นมิลลิลิตร · ค่าทั้งหมดเป็นการประมาณจากที่ผู้ใช้บันทึก')}</span>
      </section>
    </article>
  );
}
