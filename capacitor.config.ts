import type { CapacitorConfig } from '@capacitor/cli';

// ห่อรุ่น portable (ไม่มี service worker) เป็นแอป Android — ข้อมูลยังเก็บในเครื่องเหมือนเดิม
const config: CapacitorConfig = {
  appId: 'org.kindee.app',
  appName: 'กินดี',
  webDir: 'dist-portable',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
};
export default config;
