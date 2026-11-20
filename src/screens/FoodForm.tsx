import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button, Chip, Header, NumField, TextField, useBack } from '../ui/kit';
import { deleteCustomFood, getFood, saveCustomFood } from '../db/repo';
import { useApp } from '../app/context';
import { validateFood } from '../lib/validate';
import { kcalFromMacros } from '../lib/nutrition';

import { t } from '../i18n';
const EMOJIS = ['🍽️', '🍛', '🍜', '🍚', '🍲', '🥗', '🍳', '🍗', '🥩', '🐟', '🍤', '🥟', '🍞', '🥪', '🍰', '🍪', '🥤', '☕', '🧋', '🥛', '🍎', '🍌', '🥜', '🌶️'];

/** สร้าง/แก้ไขอาหารของฉัน (route: /food/new และ /food/edit/:id) */
export default function FoodForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const back = useBack('/add');
  const { toast, confirm } = useApp();
  const editing = !!id;

  const [loaded, setLoaded] = useState(!editing);
  const [emoji, setEmoji] = useState('🍽️');
  const [name, setName] = useState(sp.get('name') ?? '');
  const [serving, setServing] = useState(t('1 จาน'));
  const [grams, setGrams] = useState<number | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [carb, setCarb] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  // อาหารที่ผูกกับบาร์โค้ด (จากหน้าสแกน หรือที่เคยบันทึกไว้)
  const [barcode, setBarcode] = useState<string | undefined>(sp.get('barcode') ?? undefined);
  const [brand, setBrand] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<'custom' | 'barcode'>('custom');

  useEffect(() => {
    if (!id) return;
    getFood(id).then((f) => {
      if (!f) {
        toast(t('ไม่พบอาหารนี้'), 'error');
        nav('/add', { replace: true });
        return;
      }
      setEmoji(f.emoji);
      setBarcode(f.barcode);
      setBrand(f.brand);
      setSource(f.source === 'barcode' ? 'barcode' : 'custom');
      setName(f.name);
      setServing(f.serving);
      setGrams(f.grams);
      setKcal(f.kcal);
      setProtein(f.protein);
      setCarb(f.carb);
      setFat(f.fat);
      setLoaded(true);
    });
  }, [id, nav, toast]);

  const errors = validateFood({ name, serving, grams, kcal, protein, carb, fat });
  const hasErrors = Object.keys(errors).length > 0;
  const fromMacros = kcalFromMacros(protein ?? 0, carb ?? 0, fat ?? 0);

  async function save() {
    setTried(true);
    if (hasErrors) return;
    await saveCustomFood({
      id: id,
      name: name.trim(),
      emoji,
      serving: serving.trim(),
      grams: grams!,
      kcal: kcal!,
      protein: protein ?? 0,
      carb: carb ?? 0,
      fat: fat ?? 0,
      barcode,
      brand,
      source,
    });
    toast(editing ? t('แก้ไขอาหารแล้ว') : t('เพิ่ม "{name}" ในอาหารของฉันแล้ว', { name: name.trim() }));
    back();
  }

  if (!loaded) return <div className="screen no-tabs muted center">{t('กำลังโหลด…')}</div>;

  return (
    <>
      <Header title={editing ? t('แก้ไขอาหาร') : t('สร้างอาหารของฉัน')} />
      <main className="screen no-tabs">
        <div className="field">
          <span className="field-label">{t('ไอคอน')}</span>
          <div className="chips" role="radiogroup" aria-label={t('ไอคอนอาหาร')}>
            {EMOJIS.map((e) => (
              <Chip key={e} selected={emoji === e} onClick={() => setEmoji(e)} role="radio" aria-checked={emoji === e} aria-label={t('ไอคอน {e}', { e })} style={{ padding: '0 10px', fontSize: 20 }}>
                {e}
              </Chip>
            ))}
          </div>
        </div>
        {barcode && <p className="pill brand" style={{ alignSelf: 'flex-start' }}>{t('บาร์โค้ด {barcode}', { barcode })}</p>}
        <TextField label={t('ชื่ออาหาร')} placeholder={t('เช่น น้ำพริกแม่บ้าน')} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} error={tried ? errors.name : null} />
        <div className="row-flex" style={{ alignItems: 'flex-start' }}>
          <div className="grow"><TextField label={t('หน่วยบริโภค')} placeholder={t('1 จาน')} value={serving} maxLength={30} onChange={(e) => setServing(e.target.value)} error={tried ? errors.serving : null} /></div>
          <div className="grow"><NumField label={t('น้ำหนักต่อหน่วย')} suffix="g" value={grams} onChange={setGrams} error={tried ? errors.grams : null} /></div>
        </div>
        <p className="caption muted" style={{ marginTop: -4 }}>{t('ใส่ค่าโภชนาการ "ต่อ 1 หน่วยบริโภค" เช่น ต่อ 1 จาน')}</p>
        <NumField label={t('แคลอรี่')} suffix="kcal" value={kcal} onChange={setKcal} error={tried ? errors.kcal : null} />
        <div className="row-flex" style={{ alignItems: 'flex-start' }}>
          <div className="grow"><NumField label={t('โปรตีน')} suffix="g" value={protein} onChange={setProtein} /></div>
          <div className="grow"><NumField label={t('คาร์บ')} suffix="g" value={carb} onChange={setCarb} /></div>
          <div className="grow"><NumField label={t('ไขมัน')} suffix="g" value={fat} onChange={setFat} /></div>
        </div>
        {tried && errors.macros && <p className="field-error">{errors.macros}</p>}
        {(protein !== null || carb !== null || fat !== null) && (
          <button type="button" className="link" style={{ textAlign: 'left' }} onClick={() => setKcal(Math.round(fromMacros))}>{t('คำนวณแคลอรี่จากสารอาหาร = {fromMacros} kcal (แตะเพื่อใช้ค่านี้)', { fromMacros: Math.round(fromMacros) })}</button>
        )}
        <Button onClick={save}>{editing ? t('บันทึกการแก้ไข') : t('บันทึกอาหาร')}</Button>
        {editing && (
          <Button
            variant="danger"
            onClick={async () => {
              if (await confirm({ title: t('ลบ "{name}" ?', { name }), body: t('รายการในไดอารี่ที่เคยบันทึกไว้แล้วจะไม่ถูกลบ'), confirmLabel: t('ลบ'), danger: true })) {
                await deleteCustomFood(id!);
                toast(t('ลบอาหารแล้ว'));
                back();
              }
            }}
          >
            <Trash2 size={18} />{' '}{t('ลบอาหารนี้')}</Button>
        )}
      </main>
    </>
  );
}
