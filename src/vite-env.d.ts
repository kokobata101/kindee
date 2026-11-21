/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MEMORY_ROUTER?: string;
  /** รุ่นทดสอบ: ใช้หลังบ้านจำลองแทน Firebase (build ด้วย --mode cloudmock) */
  readonly VITE_CLOUD_MOCK?: string;
  /** ผู้ให้บริการที่เปิดปุ่มล็อกอิน เช่น "google,facebook,apple,line" */
  readonly VITE_CLOUD_PROVIDERS?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
