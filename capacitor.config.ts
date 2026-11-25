import type { CapacitorConfig } from '@capacitor/cli';

// ห่อรุ่น portable (ไม่มี service worker) เป็นแอป Android — ข้อมูลยังเก็บในเครื่องเหมือนเดิม
const config: CapacitorConfig = {
  appId: 'org.kindee.app',
  appName: 'กินดี',
  webDir: 'dist-portable',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
  experimental: { ios: { spm: { packageOptions: { '@capacitor-firebase/authentication': { symlink: true } } } } },
  // ล็อกอินเนทีฟสำหรับระบบสำรอง/ซิงก์ (ดู docs/CLOUD.md) ใช้ Firebase JS SDK ต่อ จึงข้ามการล็อกอินฝั่งเนทีฟ
  plugins: { FirebaseAuthentication: { skipNativeAuth: true, providers: ['google.com', 'facebook.com', 'apple.com'] } },
};
export default config;
