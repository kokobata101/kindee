import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bookmark, Plus, Repeat, Trash2, X } from 'lucide-react';
import { db } from '../db/db';
import { deleteSchedule, getCombos, saveSchedule, setScheduleEnabled } from '../db/repo';
import { MEALS, guessMeal, mealLabel, type MealKey, type Schedule, type ScheduleItem } from '../db/types';
import { Button, Chip, Empty, Header, IconButton, Sheet, Stepper, TextField, Toggle, Thumb, useBack } from '../ui/kit';
import { FoodPicker } from '../ui/FoodPicker';
import { useApp } from '../app/context';
import { THAI_DOW_SHORT, nowHM, toISO } from '../lib/date';
import { scaleNutrients, scheduleItemFromFood, sumTotals } from '../lib/diary';
import { fmtInt } from '../lib/format';
import { comboTotals, scheduleItemsFromCombo } from '../lib/combo';
import { qtyLabel } from '../lib/diary';

import { t } from '../i18n';
import { foodName } from '../lib/names';
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const daysLabel = (d: number[]) =>
  d.length === 7 ? t('ทุกวัน') : d.length === 0 ? t('ไม่ได้เลือกวัน') : [...d].sort().map((i) => THAI_DOW_SHORT[i]).join(' ');

export function Schedules() {
  const nav = useNavigate();
  const { toast, confirm } = useApp();
  const list = useLiveQuery(() => db.schedules.toArray(), []);

  return (
    <>
      <Header
        title={t('ตั้งเวลาบันทึกอัตโนมัติ')}
        action={
          <IconButton label={t('เพิ่มรายการตั้งเวลา')} onClick={() => nav('/schedule/new')}>
            <Plus size={20} />
          </IconButton>
        }
      />
      <main className="screen no-tabs">
        <div className="tip">
          <span className="icon-slot" style={{ background: 'var(--brand)', color: '#fff', borderRadius: 999 }}><Repeat size={18} /></span>
          <div className="col">
            <b style={{ color: 'var(--brand-dark)' }}>{t('อาหารที่กินเป็นประจำ')}</b>
            <span>{t('จะถูกบันทึกให้เองเมื่อคุณเปิดแอปหลังถึงเวลาที่ตั้งไว้ ไม่ต้องกดซ้ำทุกวัน (แอปบนเว็บทำงานเฉพาะตอนเปิดแอปอยู่)')}</span>
          </div>
        </div>

        {list && list.length === 0 && (
          <Empty emoji="🔁" title={t('ยังไม่มีรายการตั้งเวลา')}>{t('เช่น กาแฟดำทุกเช้า หรือโปรตีนเชคหลังออกกำลังกาย')}</Empty>
        )}

        {list?.map((s) => {
          const tot = sumTotals(s.items);
          return (
            <div key={s.id} className="card card-pad col gap12">
              <div className="row-flex">
                <button type="button" className="row-flex grow" style={{ textAlign: 'left', gap: 12, minWidth: 0 }} onClick={() => nav(`/schedule/${s.id}`)} aria-label={t('แก้ไข {name}', { name: s.name })}>
                  <Thumb emoji={s.emoji} />
                  <span className="grow col">
                    <b>{s.name}</b>
                    <span className="row-sub">{t('{meal} · {kcal} kcal · {count} รายการ', { meal: mealLabel(s.meal), kcal: fmtInt(tot.kcal), count: s.items.length })}</span>
                  </span>
                </button>
                <Toggle checked={s.enabled} label={t('เปิดใช้ {name}', { name: s.name })} onChange={(v) => setScheduleEnabled(s.id!, v)} />
              </div>
              <div className="row-flex between">
                <span className="pill brand">⏰ {s.time}</span>
                <span className="caption">{daysLabel(s.days)}</span>
                <button
                  type="button"
                  className="round-btn"
                  aria-label={t('ลบ {name}', { name: s.name })}
                  onClick={async () => {
                    if (await confirm({ title: t('ลบ "{name}" ?', { name: s.name }), body: t('รายการที่บันทึกไปแล้วในไดอารี่จะไม่ถูกลบ'), confirmLabel: t('ลบ'), danger: true })) {
                      await deleteSchedule(s.id!);
                      toast(t('ลบแล้ว'));
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
        <Button onClick={() => nav('/schedule/new')}><Plus size={20} />{' '}{t('เพิ่มรายการตั้งเวลา')}</Button>
      </main>
    </>
  );
}

export function ScheduleEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const back = useBack('/schedules');
  const { toast } = useApp();
  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [meal, setMeal] = useState<MealKey>(guessMeal(new Date().getHours()));
  const [time, setTime] = useState('07:30');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [lastRun, setLastRun] = useState<string | undefined>();
  const [enabled, setEnabled] = useState(true);
  const [picker, setPicker] = useState(false);
  const [comboPicker, setComboPicker] = useState(false);
  const combos = useLiveQuery(() => getCombos(), []);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (isNew) return;
    db.schedules.get(Number(id)).then((s) => {
      if (!s) return back();
      setName(s.name);
      setNameTouched(true);
      setMeal(s.meal);
      setTime(s.time);
      setDays(s.days);
      setItems(s.items);
      setLastRun(s.lastRunDate);
      setEnabled(s.enabled);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const autoName = items.length ? items.map((i) => i.name).slice(0, 2).join(' + ') : '';
  const shownName = nameTouched ? name : autoName;
  const total = sumTotals(items);
  const errors = {
    name: !shownName.trim() ? t('ใส่ชื่อรายการ หรือเพิ่มอาหารก่อน') : null,
    items: items.length === 0 ? t('เพิ่มอาหารอย่างน้อย 1 รายการ') : null,
    days: days.length === 0 ? t('เลือกอย่างน้อย 1 วัน') : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  async function save() {
    setTried(true);
    if (invalid) return;
    const today = toISO();
    const s: Schedule = {
      id: isNew ? undefined : Number(id),
      name: shownName.trim(),
      emoji: items[0]?.emoji ?? '🍽️',
      meal,
      time,
      days: [...days].sort(),
      items,
      enabled,
      // สร้างใหม่หลังเวลาที่ตั้งของวันนี้ → เริ่มพรุ่งนี้ ไม่บันทึกย้อนหลังให้เอง
      lastRunDate: isNew ? (time <= nowHM() ? today : undefined) : lastRun,
    };
    await saveSchedule(s);
    toast(t('บันทึกการตั้งเวลาแล้ว'));
    back();
  }

  if (!loaded) return <div className="screen no-tabs muted center">{t('กำลังโหลด…')}</div>;

  return (
    <>
      <Header title={isNew ? t('เพิ่มรายการตั้งเวลา') : t('แก้ไขรายการตั้งเวลา')} />
      <main className="screen no-tabs">
        <TextField
          label={t('ชื่อรายการ')}
          placeholder={t('เช่น โจ๊กหมูตอนเช้า')}
          value={shownName}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          error={tried ? errors.name : null}
        />

        <div className="field">
          <span className="field-label">{t('บันทึกลงมื้อ')}</span>
          <div className="chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', overflow: 'visible' }} role="group" aria-label={t('มื้อ')}>
            {MEALS.map((m) => (
              <Chip key={m.key} selected={meal === m.key} onClick={() => setMeal(m.key)} style={{ justifyContent: 'center' }}>{m.emoji} {m.label}</Chip>
            ))}
          </div>
        </div>

        <TextField label={t('เวลา')} type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />

        <div className="field">
          <span className="field-label">{t('วันที่ทำซ้ำ')}</span>
          <div className="row-flex" role="group" aria-label={t('วันที่ทำซ้ำ')} style={{ gap: 6 }}>
            {ALL_DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`day-btn grow ${on ? 'sel' : ''}`}
                  style={{ padding: '10px 0', fontWeight: 600 }}
                  aria-pressed={on}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                >
                  {THAI_DOW_SHORT[d]}
                </button>
              );
            })}
          </div>
          {tried && errors.days && <span className="field-error">{errors.days}</span>}
        </div>

        <div className="col gap8">
          <div className="row-flex between">
            <h2 className="h3">{t('อาหารในรายการ')}</h2>
            <span className="caption">{fmtInt(total.kcal)} kcal</span>
          </div>
          {items.map((it, idx) => (
            <div key={`${it.foodId}-${idx}`} className="food-row" style={{ flexWrap: 'wrap', rowGap: 10 }}>
              <Thumb emoji={it.emoji} />
              <span className="grow col">
                <span className="row-title" style={{ fontWeight: 600 }}>{foodName(it)}</span>
                <span className="row-sub">{qtyLabel(it.qty, it.serving)}</span>
              </span>
              <button type="button" className="round-btn" aria-label={t('เอา {name} ออก', { name: foodName(it) })} onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                <X size={15} />
              </button>
              <div className="row-flex between" style={{ flexBasis: '100%' }}>
                <Stepper
                  label={t('จำนวน {name}', { name: foodName(it) })}
                  value={it.qty}
                  step={0.5}
                  min={0.5}
                  max={20}
                  onChange={(q) => {
                    const per = { kcal: it.kcal / it.qty, protein: it.protein / it.qty, carb: it.carb / it.qty, fat: it.fat / it.qty, grams: it.grams / it.qty };
                    const n = scaleNutrients(per, q);
                    setItems(items.map((x, i) => (i === idx ? { ...x, qty: q, ...n } : x)));
                  }}
                />
                <b>{fmtInt(it.kcal)} <small className="caption">kcal</small></b>
              </div>
            </div>
          ))}
          {tried && errors.items && <span className="field-error">{errors.items}</span>}
          <Button variant="secondary" onClick={() => setPicker(true)}><Plus size={18} />{' '}{t('เพิ่มอาหาร')}</Button>
          <Button variant="outline" onClick={() => setComboPicker(true)}><Bookmark size={18} />{' '}{t('เพิ่มจากมื้อประจำ')}</Button>
        </div>

        <Button onClick={save}>{t('บันทึก')}</Button>
      </main>

      <Sheet open={comboPicker} onClose={() => setComboPicker(false)} title={t('เลือกมื้อประจำ')}>
        <div className="col gap8">
          {combos && combos.length === 0 && (
            <Empty emoji="🔖" title={t('ยังไม่มีมื้อประจำ')}>{t('เก็บอาหารหลายอย่างเป็นชุดได้ที่หน้าเพิ่มอาหาร หรือปุ่มบุ๊กมาร์กที่หัวมื้อในไดอารี่')}</Empty>
          )}
          {combos?.map((c) => (
            <button
              key={c.id}
              type="button"
              className="food-row"
              style={{ textAlign: 'left', width: '100%' }}
              aria-label={t('เพิ่มมื้อประจำ {name}', { name: c.name })}
              onClick={() => {
                if (items.length === 0 && !nameTouched) {
                  setName(c.name);
                  setNameTouched(true);
                }
                setItems((cur) => [...cur, ...scheduleItemsFromCombo(c)]);
                setComboPicker(false);
                toast(t('เพิ่ม "{name}" {count} รายการแล้ว', { name: c.name, count: c.items.length }));
              }}
            >
              <Thumb emoji={c.emoji} />
              <span className="grow col" style={{ minWidth: 0 }}>
                <span className="row-title" style={{ fontWeight: 600 }}>{c.name}</span>
                <span className="row-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.items.map((i) => foodName(i)).join(' + ')}</span>
              </span>
              <span className="kcal">{fmtInt(comboTotals(c.items).kcal)}<small>kcal</small></span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={picker} onClose={() => setPicker(false)} full title={t('เลือกอาหาร')}>
        <Header title={t('เลือกอาหารที่จะตั้งเวลา')} onBack={() => setPicker(false)} />
        <div className="screen has-footer" style={{ paddingTop: 0 }}>
          <FoodPicker
            allowCreate={false}
            confirmLabel={(n) => (n ? t('เพิ่ม {n} รายการ', { n }) : t('เพิ่ม'))}
            onConfirm={(picks) => {
              setItems((cur) => [...cur, ...picks.map((p) => scheduleItemFromFood(p.food, p.qty))]);
              setPicker(false);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
