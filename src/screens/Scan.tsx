import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flashlight, ScanLine } from 'lucide-react';
import { useApp } from '../app/context';
import { addFoodEntry } from '../db/repo';
import { lookupBarcode, type LookupResult } from '../db/off';
import { MEALS, guessMeal, type MealKey } from '../db/types';
import { cleanBarcode, normalizeBarcode } from '../lib/barcode';
import { CameraError, startScanning, type ScanSession } from '../lib/scanner';
import { scaleNutrients, servingLabel } from '../lib/diary';
import { formatThaiLong, nowHM } from '../lib/date';
import { fmtInt } from '../lib/format';
import { Button, Chip, Empty, Header, MacroPills, Stepper, TextField, Thumb } from '../ui/kit';

import { t } from '../i18n';
import { mealButtonLabel } from '../ui/MealChips';
type Phase =
  | { kind: 'camera' }
  | { kind: 'looking'; code: string }
  | { kind: 'result'; code: string; result: LookupResult };

const CAMERA_HELP: Record<string, string> = {
  denied: t('ยังไม่ได้อนุญาตให้ใช้กล้อง กดไอคอนกล้อง/แม่กุญแจข้างช่องที่อยู่เว็บเพื่ออนุญาต แล้วกดลองใหม่ หรือพิมพ์เลขบาร์โค้ดด้านล่างแทนได้'),
  nocamera: t('ไม่พบกล้องบนอุปกรณ์นี้ พิมพ์เลขบาร์โค้ดด้านล่างแทนได้'),
  insecure: t('การเปิดกล้องต้องเปิดแอปผ่าน HTTPS พิมพ์เลขบาร์โค้ดด้านล่างแทนได้'),
  unsupported: t('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง พิมพ์เลขบาร์โค้ดด้านล่างแทนได้'),
  other: t('เปิดกล้องไม่สำเร็จ พิมพ์เลขบาร์โค้ดด้านล่างแทนได้'),
};

export default function Scan() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { toast, date: ctxDate, today } = useApp();
  const paramMeal = sp.get('meal') as MealKey | null;
  const [meal, setMeal] = useState<MealKey>(paramMeal && MEALS.some((m) => m.key === paramMeal) ? paramMeal : guessMeal(new Date().getHours()));
  const paramDate = sp.get('date');
  const date = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) && paramDate <= today ? paramDate : ctxDate;

  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<ScanSession | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [camError, setCamError] = useState<CameraError | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [manualErr, setManualErr] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [attempt, setAttempt] = useState(0);

  const stopCamera = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setCamReady(false);
    setTorch(false);
  }, []);

  const lookup = useCallback(
    async (code: string) => {
      stopCamera();
      setPhase({ kind: 'looking', code });
      const result = await lookupBarcode(code);
      setQty(1);
      setPhase({ kind: 'result', code, result });
    },
    [stopCamera],
  );

  // เปิดกล้องเมื่ออยู่ในโหมดกล้อง
  useEffect(() => {
    if (phase.kind !== 'camera') return;
    let cancelled = false;
    setCamError(null);
    const v = videoRef.current;
    if (!v) return;
    startScanning(v, (code) => void lookup(code))
      .then((s) => {
        if (cancelled) return s.stop();
        sessionRef.current = s;
        setCamReady(true);
      })
      .catch((e) => !cancelled && setCamError(e instanceof CameraError ? e : new CameraError('other', t('เปิดกล้องไม่สำเร็จ'))));
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [phase.kind, attempt, lookup, stopCamera]);

  function submitManual() {
    const code = normalizeBarcode(manual);
    if (!code) return setManualErr(t('เลขบาร์โค้ดไม่ถูกต้อง (ต้องเป็น 8, 12, 13 หรือ 14 หลัก และผ่านการตรวจเลขท้าย)'));
    setManualErr(null);
    void lookup(code);
  }

  async function add(result: Extract<LookupResult, { kind: 'found' }>) {
    const time = date === today ? nowHM() : { breakfast: '08:00', lunch: '12:30', dinner: '18:30', snack: '15:30' }[meal];
    await addFoodEntry(result.food, qty, meal, date, time, 'barcode');
    toast(t('บันทึก {name} แล้ว', { name: result.food.name }));
    nav('/', { replace: true });
  }

  const retry = () => {
    setPhase({ kind: 'camera' });
    setAttempt((n) => n + 1);
  };

  return (
    <>
      <Header title={t('สแกนบาร์โค้ด')} />
      <main className="screen no-tabs">
        {date !== today && <p className="pill warn" style={{ alignSelf: 'flex-start' }}>{t('บันทึกย้อนหลัง · {date}', { date: formatThaiLong(date) })}</p>}

        {phase.kind === 'camera' && (
          <>
            <div className="scan-view" aria-label={t('กล้องสแกนบาร์โค้ด')} hidden={!!camError}>
              <video ref={videoRef} className="scan-video" playsInline muted data-testid="scan-video" />
              {camReady && <div className="scan-frame" aria-hidden><i /></div>}
              {!camReady && !camError && <div className="scan-hint muted" role="status">{t('กำลังเปิดกล้อง…')}</div>}
              {camReady && sessionRef.current?.setTorch && (
                <button
                  type="button"
                  className={`round-btn scan-torch ${torch ? 'brand' : ''}`}
                  aria-label={torch ? t('ปิดไฟฉาย') : t('เปิดไฟฉาย')}
                  onClick={async () => {
                    try {
                      await sessionRef.current?.setTorch?.(!torch);
                      setTorch(!torch);
                    } catch {
                      toast(t('เปิดไฟฉายไม่ได้'), 'error');
                    }
                  }}
                >
                  <Flashlight size={18} />
                </button>
              )}
            </div>
            {camError ? (
              <div className="card card-pad col gap8" role="alert">
                <b>{t('เปิดกล้องไม่ได้')}</b>
                <span className="caption">{CAMERA_HELP[camError.kind]}</span>
                <Button variant="outline" small block={false} onClick={retry}>{t('ลองเปิดกล้องอีกครั้ง')}</Button>
              </div>
            ) : (
              <p className="caption muted center" role="status">
                <ScanLine size={14} style={{ verticalAlign: '-2px' }} />{' '}{t('เล็งบาร์โค้ดให้อยู่ในกรอบ ห่างจากสินค้าประมาณ 10–20 ซม.')}</p>
            )}
            <section className="card card-pad col gap8" aria-label={t('พิมพ์เลขบาร์โค้ด')}>
              <TextField
                label={t('หรือพิมพ์เลขบาร์โค้ด')}
                inputMode="numeric"
                placeholder={t('เช่น 8850999320014')}
                value={manual}
                error={manualErr}
                onChange={(e) => setManual(cleanBarcode(e.target.value).slice(0, 14))}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              />
              <Button variant="secondary" onClick={submitManual}>{t('ค้นหาสินค้า')}</Button>
            </section>
          </>
        )}

        {phase.kind === 'looking' && (
          <div className="card card-pad center col gap8" role="status">
            <span className="num-m">{phase.code}</span>
            <span className="muted">{t('กำลังค้นหาสินค้า…')}</span>
          </div>
        )}

        {phase.kind === 'result' && <Result phase={phase} qty={qty} setQty={setQty} meal={meal} setMeal={setMeal} onAdd={add} onRetry={retry} onCreate={(name) => nav(`/food/new?barcode=${phase.code}${name ? `&name=${encodeURIComponent(name)}` : ''}`)} />}
      </main>
    </>
  );
}

function Result({
  phase,
  qty,
  setQty,
  meal,
  setMeal,
  onAdd,
  onRetry,
  onCreate,
}: {
  phase: Extract<Phase, { kind: 'result' }>;
  qty: number;
  setQty: (n: number) => void;
  meal: MealKey;
  setMeal: (m: MealKey) => void;
  onAdd: (r: Extract<LookupResult, { kind: 'found' }>) => void;
  onRetry: () => void;
  onCreate: (name?: string) => void;
}) {
  const r = phase.result;
  if (r.kind === 'found') {
    const n = scaleNutrients(r.food, qty);
    const per100 = r.food.serving.startsWith('100');
    return (
      <>
        <section className="card card-pad col gap12" aria-label={t('ข้อมูลสินค้า')} data-testid="scan-result">
          <div className="row-flex" style={{ gap: 12 }}>
            <Thumb emoji={r.food.emoji} />
            <div className="col grow">
              <b className="h3" data-testid="scan-name">{r.food.name}</b>
              {r.food.brand && <span className="caption">{r.food.brand}</span>}
              <span className="caption muted">{t('บาร์โค้ด {code}', { code: phase.code })}{r.cached ? t(' · จากเครื่องของคุณ') : ''}</span>
            </div>
          </div>
          <div className="row-flex between">
            <span className="body-medium">{t('จำนวน ({serving})', { serving: servingLabel(r.food.serving) })}</span>
            <Stepper label={t('จำนวน')} value={qty} onChange={setQty} step={per100 ? 0.25 : 0.5} min={per100 ? 0.25 : 0.5} max={50} />
          </div>
          <div className="num-l" data-testid="scan-kcal">{fmtInt(n.kcal)} <small className="caption">kcal</small></div>
          <MacroPills kcal={n.kcal} protein={n.protein} carb={n.carb} fat={n.fat} />
          {per100 && <p className="caption muted">{t('ไม่ทราบน้ำหนักต่อหน่วย จึงแสดงต่อ 100 กรัม (1 = 100 g, 0.5 = 50 g)')}</p>}
          {r.incomplete && <p className="caption" style={{ color: 'var(--calorie)' }}>{t('⚠️ สินค้านี้ไม่มีข้อมูลโปรตีน/คาร์บ/ไขมันครบ จึงนับเป็น 0 ตรวจกับฉลากแล้วแก้ในอาหารของฉันได้')}</p>}
          <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }} role="radiogroup" aria-label={t('มื้อ')}>
            {MEALS.map((m) => (
              <Chip key={m.key} selected={meal === m.key} role="radio" aria-checked={meal === m.key} onClick={() => setMeal(m.key)}>{m.emoji} {m.label}</Chip>
            ))}
          </div>
          <Button onClick={() => onAdd(r)}>{mealButtonLabel(meal)}</Button>
          <Button variant="outline" onClick={onRetry}>{t('สแกนอีกชิ้น')}</Button>
          {!r.cached && <p className="caption muted">{t('ข้อมูลโภชนาการจาก Open Food Facts (ODbL) ซึ่งผู้ใช้ทั่วโลกช่วยกันเพิ่ม อาจไม่ตรงกับฉลากเสมอไป')}</p>}
        </section>
      </>
    );
  }
  const msg: Record<string, { title: string; body: string }> = {
    notfound: { title: t('ไม่พบสินค้านี้ในฐานข้อมูล'), body: t('บาร์โค้ด {code} ยังไม่มีใน Open Food Facts คุณสร้างเป็นอาหารของฉันพร้อมผูกบาร์โค้ด ครั้งหน้าสแกนจะเจอเลย', { code: phase.code }) },
    nodata: { title: t('สินค้านี้ไม่มีข้อมูลพลังงาน'), body: t('มีชื่อสินค้าแต่ยังไม่มีค่าโภชนาการ กรอกเองจากฉลากได้') },
    offline: { title: t('เชื่อมต่ออินเทอร์เน็ตไม่ได้'), body: t('ค้นหาสินค้าใหม่ต้องใช้อินเทอร์เน็ต สินค้าที่เคยสแกนแล้วจะใช้แบบออฟไลน์ได้') },
    error: { title: t('ค้นหาไม่สำเร็จ'), body: r.kind === 'error' ? r.message : '' },
  };
  const m = msg[r.kind];
  return (
    <section className="col gap12" role="alert" data-testid="scan-problem">
      <Empty emoji={r.kind === 'offline' ? '📡' : '🔍'} title={m.title}>{m.body}</Empty>
      {(r.kind === 'notfound' || r.kind === 'nodata') && <Button onClick={() => onCreate(r.kind === 'nodata' ? r.name : undefined)}>{t('สร้างเป็นอาหารของฉัน')}</Button>}
      <Button variant="outline" onClick={onRetry}>{r.kind === 'offline' || r.kind === 'error' ? t('ลองอีกครั้ง') : t('สแกนอีกชิ้น')}</Button>
    </section>
  );
}
