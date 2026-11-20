// รุ่น "เปิดด้วยดับเบิลคลิก" (file://) ไม่มี service worker
// ใช้แทน virtual:pwa-register เฉพาะตอน build ด้วย vite.portable.config.ts
export function registerSW(): () => Promise<void> {
  return async () => {};
}
