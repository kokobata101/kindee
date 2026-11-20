import type { Bar } from '../lib/stats';
import { isOverGoal } from '../lib/stats';
import { fmtInt } from '../lib/format';

import { t } from '../i18n';
const W = 340;

/** กราฟแท่งแคลอรี่: เขียว = ในเป้า, ส้ม = เกินเป้า, เส้นประ = เป้าหมาย, แท่งของวันนี้จาง (ยังบันทึกไม่ครบ) */
export function BarChart({ bars, goal, height = 180, label }: { bars: Bar[]; goal: number; height?: number; label: string }) {
  const padT = 20;
  const padB = 22;
  const ih = height - padT - padB;
  const max = Math.max(goal * 1.25, ...bars.map((b) => b.value * 1.08), 1);
  const slot = W / bars.length;
  const bw = Math.min(30, slot * 0.62);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const dense = bars.length > 12;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label}>
      <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--text-muted)" strokeDasharray="4 4" strokeWidth={1} />
      <text x={W} y={y(goal) - 5} textAnchor="end">{t('เป้าหมาย {goal}', { goal: fmtInt(goal) })}</text>
      {bars.map((b, i) => {
        const cx = slot * i + slot / 2;
        const h = b.future || b.value <= 0 ? 0 : Math.max(3, (b.value / max) * ih);
        const over = isOverGoal(b.value, goal);
        const showLabel = !dense || i === 0 || (i + 1) % 5 === 0;
        return (
          <g key={i}>
            {h > 0 ? (
              <rect
                x={cx - bw / 2}
                y={padT + ih - h}
                width={bw}
                height={h}
                rx={Math.min(8, bw / 2)}
                fill={over ? 'var(--calorie)' : 'var(--brand)'}
                opacity={b.today ? 0.5 : 1}
              >
                <title>{`${b.label}: ${fmtInt(b.value)} kcal`}</title>
              </rect>
            ) : (
              <rect x={cx - bw / 2} y={padT + ih - 3} width={bw} height={3} rx={1.5} fill="var(--bg-subtle)" />
            )}
            {showLabel && (
              <text x={cx} y={height - 5} textAnchor="middle" style={b.today ? { fill: 'var(--text)', fontWeight: 700 } : undefined}>
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** กราฟเส้นน้ำหนัก: ข้ามช่วงที่ไม่มีข้อมูล + เส้นประเป้าหมาย */
export function LineChart({
  values,
  labels,
  target,
  height = 190,
  label,
  unit = t('กก.'),
}: {
  values: (number | null)[];
  labels: string[];
  target?: number;
  height?: number;
  label: string;
  unit?: string;
}) {
  const padL = 30;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const nums = values.filter((v): v is number => v !== null);
  const pool = [...nums, ...(target !== undefined ? [target] : [])];
  if (pool.length === 0) pool.push(0, 1);
  let lo = Math.floor(Math.min(...pool) - 1);
  let hi = Math.ceil(Math.max(...pool) + 1);
  if (hi - lo < 4) hi = lo + 4;
  // ให้แกนมีเส้นกริดที่ลงตัว
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  hi = lo + step * 4;
  const iw = W - padL - padR;
  const ih = height - padT - padB;
  const n = values.length;
  const x = (i: number) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo)) * ih;

  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push({ i, v });
  });
  if (cur.length) segments.push(cur);
  const path = (s: { i: number; v: number }[]) => s.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = (s: { i: number; v: number }[]) =>
    s.length < 2 ? '' : `${path(s)} L${x(s[s.length - 1].i).toFixed(1)} ${padT + ih} L${x(s[0].i).toFixed(1)} ${padT + ih} Z`;
  const last = segments.length ? segments[segments.length - 1][segments[segments.length - 1].length - 1] : null;
  const labelEvery = n > 12 ? Math.ceil(n / 8) : 1;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((k) => {
        const v = lo + step * k;
        return (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        );
      })}
      {target !== undefined && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="var(--calorie)" strokeDasharray="4 4" strokeWidth={1.2} />
          <text x={W - padR} y={y(target) - 4} textAnchor="end" style={{ fill: 'var(--calorie)' }}>{t('เป้าหมาย {target} {unit}', { target, unit })}</text>
        </g>
      )}
      {segments.map((s, k) => (
        <g key={k}>
          {s.length > 1 && <path d={area(s)} fill="var(--brand)" opacity={0.12} />}
          <path d={path(s)} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {s.map((p) => (
            <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3.2} fill="var(--bg-card)" stroke="var(--brand)" strokeWidth={2}>
              <title>{`${labels[p.i]}: ${p.v} ${unit}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {last && <circle cx={x(last.i)} cy={y(last.v)} r={5.5} fill="var(--brand)" />}
      {labels.map((l, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}
