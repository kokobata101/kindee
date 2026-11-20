import { defineConfig, mergeConfig } from 'vite';
import portable from './vite.portable.config';

// รุ่น embed: ไฟล์เดียวแบบพกพา + MemoryRouter สำหรับฝังในหน้าเว็บ (เช่น Artifact)
export default mergeConfig(
  portable,
  defineConfig({
    define: { 'import.meta.env.VITE_MEMORY_ROUTER': '"1"' },
    build: { outDir: 'dist-embed' },
  }),
);
