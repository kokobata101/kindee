import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// รุ่น portable: เปิดได้ด้วยการดับเบิลคลิก index.html (โปรโตคอล file://) ไม่ต้องมีเซิร์ฟเวอร์
// - เบราว์เซอร์บล็อก <script type="module"> จาก file:// จึง build เป็นสคริปต์ปกติ (iife) ไฟล์เดียว
// - ไม่มี service worker/PWA (ติดตั้งลงหน้าจอไม่ได้ ต้องใช้รุ่นเว็บปกติ)
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register': fileURLToPath(new URL('./src/portable/pwa-register-stub.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-portable',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
