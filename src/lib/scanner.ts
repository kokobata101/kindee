// สแกนบาร์โค้ดจากกล้องบนเครื่อง ไม่ส่งภาพไปที่ใด
// ใช้ BarcodeDetector ของเบราว์เซอร์ถ้ารองรับ (เร็ว, Chrome บน Android) ไม่งั้นใช้ ZXing (โหลดเฉพาะตอนเปิดหน้าสแกน)

import { normalizeBarcode } from './barcode';

import { t } from '../i18n';
export type CameraErrorKind = 'denied' | 'nocamera' | 'insecure' | 'unsupported' | 'other';
export class CameraError extends Error {
  constructor(public kind: CameraErrorKind, message: string) {
    super(message);
  }
}

export interface ScanSession {
  stop(): void;
  /** null = ไฟฉายไม่รองรับ */
  setTorch: ((on: boolean) => Promise<void>) | null;
  engine: 'native' | 'zxing';
}

type NativeDetector = { detect(v: CanvasImageSource): Promise<{ rawValue: string }[]> };
type NativeCtor = { new (o: { formats: string[] }): NativeDetector; getSupportedFormats(): Promise<string[]> };

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(window.isSecureContext ? 'unsupported' : 'insecure', t('เบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องใช้ HTTPS)'));
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied', t('ยังไม่ได้อนุญาตให้ใช้กล้อง'));
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('nocamera', t('ไม่พบกล้องบนอุปกรณ์นี้'));
    throw new CameraError('other', t('เปิดกล้องไม่สำเร็จ'));
  }
}

/** เปิดกล้องแสดงใน video แล้วเรียก onCode ครั้งเดียวเมื่ออ่านบาร์โค้ดที่ถูกต้องได้ */
export async function startScanning(video: HTMLVideoElement, onCode: (code: string) => void): Promise<ScanSession> {
  const stream = await openCamera();
  video.srcObject = stream;
  video.muted = true;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => undefined);

  let stopped = false;
  let timer = 0;
  const finish = (code: string) => {
    if (stopped) return;
    stopped = true;
    onCode(code);
  };

  let decodeFrame: () => Promise<string | null>;
  let engine: ScanSession['engine'] = 'zxing';

  const Native = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  let useNative = false;
  if (Native) {
    try {
      useNative = (await Native.getSupportedFormats()).includes('ean_13');
    } catch {
      useNative = false;
    }
  }

  if (useNative) {
    engine = 'native';
    const det = new Native!({ formats: FORMATS });
    decodeFrame = async () => {
      const r = await det.detect(video);
      return r[0]?.rawValue ?? null;
    };
  } else {
    const z = await import('@zxing/library');
    const hints = new Map<unknown, unknown>([
      [z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13, z.BarcodeFormat.EAN_8, z.BarcodeFormat.UPC_A, z.BarcodeFormat.UPC_E]],
      [z.DecodeHintType.TRY_HARDER, true],
    ]);
    const reader = new z.MultiFormatReader();
    reader.setHints(hints as Map<import('@zxing/library').DecodeHintType, unknown>);
    const canvas = document.createElement('canvas');
    decodeFrame = async () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;
      // ลดขนาดให้ไม่เกิน 960 กว้าง เพื่อความเร็วบนมือถือ
      const scale = Math.min(1, 960 / w);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const bitmap = new z.BinaryBitmap(new z.HybridBinarizer(new z.HTMLCanvasElementLuminanceSource(canvas)));
      try {
        return reader.decode(bitmap).getText();
      } catch {
        return null; // ยังไม่พบบาร์โค้ดในเฟรมนี้
      }
    };
  }

  const tick = async () => {
    if (stopped) return;
    try {
      const raw = await decodeFrame();
      const code = raw ? normalizeBarcode(raw) : null;
      if (code) return finish(code);
    } catch {
      // เฟรมเสีย ข้ามไป
    }
    timer = window.setTimeout(tick, engine === 'native' ? 120 : 160);
  };
  timer = window.setTimeout(tick, 200);

  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
  return {
    engine,
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
    setTorch: caps.torch
      ? async (on: boolean) => {
          await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
        }
      : null,
  };
}
