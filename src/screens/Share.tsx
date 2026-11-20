import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Download, Lock, Printer, Share2 } from 'lucide-react';
import { useApp, useProfile } from '../app/context';
import { useRangeData, useWeights } from '../app/hooks';
import { addDays, rangeDays } from '../lib/date';
import { macroGrams, GOAL_LABEL } from '../lib/nutrition';
import { summarizeDays } from '../lib/stats';
import {
  ShareError,
  buildReport,
  decodeReport,
  encodeReport,
  isEncrypted,
  reportUrl,
  type ReportData,
} from '../lib/share';
import { exportCSV } from '../db/backup';
import { copyText, downloadText } from '../lib/download';
import { Button, Chip, Header, TextField } from '../ui/kit';
import { ReportView } from '../ui/ReportView';
import { APP_NAME } from '../app/meta';

import { t } from '../i18n';
const SPANS = [7, 14, 30];
const MIN_PW = 4;

export default function Share() {
  const p = useProfile();
  const { today, toast } = useApp();
  const { logs } = useWeights();
  const [span, setSpan] = useState(7);
  const [showName, setShowName] = useState(true);
  const [password, setPassword] = useState('');
  const [link, setLink] = useState<{ url: string; svg: string | null; qrError: string | null; encrypted: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const from = addDays(today, -(span - 1));
  const data = useRangeData(from, today);

  const report = useMemo<ReportData>(() => {
    const days = summarizeDays(rangeDays(from, span), data.entries, data.water, data.acts);
    return buildReport({
      name: showName ? p.name : '',
      from,
      to: today,
      goal: { kcal: p.kcalGoal, protein: macroGrams(p.kcalGoal, p.split).protein, water: p.waterGoalMl, label: GOAL_LABEL[p.goal] },
      days,
      weights: logs.map((w) => ({ date: w.date, kg: w.kg })),
    });
  }, [from, span, today, data.entries, data.water, data.acts, logs, p, showName]);

  // เปลี่ยนข้อมูลที่แชร์ → ลิงก์เดิมไม่ตรงกับที่เห็นแล้ว
  useEffect(() => setLink(null), [span, showName, password]);

  async function csv(kind: 'foods' | 'weights' | 'activities' | 'water', label: string) {
    const files = await exportCSV(from, today);
    // ชื่อไฟล์ใช้ภาษาอังกฤษ เพราะบางเบราว์เซอร์ตัดชื่อไฟล์ภาษาไทยทิ้ง
    downloadText(`kindee-${kind}-${from}_${today}.csv`, files[kind], 'text/csv;charset=utf-8');
    toast(t('ดาวน์โหลด CSV {label} แล้ว', { label }));
  }

  async function makeLink() {
    if (password && password.length < MIN_PW) return toast(t('รหัสผ่านต้องยาวอย่างน้อย {MIN_PW} ตัวอักษร', { MIN_PW }), 'error');
    setBusy(true);
    try {
      const payload = await encodeReport(report, password || undefined);
      const url = reportUrl(payload);
      let svg: string | null = null;
      let qrError: string | null = null;
      try {
        svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'L', margin: 2 });
      } catch {
        qrError = t('ข้อมูลมากเกินกว่าจะใส่ใน QR ได้ ลองลดจำนวนวัน แต่ลิงก์ยังใช้งานได้');
      }
      setLink({ url, svg, qrError, encrypted: !!password });
    } catch {
      toast(t('สร้างลิงก์ไม่สำเร็จ'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    const ok = await copyText(link.url);
    toast(ok ? t('คัดลอกลิงก์แล้ว') : t('คัดลอกไม่สำเร็จ ลองกดค้างที่ลิงก์'), ok ? 'ok' : 'error');
  }

  const isLocalFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <>
      <Header title={t('แชร์ให้โค้ช / แพทย์')} />
      <main className="screen no-tabs">
        <div className="hide-print col gap16">
          <section className="col gap8" aria-label={t('ช่วงเวลา')}>
            <h2 className="h3">{t('ช่วงที่ต้องการแชร์')}</h2>
            <div className="chips" role="radiogroup" aria-label={t('ช่วงเวลา')}>
              {SPANS.map((n) => (
                <Chip key={n} selected={span === n} role="radio" aria-checked={span === n} onClick={() => setSpan(n)}>{t('{n} วันล่าสุด', { n })}</Chip>
              ))}
            </div>
            <div className="list-row group" style={{ cursor: 'pointer' }} onClick={() => setShowName(!showName)}>
              <span className="grow col"><span className="row-title">{t('แสดงชื่อเล่นในรายงาน')}</span><span className="row-sub">{t('ปิดไว้ถ้าไม่อยากให้เห็นชื่อ')}</span></span>
              <button type="button" role="switch" aria-checked={showName} aria-label={t('แสดงชื่อเล่นในรายงาน')} className="toggle" onClick={(e) => { e.stopPropagation(); setShowName(!showName); }} />
            </div>
          </section>

          <section className="card card-pad col gap12" aria-label={t('ส่งออกไฟล์')}>
            <h2 className="h3">{t('ส่งออกเป็นไฟล์')}</h2>
            <Button onClick={() => window.print()}><Printer size={18} />{' '}{t('พิมพ์ / บันทึกเป็น PDF')}</Button>
            <p className="caption muted">{t('กด "บันทึกเป็น PDF" ในหน้าต่างพิมพ์ของเบราว์เซอร์ (รายงานด้านล่างจะถูกพิมพ์เท่านั้น)')}</p>
            <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }} role="group" aria-label={t('ดาวน์โหลด CSV')}>
              <Chip onClick={() => csv('foods', t('อาหาร'))}><Download size={14} />{' '}{t('CSV อาหาร')}</Chip>
              <Chip onClick={() => csv('weights', t('น้ำหนัก'))}><Download size={14} />{' '}{t('CSV น้ำหนัก')}</Chip>
              <Chip onClick={() => csv('activities', t('กิจกรรม'))}><Download size={14} />{' '}{t('CSV กิจกรรม')}</Chip>
              <Chip onClick={() => csv('water', t('น้ำ'))}><Download size={14} />{' '}{t('CSV น้ำ')}</Chip>
            </div>
            <p className="caption muted">{t('ไฟล์ CSV เปิดใน Excel / Google Sheets ได้ (ภาษาไทยไม่เพี้ยน)')}</p>
          </section>

          <section className="card card-pad col gap12" aria-label={t('ลิงก์และ QR')}>
            <h2 className="h3">{t('ลิงก์ / QR สำหรับเปิดบนมือถือ')}</h2>
            <p className="caption muted">{t('ข้อมูลสรุปทั้งหมดถูกใส่ไว้ในตัวลิงก์เอง (ส่วนหลังเครื่องหมาย #) จึงไม่ถูกส่งไปเก็บบนเซิร์ฟเวอร์ใดๆ ผู้รับต้องเปิดลิงก์ผ่านเว็บที่โฮสต์แอปกินดีเดียวกันนี้')}</p>
            {isLocalFile && (
              <p className="caption" role="note" data-testid="file-warning" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: 10, borderRadius: 10 }}>{t('ตอนนี้คุณเปิดแอปจากไฟล์ในเครื่อง ลิงก์และ QR ด้านล่างจึงใช้ได้เฉพาะเครื่องนี้ ส่งให้คนอื่นเปิดไม่ได้ ถ้าจะส่งให้โค้ช/แพทย์ ให้ใช้ "พิมพ์ / บันทึกเป็น PDF" หรือไฟล์ CSV ด้านบน หรือโฮสต์แอปบนเว็บ (https) ก่อน')}</p>
            )}
            <TextField
              label={t('รหัสผ่านป้องกัน (ไม่บังคับ)')}
              type="password"
              autoComplete="new-password"
              placeholder={t('อย่างน้อย {MIN_PW} ตัวอักษร ถ้าเว้นว่างจะเปิดได้ทันที', { MIN_PW })}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={t('เข้ารหัสด้วย AES-256 บอกรหัสผ่านให้ผู้รับแยกต่างหาก')}
            />
            <Button variant="secondary" onClick={makeLink} disabled={busy}>
              {password ? <Lock size={18} /> : <Share2 size={18} />}{' '}{t('สร้างลิงก์และ QR')}</Button>
            {link && (
              <div className="col gap12" data-testid="share-result">
                {link.svg && (
                  <div
                    role="img"
                    aria-label={t('QR code รายงาน')}
                    style={{ background: '#fff', borderRadius: 16, padding: 8, width: 240, alignSelf: 'center' }}
                    dangerouslySetInnerHTML={{ __html: link.svg }}
                  />
                )}
                {link.qrError && <p className="caption" style={{ color: 'var(--calorie)' }}>{link.qrError}</p>}
                <p className="caption muted" style={{ wordBreak: 'break-all' }} data-testid="share-url">{link.url}</p>
                <div className="row-flex" style={{ gap: 8 }}>
                  <Button variant="outline" small onClick={copy}><Copy size={16} />{' '}{t('คัดลอกลิงก์')}</Button>
                  {canShare && (
                    <Button variant="outline" small onClick={() => navigator.share({ title: t('รายงานจาก{APP_NAME}', { APP_NAME }), url: link.url }).catch(() => undefined)}>
                      <Share2 size={16} />{' '}{t('ส่งต่อ')}</Button>
                  )}
                </div>
                <p className="caption muted">{link.encrypted ? t('🔒 ลิงก์นี้ต้องใช้รหัสผ่านจึงจะเปิดได้') : t('⚠️ ใครมีลิงก์นี้ก็เปิดอ่านได้ ถ้าต้องการความเป็นส่วนตัวให้ตั้งรหัสผ่าน')}</p>
              </div>
            )}
          </section>
          <h2 className="h3">{t('ตัวอย่างรายงาน')}</h2>
        </div>
        <ReportView r={report} />
      </main>
    </>
  );
}

/** หน้าเปิดรายงานจากลิงก์ (ผู้รับไม่ต้องมีบัญชีหรือข้อมูลในแอป) */
export function ReportViewer() {
  const [params] = useSearchParams();
  const payload = params.get('d') ?? '';
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needPw, setNeedPw] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function open(password?: string) {
    setBusy(true);
    setError(null);
    try {
      setReport(await decodeReport(payload, password));
      setNeedPw(false);
    } catch (e) {
      setError(e instanceof ShareError ? e.message : t('เปิดรายงานไม่สำเร็จ'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setReport(null);
    if (!payload) return setError(t('ไม่พบข้อมูลรายงานในลิงก์'));
    if (isEncrypted(payload)) {
      setNeedPw(true);
      setError(null);
    } else {
      void open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  return (
    <main className="screen no-tabs" aria-label={t('รายงานจากลิงก์')}>
      <div className="row-flex between hide-print" style={{ paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
        <span className="body-medium">{t('{APP_NAME} · รายงานแบบอ่านอย่างเดียว', { APP_NAME })}</span>
        {report && <Button variant="outline" small block={false} onClick={() => window.print()}><Printer size={16} />{' '}{t('พิมพ์')}</Button>}
      </div>
      {needPw && !report && (
        <section className="card card-pad col gap12" aria-label={t('ใส่รหัสผ่าน')}>
          <h1 className="h3"><Lock size={18} style={{ verticalAlign: '-3px' }} />{' '}{t('รายงานนี้ป้องกันด้วยรหัสผ่าน')}</h1>
          <TextField label={t('รหัสผ่าน')} type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} error={error} onKeyDown={(e) => e.key === 'Enter' && pw && open(pw)} />
          <Button onClick={() => open(pw)} disabled={!pw || busy}>{t('เปิดรายงาน')}</Button>
        </section>
      )}
      {!needPw && error && <p role="alert" className="card card-pad" style={{ color: 'var(--calorie)' }}>{error}</p>}
      {report && <ReportView r={report} />}
      <p className="caption muted hide-print">{t('ข้อมูลอยู่ในลิงก์นี้เท่านั้น ไม่ได้ถูกอัปโหลดไปที่ใด ·')}{' '}<Link className="link" to="/welcome">{t('รู้จักแอปกินดี')}</Link>
      </p>
    </main>
  );
}
