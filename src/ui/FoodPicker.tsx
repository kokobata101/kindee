import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Search, Star, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { allFoods, getFavoriteIds, recentFoods, toggleFavorite } from '../db/repo';
import type { Food, MealKey } from '../db/types';
import { FOOD_CATEGORIES } from '../data/foods';
import { scaleNutrients, servingLabel } from '../lib/diary';
import { searchFoods } from '../lib/search';
import { fmtInt } from '../lib/format';
import { Button, Chip, Empty, Stepper, Thumb } from './kit';
import { MealChips } from './MealChips';

import { t } from '../i18n';
import { foodName } from '../lib/names';
export interface Pick {
  food: Food;
  qty: number;
}

type Tab = 'all' | 'recent' | 'fav' | 'mine';

/**
 * ตัวเลือกอาหาร: ค้นหา/ล่าสุด/โปรด/ของฉัน แตะเพื่อเลือกหลายรายการ แล้วยืนยันครั้งเดียว
 * ใช้ทั้งหน้าเพิ่มอาหารและหน้าตั้งเวลาอัตโนมัติ
 */
export function FoodPicker({
  meal,
  onMealChange,
  confirmLabel,
  onConfirm,
  initialQuery = '',
  allowCreate = true,
  onSaveCombo,
}: {
  meal?: MealKey;
  onMealChange?: (m: MealKey) => void;
  confirmLabel: (count: number) => string;
  onConfirm: (picks: Pick[]) => void | Promise<void>;
  initialQuery?: string;
  allowCreate?: boolean;
  /** ถ้าส่งมา จะมีปุ่ม "เก็บเป็นชุด" เมื่อเลือกอาหารแล้ว */
  onSaveCombo?: (picks: Pick[]) => void;
}) {
  const nav = useNavigate();
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>('all');
  const [cat, setCat] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, Pick>>(new Map());
  const [busy, setBusy] = useState(false);

  const foods = useLiveQuery(() => allFoods(), []);
  const favIds = useLiveQuery(() => getFavoriteIds(), []) ?? [];
  const recent = useLiveQuery(() => recentFoods(20), []) ?? [];
  const customCount = useLiveQuery(() => db.foods.count(), []) ?? 0;

  const list = useMemo(() => {
    const all = foods ?? [];
    let base: Food[] = all;
    if (tab === 'recent') base = recent;
    if (tab === 'fav') base = all.filter((f) => favIds.includes(f.id));
    if (tab === 'mine') base = all.filter((f) => f.source !== 'builtin');
    if (tab === 'all' && cat) base = base.filter((f) => f.category === cat);
    return searchFoods(base, q, 80);
  }, [foods, recent, favIds, tab, cat, q]);

  const picks = [...picked.values()];
  const total = picks.reduce((s, p) => s + scaleNutrients(p.food, p.qty).kcal, 0);

  const toggle = (f: Food) =>
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(f.id)) n.delete(f.id);
      else n.set(f.id, { food: f, qty: 1 });
      return n;
    });
  const setQty = (id: string, qty: number) =>
    setPicked((m) => {
      const n = new Map(m);
      const p = n.get(id);
      if (p) n.set(id, { ...p, qty });
      return n;
    });

  return (
    <>
      <div className="col gap12">
        <div className="search" role="search">
          <Search size={20} className="chev" />
          <input
            type="search"
            aria-label={t('ค้นหาอาหาร')}
            placeholder={t('ค้นหาอาหาร เช่น ส้มตำ, ข้าวมันไก่')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus={false}
          />
          {q && (
            <button type="button" className="round-btn" aria-label={t('ล้างคำค้น')} onClick={() => setQ('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {meal && onMealChange && <MealChips meal={meal} onChange={onMealChange} />}

        <div className="chips" role="tablist" aria-label={t('หมวดรายการ')}>
          {(
            [
              ['all', t('ทั้งหมด')],
              ['recent', t('ล่าสุด')],
              ['fav', t('รายการโปรด')],
              ['mine', t('ของฉัน{v1}', { v1: customCount ? ` (${customCount})` : '' })],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <Chip key={k} role="tab" aria-selected={tab === k} selected={tab === k} onClick={() => setTab(k)}>
              {label}
            </Chip>
          ))}
        </div>

        {tab === 'all' && !q && (
          <div className="chips" aria-label={t('หมวดอาหาร')}>
            <Chip selected={cat === null} onClick={() => setCat(null)}>{t('ทุกหมวด')}</Chip>
            {FOOD_CATEGORIES.map((c) => (
              <Chip key={c.key} selected={cat === c.key} onClick={() => setCat(cat === c.key ? null : c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
        )}

        <div className="col gap8" role="list" aria-label={t('ผลการค้นหา')}>
          {list.map((f) => {
            const p = picked.get(f.id);
            const n = scaleNutrients(f, p?.qty ?? 1);
            const fav = favIds.includes(f.id);
            return (
              <div key={f.id} role="listitem" className={`food-row ${p ? 'sel' : ''}`}>
                <button
                  type="button"
                  className="row-flex grow"
                  style={{ textAlign: 'left', gap: 12, minWidth: 0 }}
                  aria-pressed={!!p}
                  aria-label={`${p ? t('ยกเลิกเลือก') : t('เลือก')} ${foodName(f)}`}
                  onClick={() => toggle(f)}
                >
                  <Thumb emoji={f.emoji} />
                  <span className="grow col">
                    <span className="row-title" style={{ fontWeight: 600 }}>{foodName(f)}</span>
                    <span className="row-sub">
                      {servingLabel(f.serving)} · {fmtInt(f.grams)} g · P{Math.round(n.protein)} C{Math.round(n.carb)} F{Math.round(n.fat)}
                    </span>
                  </span>
                  <span className="kcal">
                    {fmtInt(n.kcal)}
                    <small>kcal</small>
                  </span>
                </button>
                {p ? (
                  <Stepper label={t('จำนวน {name}', { name: foodName(f) })} value={p.qty} onChange={(v) => setQty(f.id, v)} step={0.5} min={0.5} max={20} />
                ) : (
                  <span className="row-flex" style={{ gap: 6 }}>
                    {allowCreate && f.source !== 'builtin' && (
                      <button type="button" className="round-btn" aria-label={t('แก้ไข {name}', { name: foodName(f) })} onClick={() => nav(`/food/edit/${f.id}`)}>
                        <Pencil size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="round-btn"
                      aria-label={fav ? t('เอา {name} ออกจากรายการโปรด', { name: foodName(f) }) : t('เพิ่ม {name} ในรายการโปรด', { name: foodName(f) })}
                      aria-pressed={fav}
                      onClick={() => toggleFavorite(f.id)}
                    >
                      <Star size={16} fill={fav ? 'var(--carb)' : 'none'} color={fav ? 'var(--carb)' : 'currentColor'} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {list.length === 0 && (
          <Empty emoji={tab === 'fav' ? '⭐' : '🔍'} title={q ? t('ไม่พบ "{q}"', { q }) : tab === 'fav' ? t('ยังไม่มีรายการโปรด') : tab === 'recent' ? t('ยังไม่มีอาหารล่าสุด') : tab === 'mine' ? t('ยังไม่มีอาหารที่สร้างเอง') : t('ไม่มีรายการ')}>
            {tab === 'fav' && t('แตะดาวที่อาหารเพื่อเก็บไว้ใช้บ่อย')}
          </Empty>
        )}

        {allowCreate && (
          <button type="button" className="dashed-card" onClick={() => nav(`/food/new${q ? `?name=${encodeURIComponent(q)}` : ''}`)}>
            <span className="round-btn brand"><Plus size={16} /></span>
            <span className="col">
              <b>{q && list.length === 0 ? t('สร้าง "{q}" เอง', { q }) : t('ไม่เจอที่ต้องการ? สร้างอาหารของฉันเอง')}</b>
              <span className="caption">{t('ใส่แคลอรี่และสารอาหารเอง เก็บไว้ใช้ซ้ำได้')}</span>
            </span>
          </button>
        )}
        <p className="caption muted">{t('ค่าโภชนาการเป็นค่าประมาณโดยเฉลี่ย ปริมาณและสูตรของแต่ละร้านต่างกัน แก้ไขหรือเพิ่มอาหารของตัวเองได้')}</p>
      </div>

      <div className="footer-bar">
        <div className="col grow">
          <span className="caption">{picks.length ? t('เลือกแล้ว {count} รายการ', { count: picks.length }) : t('ยังไม่ได้เลือก')}</span>
          <b className="num-m">{fmtInt(total)} kcal</b>
        </div>
        {onSaveCombo && picks.length > 0 && (
          <Button variant="outline" small block={false} aria-label={t('เก็บเป็นมื้อประจำ')} onClick={() => onSaveCombo(picks)}>{t('เก็บเป็นชุด')}</Button>
        )}
        <Button
          block={false}
          disabled={picks.length === 0 || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(picks);
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel(picks.length)}
        </Button>
      </div>
    </>
  );
}

export { mealButtonLabel } from './MealChips';
