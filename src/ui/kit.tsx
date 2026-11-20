import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

import { t } from '../i18n';
/** ย้อนกลับ ถ้าเปิดหน้านี้ตรงๆ (ไม่มีประวัติ) จะไปหน้าที่กำหนดแทน */
export function useBack(fallback = '/') {
  const nav = useNavigate();
  const loc = useLocation();
  return () => (loc.key !== 'default' ? nav(-1) : nav(fallback, { replace: true }));
}

// ───────── Button ─────────
type BtnVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-solid';
export function Button({
  variant = 'primary',
  small,
  block = true,
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; small?: boolean; block?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={`btn btn-${variant} ${small ? 'btn-sm' : ''} ${block ? 'btn-block' : ''} ${className}`}
    />
  );
}

export function IconButton({
  label,
  plain,
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; plain?: boolean }) {
  return <button type="button" aria-label={label} {...p} className={`icon-btn ${plain ? 'plain' : ''} ${className}`} />;
}

export function Chip({
  selected,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button type="button" aria-pressed={!!selected} {...p} className={`chip ${selected ? 'sel' : ''} ${p.className ?? ''}`}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────── Layout ─────────
export function Header({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  const back = useBack();
  return (
    <header className="header">
      <IconButton label={t('ย้อนกลับ')} onClick={onBack ?? back}>
        <ChevronLeft size={22} />
      </IconButton>
      <h1>{title}</h1>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{action}</div>
    </header>
  );
}

export function Group({ title, children, style }: { title?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={style}>
      {title && <h2 className="group-title">{title}</h2>}
      <div className="group">{children}</div>
    </section>
  );
}

type Tone = '' | 'calorie' | 'water' | 'carb' | 'danger';
export function IconSlot({ children, tone = '', round }: { children: ReactNode; tone?: Tone; round?: boolean }) {
  return <span className={`icon-slot ${tone} ${round ? 'round' : ''}`}>{children}</span>;
}

export function ListRow({
  icon,
  tone,
  title,
  sub,
  value,
  chevron,
  toggle,
  onClick,
  danger,
}: {
  icon?: ReactNode;
  tone?: Tone;
  title: string;
  sub?: string;
  value?: string;
  chevron?: boolean;
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <>
      {icon && <IconSlot tone={danger ? 'danger' : tone}>{icon}</IconSlot>}
      <span className="grow col">
        <span className={`row-title ${danger ? 'danger-text' : ''}`}>{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value && <span className="row-value">{value}</span>}
      {toggle && <Toggle checked={toggle.checked} onChange={toggle.onChange} label={title} />}
      {chevron && <ChevronRight size={18} className="chev" />}
    </>
  );
  if (toggle) {
    return (
      <div className="list-row" onClick={() => toggle.onChange(!toggle.checked)} style={{ cursor: 'pointer' }}>
        {inner}
      </div>
    );
  }
  return onClick ? (
    <button type="button" className="list-row" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="list-row">{inner}</div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden>
        {emoji}
      </div>
      <div className="body-medium t2" style={{ marginTop: 8 }}>
        {title}
      </div>
      {children && <div className="caption" style={{ marginTop: 4 }}>{children}</div>}
    </div>
  );
}

// ───────── Forms ─────────
export function Field({
  label,
  suffix,
  error,
  hint,
  children,
}: {
  label?: string;
  suffix?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className={`input-wrap ${error ? 'invalid' : ''}`}>
        {children}
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({
  label,
  suffix,
  error,
  hint,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; suffix?: string; error?: string | null; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`input-wrap ${error ? 'invalid' : ''}`}>
        <input id={id} {...p} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/** ช่องตัวเลข: แก้ไขเป็นข้อความได้อิสระ แล้วส่งค่าตัวเลข (หรือ null ถ้าว่าง/ไม่ถูกต้อง) */
export function NumField({
  label,
  value,
  onChange,
  suffix,
  error,
  hint,
  placeholder,
  decimals = true,
  ariaLabel,
}: {
  label?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  suffix?: string;
  error?: string | null;
  hint?: string;
  placeholder?: string;
  decimals?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value === null ? '' : String(value));
    }
  }, [value]);
  return (
    <TextField
      label={label}
      suffix={suffix}
      error={error}
      hint={hint}
      placeholder={placeholder}
      aria-label={ariaLabel ?? label}
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        if (!(decimals ? /^\d*\.?\d*$/ : /^\d*$/).test(t)) return;
        setText(t);
        const n = t === '' || t === '.' ? null : parseFloat(t);
        last.current = n;
        onChange(n !== null && Number.isFinite(n) ? n : null);
      }}
    />
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 99,
  format,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (n: number) => string;
  label: string;
}) {
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" className="round-btn" aria-label={t('ลด{label}', { label })} disabled={value <= min} onClick={() => onChange(Math.max(min, r(value - step)))}>
        <Minus size={16} />
      </button>
      <span className="val" aria-live="polite">{format ? format(value) : value}</span>
      <button type="button" className="round-btn brand" aria-label={t('เพิ่ม{label}', { label })} disabled={value >= max} onClick={() => onChange(Math.min(max, r(value + step)))}>
        <Plus size={16} />
      </button>
    </span>
  );
}

export function OptionCard({
  checked,
  onClick,
  title,
  sub,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="option-card" onClick={onClick}>
      <span className="col">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <span className="radio">{checked && <Check size={16} strokeWidth={3} />}</span>
    </button>
  );
}

// ───────── Sheet / overlay ─────────
export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  full?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !full && onClose()}>
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {!full && <div className="grabber" />}
        {title && !full && <h2 className="h2" style={{ marginBottom: 12 }}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ───────── Visuals ─────────
export function ProgressBar({ value, color, label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Ring({
  size,
  stroke,
  value,
  color = 'var(--brand)',
  track = 'var(--bg-subtle)',
  children,
}: {
  size: number;
  stroke: number;
  value: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray .4s' }}
          />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Thumb({ emoji }: { emoji: string }) {
  return (
    <span className="thumb" aria-hidden>
      {emoji}
    </span>
  );
}

export function MacroPills({ kcal, protein, carb, fat }: { kcal: number; protein: number; carb: number; fat: number }) {
  const v = (n: number) => String(Math.round(n * 10) / 10);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
      <span className="macro-pill cal">{Math.round(kcal)}<small>kcal</small></span>
      <span className="macro-pill protein">{v(protein)} g<small>{t('โปรตีน')}</small></span>
      <span className="macro-pill carb">{v(carb)} g<small>{t('คาร์บ')}</small></span>
      <span className="macro-pill fat">{v(fat)} g<small>{t('ไขมัน')}</small></span>
    </div>
  );
}

/** แท่งแคปซูลวัดความคืบหน้า (วงกลมค่าอยู่ปลายแท่ง) */
export function Gauge({
  value,
  display,
  label,
  sub,
  tone = '',
}: {
  /** 0–1 */
  value: number;
  display: string;
  label: string;
  sub?: string;
  tone?: '' | 'cal' | 'protein' | 'carb' | 'fat';
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`gauge ${tone}`}>
      <div
        className="gauge-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        style={{ '--v': v } as CSSProperties}
      >
        <i className="gauge-fill" />
        <span className="gauge-val">{display}</span>
      </div>
      <span className="gauge-label">{label}</span>
      {sub && <span className="gauge-sub">{sub}</span>}
    </div>
  );
}

/** เส้นกราฟเล็กๆ (ไม่มีแกน) ใช้โชว์แนวโน้ม */
export function Sparkline({ values, color = 'currentColor' }: { values: number[]; color?: string }) {
  const W = 120;
  const H = 36;
  const pad = 4;
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + ((W - 2 * pad) * i) / (values.length - 1), H - pad - ((v - min) / span) * (H - 2 * pad)] as const);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const mx = (px + x) / 2;
    d += ` C${mx.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
    </svg>
  );
}
