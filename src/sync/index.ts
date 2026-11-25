import { Capacitor } from '@capacitor/core';
import { ALL_PROVIDERS, type CloudBackend, type ProviderId } from './types';

/** ผู้ให้บริการล็อกอินที่เจ้าของเว็บเปิดไว้ (VITE_CLOUD_PROVIDERS="google,facebook,apple,line") ค่าเริ่มต้น: google */
export function configuredProviders(): ProviderId[] {
  const raw = String(import.meta.env.VITE_CLOUD_PROVIDERS ?? 'google');
  const list = raw.split(',').map((s) => s.trim()) as ProviderId[];
  const ok = ALL_PROVIDERS.filter((p) => list.includes(p));
  return ok.length ? ok : ['google'];
}

/**
 * ระบบล็อกอิน/ซิงก์ใช้ได้เมื่อ: ตั้งค่า Firebase ไว้ตอน build (หรือเป็นรุ่นทดสอบ cloudmock)
 * และรันบนเว็บ http(s) หรือแอปมือถือ (Capacitor ใช้ล็อกอินเนทีฟ) — ไฟล์ file:// ไม่รองรับ
 */
export function cloudSupported(): boolean {
  if (!import.meta.env.VITE_CLOUD_MOCK && !import.meta.env.VITE_FIREBASE_API_KEY) return false;
  try {
    // แอปมือถือ: ล็อกอินผ่านปลั๊กอินเนทีฟ (ไม่ต้องใช้ http(s))
    if (Capacitor.isNativePlatform()) return !import.meta.env.VITE_CLOUD_MOCK;
  } catch {
    /* ไม่มี Capacitor = เว็บ */
  }
  return typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
}

export async function loadBackend(): Promise<CloudBackend | null> {
  if (!cloudSupported()) return null;
  // เงื่อนไขอ่านจากตัวแปร build โดยตรง เพื่อให้ตัวที่ไม่ใช้ถูกตัดทิ้งจากไฟล์ที่ปล่อยจริง
  if (import.meta.env.VITE_CLOUD_MOCK) {
    const m = await import('./mock');
    return m.createMockBackend(configuredProviders());
  }
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    const m = await import('./firebase');
    return m.createFirebaseBackend(
      {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      },
      configuredProviders(),
    );
  }
  return null;
}
