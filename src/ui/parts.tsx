import { useState } from 'react';
import { Bookmark, Plus, Star, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mealEmoji, mealLabel, type Entry, type MealKey } from '../db/types';
import { qtyLabel, servingLabel, scaleNutrients, sumTotals } from '../lib/diary';
import { comboItemFromEntry } from '../lib/combo';
import { isQuickEntry } from '../lib/quick';
import { validateQuick } from '../lib/validate';
import { fmtInt } from '../lib/format';
import { deleteEntry, updateEntry, updateQuickEntry } from '../db/repo';
import { useApp, useProfile } from '../app/context';
import { Button, MacroPills, Sheet, Stepper, Thumb } from './kit';
import { MealChips } from './MealChips';
import { SaveComboSheet } from './Combos';
import { QuickFields, type QuickForm } from './QuickAdd';
import { QUICK_NAME } from '../lib/quick';

import { t } from '../i18n';
import { foodName } from '../lib/names';
export function EntryRow({ e, onClick }: { e: Entry; onClick: () => void }) {
  return (
    <button type="button" className="food-row" onClick={onClick} aria-label={t('แก้ไข {name}', { name: foodName({ name: e.name, foodId: e.foodId }) })}>
      <Thumb emoji={e.emoji} />
      <span className="grow col">
        <span className="row-title" style={{ fontWeight: 600 }}>{foodName({ name: e.name, foodId: e.foodId })}</span>
        <span className="row-sub">
          {e.source === 'quick' ? t('ใส่แคลอรี่เอง') : qtyLabel(e.qty, e.serving)} · {e.time}
          {e.source === 'scheduled' && t(' · อัตโนมัติ')}
        </span>
      </span>
      <span className="kcal">
        {fmtInt(e.kcal)}
        <small>kcal</small>
      </span>
    </button>
  );
}

const MEAL_TONE: Record<MealKey, string> = { breakfast: 'tone-mint', lunch: 'tone-sky', dinner: 'tone-butter', snack: 'tone-peach' };

/** การ์ดหนึ่งมื้อ: หัวข้อ + สารอาหารรวม + รายการ + ปุ่มเพิ่ม */
export function MealSection({
  meal,
  entries,
  date,
  onEdit,
}: {
  meal: MealKey;
  entries: Entry[];
  date: string;
  onEdit: (e: Entry) => void;
}) {
  const nav = useNavigate();
  const p = useProfile();
  const [saving, setSaving] = useState(false);
  const tot = sumTotals(entries);
  const total = tot.kcal;
  const share = p.kcalGoal > 0 ? Math.round((total / p.kcalGoal) * 100) : 0;
  const v1 = (n: number) => String(Math.round(n * 10) / 10);
  const add = () => nav(`/add?meal=${meal}&date=${date}`);
  return (
    <section className={`card meal-card ${MEAL_TONE[meal]}`} aria-label={mealLabel(meal)}>
      <div className="meal-top">
        <span className="chip-ico" aria-hidden style={{ width: 42, height: 42, fontSize: 20 }}>{mealEmoji(meal)}</span>
        <span className="grow col">
          <span className="meal-name">{mealLabel(meal)}</span>
          <span className="caption">{entries.length > 0 ? `${fmtInt(total)} kcal` : t('ยังไม่มีรายการ')}</span>
        </span>
        <span className="meal-actions">
          {entries.length > 0 && (
            <button type="button" className="round-btn" aria-label={t('เก็บ{meal}เป็นมื้อประจำ', { meal: mealLabel(meal) })} onClick={() => setSaving(true)}>
              <Bookmark size={16} />
            </button>
          )}
          {entries.length > 0 && (
            <button type="button" className="round-btn brand" aria-label={t('เพิ่มอาหาร{meal}', { meal: mealLabel(meal) })} onClick={add}>
              <Plus size={18} />
            </button>
          )}
        </span>
      </div>
      {entries.length > 0 && (
        <div className="meal-macros">
          <span className="col"><b className="m-v">{v1(tot.protein)}</b><span className="m-l">{t('โปรตีน')}</span></span>
          <span className="col"><b className="m-v">{v1(tot.fat)}</b><span className="m-l">{t('ไขมัน')}</span></span>
          <span className="col"><b className="m-v">{v1(tot.carb)}</b><span className="m-l">{t('คาร์บ')}</span></span>
          <span className="col"><b className="m-v">{share}%</b><span className="m-l">{t('ของเป้าวัน')}</span></span>
        </div>
      )}
      {entries.length === 0 ? (
        <button type="button" className="empty-meal" onClick={add}>{t('ยังไม่ได้บันทึก · แตะเพื่อเพิ่ม{meal}', { meal: mealLabel(meal) })}</button>
      ) : (
        entries.map((e) => <EntryRow key={e.id} e={e} onClick={() => onEdit(e)} />)
      )}
      <SaveComboSheet open={saving} onClose={() => setSaving(false)} items={entries.map(comboItemFromEntry)} />
    </section>
  );
}

const quickFormOf = (e: Entry | null): QuickForm =>
  e
    ? { kcal: e.unit.kcal, name: e.name === QUICK_NAME ? '' : e.name, protein: e.unit.protein || null, carb: e.unit.carb || null, fat: e.unit.fat || null }
    : { kcal: null, name: '', protein: null, carb: null, fat: null };

/** แผ่นแก้ไขรายการอาหาร: เปลี่ยนจำนวน/มื้อ หรือลบ (รายการแคลอรี่ด่วนแก้แคลอรี่/ชื่อ/สารอาหารได้) */
export function EntrySheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const { toast, confirm } = useApp();
  const [qty, setQty] = useState(entry?.qty ?? 1);
  const [meal, setMeal] = useState<MealKey>(entry?.meal ?? 'lunch');
  const [qf, setQf] = useState<QuickForm>(() => quickFormOf(entry));
  const [tried, setTried] = useState(false);
  const [key, setKey] = useState<number | undefined>(entry?.id);
  if (entry && entry.id !== key) {
    // เปิดรายการใหม่ → รีเซ็ตค่าในฟอร์ม
    setKey(entry.id);
    setQty(entry.qty);
    setMeal(entry.meal);
    setQf(quickFormOf(entry));
    setTried(false);
  }
  const quick = !!entry && isQuickEntry(entry);
  const errors = validateQuick(qf);
  const n = !entry
    ? null
    : quick
      ? { kcal: qf.kcal ?? 0, protein: qf.protein ?? 0, carb: qf.carb ?? 0, fat: qf.fat ?? 0 }
      : scaleNutrients(entry.unit, qty);
  return (
    <Sheet open={!!entry} onClose={onClose} title={entry ? foodName({ name: entry.name, foodId: entry.foodId }) : undefined}>
      {entry && n && (
        <div className="col gap16">
          <div className="row-flex">
            <Thumb emoji={entry.emoji} />
            <span className="grow caption">
              {quick ? t('แคลอรี่ที่ใส่เอง') : t('ต่อ 1 หน่วย: {serving}{v2}', { serving: servingLabel(entry.serving), v2: entry.unit.grams > 0 ? ` (${fmtInt(entry.unit.grams)} g)` : '' })}
            </span>
          </div>
          {quick ? (
            <QuickFields value={qf} onChange={setQf} errors={tried ? errors : undefined} presets={false} />
          ) : (
            <div className="row-flex between">
              <span className="body-medium">{t('จำนวน')}</span>
              <Stepper label={t('จำนวน')} value={qty} onChange={setQty} step={0.5} min={0.5} max={20} />
            </div>
          )}
          <MacroPills kcal={n.kcal} protein={n.protein} carb={n.carb} fat={n.fat} />
          <MealChips meal={meal} onChange={setMeal} />
          <Button
            onClick={async () => {
              if (quick) {
                setTried(true);
                if (Object.keys(errors).length > 0) return;
                await updateQuickEntry(entry.id!, { kcal: qf.kcal!, name: qf.name, protein: qf.protein, carb: qf.carb, fat: qf.fat, meal });
              } else {
                await updateEntry(entry.id!, { qty, meal });
              }
              toast(t('บันทึกการแก้ไขแล้ว'));
              onClose();
            }}
          >{t('บันทึกการแก้ไข')}</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (await confirm({ title: t('ลบ "{name}" ?', { name: entry.name }), body: t('รายการนี้จะถูกลบออกจากไดอารี่'), confirmLabel: t('ลบ'), danger: true })) {
                await deleteEntry(entry.id!);
                toast(t('ลบรายการแล้ว'));
                onClose();
              }
            }}
          >
            <Trash2 size={18} />{' '}{t('ลบรายการ')}</Button>
        </div>
      )}
    </Sheet>
  );
}

export function FavStar({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="round-btn" aria-label={on ? t('เอาออกจากรายการโปรด') : t('เพิ่มในรายการโปรด')} aria-pressed={on} onClick={onClick}>
      <Star size={16} fill={on ? 'var(--carb)' : 'none'} color={on ? 'var(--carb)' : 'currentColor'} />
    </button>
  );
}
