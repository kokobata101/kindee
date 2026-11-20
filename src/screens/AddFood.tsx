import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { Header, IconButton, Segmented, useBack } from '../ui/kit';
import { FoodPicker } from '../ui/FoodPicker';
import { mealButtonLabel } from '../ui/MealChips';
import { QuickAddPanel } from '../ui/QuickAdd';
import { CombosPanel, SaveComboSheet } from '../ui/Combos';
import { useApp } from '../app/context';
import { addManyEntries, addQuickEntry } from '../db/repo';
import { MEALS, guessMeal, mealLabel, type ComboItem, type MealKey } from '../db/types';
import { entryFromFood } from '../lib/diary';
import { comboItemFromFood } from '../lib/combo';
import { formatThaiLong, nowHM } from '../lib/date';

import { t } from '../i18n';
type Mode = 'search' | 'combos' | 'quick';
const MODES: Mode[] = ['search', 'combos', 'quick'];

export default function AddFood() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { date: ctxDate, today, toast } = useApp();
  const back = useBack('/');
  const paramMeal = sp.get('meal') as MealKey | null;
  const [meal, setMeal] = useState<MealKey>(paramMeal && MEALS.some((m) => m.key === paramMeal) ? paramMeal : guessMeal(new Date().getHours()));
  const paramMode = sp.get('mode') as Mode | null;
  const [mode, setMode] = useState<Mode>(paramMode && MODES.includes(paramMode) ? paramMode : 'search');
  const [saveItems, setSaveItems] = useState<ComboItem[] | null>(null);
  const paramDate = sp.get('date');
  const date = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) && paramDate <= today ? paramDate : ctxDate;
  const entryTime = () => (date === today ? nowHM() : defaultTime(meal));

  return (
    <>
      <Header
        title={t('เพิ่มอาหาร')}
        action={<IconButton label={t('สแกนบาร์โค้ด')} onClick={() => nav(`/scan?meal=${meal}&date=${date}`)}><ScanLine size={20} /></IconButton>}
      />
      <main className="screen has-footer" style={{ paddingTop: 0 }}>
        {date !== today && <p className="pill warn" style={{ alignSelf: 'flex-start' }}>{t('บันทึกย้อนหลัง · {date}', { date: formatThaiLong(date) })}</p>}
        <Segmented
          label={t('วิธีเพิ่มอาหาร')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'search', label: t('ค้นหา') },
            { value: 'combos', label: <><span aria-hidden>🔖</span>{' '}{t('มื้อประจำ')}</> },
            { value: 'quick', label: <><span aria-hidden>⚡</span>{' '}{t('แคลอรี่ด่วน')}</> },
          ]}
        />
        {/* ซ่อนแทนการถอดออก เพื่อไม่ให้รายการที่เลือกไว้หายเมื่อสลับโหมด */}
        <div hidden={mode !== 'search'}>
          <FoodPicker
            meal={meal}
            onMealChange={setMeal}
            confirmLabel={() => mealButtonLabel(meal)}
            initialQuery={sp.get('q') ?? ''}
            onSaveCombo={(picks) => setSaveItems(picks.map((p) => comboItemFromFood(p.food, p.qty)))}
            onConfirm={async (picks) => {
              const time = entryTime();
              const now = Date.now();
              await addManyEntries(picks.map((p, i) => entryFromFood(p.food, p.qty, meal, date, time, 'search', now + i)));
              toast(t('บันทึก {count} รายการแล้ว', { count: picks.length }));
              back();
            }}
          />
        </div>
        {mode === 'combos' && <CombosPanel meal={meal} onMealChange={setMeal} date={date} getTime={entryTime} onAdded={back} />}
        {mode === 'quick' && (
          <QuickAddPanel
            meal={meal}
            onMealChange={setMeal}
            onAdd={async (f) => {
              await addQuickEntry({ kcal: f.kcal!, name: f.name, protein: f.protein, carb: f.carb, fat: f.fat }, meal, date, entryTime());
              toast(t('บันทึก {kcal} kcal ลง{meal}แล้ว', { kcal: f.kcal, meal: mealLabel(meal) }));
              back();
            }}
          />
        )}
        <SaveComboSheet open={saveItems !== null} items={saveItems ?? []} onClose={() => setSaveItems(null)} />
      </main>
    </>
  );
}

/** เวลาตั้งต้นของมื้อ เมื่อบันทึกย้อนหลัง */
function defaultTime(m: MealKey): string {
  return { breakfast: '08:00', lunch: '12:30', dinner: '18:30', snack: '15:30' }[m];
}
