import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, X } from 'lucide-react';
import { Button, Empty, MacroPills, Sheet, Stepper, TextField, Thumb } from './kit';
import { MealChips, mealButtonLabel } from './MealChips';
import { addComboToDay, deleteCombo, getCombos, saveCombo } from '../db/repo';
import { mealLabel, type Combo, type ComboItem, type MealKey } from '../db/types';
import { useApp } from '../app/context';
import { comboTotals, scaleComboItem, suggestComboName } from '../lib/combo';
import { qtyLabel } from '../lib/diary';
import { fmtInt } from '../lib/format';
import { COMBO_NAME_MAX, validateComboName } from '../lib/validate';

import { t } from '../i18n';
import { foodName } from '../lib/names';
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function ItemLine({ item, portions = 1, right }: { item: ComboItem; portions?: number; right?: React.ReactNode }) {
  const s = scaleComboItem(item, portions);
  return (
    <div className="row-flex" style={{ gap: 10 }}>
      <Thumb emoji={item.emoji} />
      <span className="grow col" style={{ minWidth: 0 }}>
        <span className="row-title" style={{ fontWeight: 600 }}>{foodName(item)}</span>
        <span className="row-sub">{qtyLabel(s.qty, item.serving)} · {fmtInt(s.kcal)} kcal</span>
      </span>
      {right}
    </div>
  );
}

/** แผ่นตั้งชื่อแล้วเก็บรายการอาหารเป็นมื้อประจำ */
export function SaveComboSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: ComboItem[] }) {
  return open ? <SaveComboInner onClose={onClose} items={items} /> : null;
}

function SaveComboInner({ onClose, items }: { onClose: () => void; items: ComboItem[] }) {
  const { toast } = useApp();
  const [name, setName] = useState(() => suggestComboName(items));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const err = validateComboName(name);
  const tot = comboTotals(items);

  async function save() {
    setTried(true);
    if (err) return;
    setBusy(true);
    try {
      await saveCombo({ name, items });
      toast(t('เก็บ "{name}" เป็นมื้อประจำแล้ว', { name: name.trim() }));
      onClose();
    } catch (e) {
      toast(errMsg(e, t('บันทึกไม่สำเร็จ')), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={t('เก็บเป็นมื้อประจำ')}>
      <div className="col gap12">
        <TextField label={t('ชื่อมื้อประจำ')} value={name} maxLength={COMBO_NAME_MAX} onChange={(e) => setName(e.target.value)} error={tried ? err : null} />
        <div className="col gap8">
          {items.map((i, idx) => <ItemLine key={idx} item={i} />)}
        </div>
        <p className="caption muted">{t('รวม {kcal} kcal · {count} รายการ', { kcal: fmtInt(tot.kcal), count: items.length })}</p>
        <Button disabled={busy} onClick={save}>{t('บันทึกมื้อประจำ')}</Button>
      </div>
    </Sheet>
  );
}

function ComboSheet({
  combo,
  meal,
  onMealChange,
  onClose,
  onAdd,
}: {
  combo: Combo;
  meal: MealKey;
  onMealChange: (m: MealKey) => void;
  onClose: () => void;
  onAdd: (c: Combo, portions: number) => Promise<void>;
}) {
  const { toast, confirm } = useApp();
  const [portions, setPortions] = useState(1);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(combo.name);
  const [items, setItems] = useState<ComboItem[]>(combo.items);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    const tot = comboTotals(combo.items, portions);
    return (
      <Sheet open onClose={onClose} title={combo.name}>
        <div className="col gap12">
          <div className="col gap8">
            {combo.items.map((i, idx) => <ItemLine key={idx} item={i} portions={portions} />)}
          </div>
          <div className="row-flex between">
            <span className="body-medium">{t('จำนวนส่วน')}</span>
            <Stepper label={t('จำนวนส่วน')} value={portions} onChange={setPortions} step={0.5} min={0.5} max={5} />
          </div>
          <MacroPills kcal={tot.kcal} protein={tot.protein} carb={tot.carb} fat={tot.fat} />
          <MealChips meal={meal} onChange={onMealChange} />
          <Button disabled={busy} onClick={async () => { setBusy(true); try { await onAdd(combo, portions); } finally { setBusy(false); } }}>
            {mealButtonLabel(meal)}
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>{t('แก้ไข / ลบมื้อประจำ')}</Button>
        </div>
      </Sheet>
    );
  }

  const err = validateComboName(name);
  async function saveEdit() {
    setTried(true);
    if (err) return;
    setBusy(true);
    try {
      await saveCombo({ id: combo.id, name, items });
      toast(t('บันทึกการแก้ไขแล้ว'));
      onClose();
    } catch (e) {
      toast(errMsg(e, t('บันทึกไม่สำเร็จ')), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={t('แก้ไขมื้อประจำ')}>
      <div className="col gap12">
        <TextField label={t('ชื่อมื้อประจำ')} value={name} maxLength={COMBO_NAME_MAX} onChange={(e) => setName(e.target.value)} error={tried ? err : null} />
        <div className="col gap8">
          {items.map((i, idx) => (
            <ItemLine
              key={idx}
              item={i}
              right={
                <span className="row-flex" style={{ gap: 6 }}>
                  <Stepper label={t('จำนวน {name}', { name: foodName(i) })} value={i.qty} step={0.5} min={0.5} max={20} onChange={(q) => setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, qty: q } : x)))} />
                  <button type="button" className="round-btn" aria-label={t('เอา {name} ออก', { name: foodName(i) })} disabled={items.length <= 1} onClick={() => setItems((xs) => xs.filter((_, j) => j !== idx))}>
                    <X size={15} />
                  </button>
                </span>
              }
            />
          ))}
        </div>
        <Button disabled={busy} onClick={saveEdit}>{t('บันทึกการแก้ไข')}</Button>
        <Button variant="outline" onClick={() => { setName(combo.name); setItems(combo.items); setTried(false); setEditing(false); }}>{t('ยกเลิก')}</Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (await confirm({ title: t('ลบ "{name}" ?', { name: combo.name }), body: t('รายการที่เพิ่มลงไดอารี่ไปแล้วจะไม่ถูกลบ'), confirmLabel: t('ลบ'), danger: true })) {
              await deleteCombo(combo.id!);
              toast(t('ลบมื้อประจำแล้ว'));
              onClose();
            }
          }}
        >
          <Trash2 size={18} />{' '}{t('ลบมื้อประจำนี้')}</Button>
      </div>
    </Sheet>
  );
}

/** โหมด "มื้อประจำ" ในหน้าเพิ่มอาหาร: แตะ + เพื่อเพิ่มทั้งชุดทันที หรือแตะชื่อเพื่อปรับจำนวนส่วน/แก้ไข */
export function CombosPanel({
  meal,
  onMealChange,
  date,
  getTime,
  onAdded,
}: {
  meal: MealKey;
  onMealChange: (m: MealKey) => void;
  date: string;
  getTime: () => string;
  onAdded: () => void;
}) {
  const { toast } = useApp();
  const combos = useLiveQuery(() => getCombos(), []);
  const [openId, setOpenId] = useState<number | null>(null);
  const open = combos?.find((c) => c.id === openId);

  async function addNow(c: Combo, portions = 1) {
    try {
      const r = await addComboToDay(c.id!, meal, date, getTime(), portions);
      toast(t('เพิ่ม "{name}" {count} รายการ ({kcal} kcal) ลง{meal}แล้ว', { name: r.name, count: r.count, kcal: fmtInt(r.kcal), meal: mealLabel(meal) }));
      onAdded();
    } catch (e) {
      toast(errMsg(e, t('เพิ่มไม่สำเร็จ')), 'error');
    }
  }

  return (
    <div className="col gap12">
      <MealChips meal={meal} onChange={onMealChange} />
      {combos && combos.length === 0 && (
        <Empty emoji="🔖" title={t('ยังไม่มีมื้อประจำ')}>{t('เลือกอาหารหลายอย่างในแท็บ "ค้นหา" แล้วกด "เก็บเป็นชุด" หรือกดปุ่มบุ๊กมาร์กที่หัวมื้อในไดอารี่')}</Empty>
      )}
      {combos && combos.length > 0 && (
        <div className="col gap8" role="list" aria-label={t('มื้อประจำ')}>
          {combos.map((c) => (
            <div key={c.id} role="listitem" className="food-row">
              <button type="button" className="row-flex grow" style={{ textAlign: 'left', gap: 12, minWidth: 0 }} aria-label={t('ดูรายละเอียด {name}', { name: c.name })} onClick={() => setOpenId(c.id!)}>
                <Thumb emoji={c.emoji} />
                <span className="grow col" style={{ minWidth: 0 }}>
                  <span className="row-title" style={{ fontWeight: 600 }}>{c.name}</span>
                  <span className="row-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.items.map((i) => foodName(i)).join(' + ')}</span>
                  <span className="row-sub">{t('{count} รายการ', { count: c.items.length })}{c.useCount ? t(' · ใช้แล้ว {useCount} ครั้ง', { useCount: c.useCount }) : ''}</span>
                </span>
                <span className="kcal">{fmtInt(comboTotals(c.items).kcal)}<small>kcal</small></span>
              </button>
              <button type="button" className="round-btn brand" aria-label={t('เพิ่ม {name} ลง{meal}', { name: c.name, meal: mealLabel(meal) })} onClick={() => addNow(c)}>
                <Plus size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {combos && combos.length > 0 && <p className="caption muted">{t('แตะ + เพื่อเพิ่มทั้งชุดลงมื้อที่เลือกทันที หรือแตะชื่อเพื่อปรับจำนวนส่วนก่อน')}</p>}
      {open && (
        <ComboSheet
          key={open.id}
          combo={open}
          meal={meal}
          onMealChange={onMealChange}
          onClose={() => setOpenId(null)}
          onAdd={async (c, portions) => { setOpenId(null); await addNow(c, portions); }}
        />
      )}
    </div>
  );
}
