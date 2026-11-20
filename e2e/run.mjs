// ทดสอบแอปด้วยเบราว์เซอร์จริง (Playwright + Chromium) กับ build ที่ vite preview เปิดไว้
// ใช้: npm run build && (npx vite preview --port 4173 &) && node e2e/run.mjs [ชื่อสถานการณ์]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

// ใช้ playwright ที่ติดตั้งในโปรเจกต์ (npm install --no-save playwright && npx playwright install chromium)
// ถ้าไม่มี ลองตำแหน่งสำรองของเครื่องพัฒนาต้นทาง
const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    try {
      return createRequire('/opt/npm-tools/node_modules/playwright/index.js')('playwright');
    } catch {
      console.error('ไม่พบ playwright — ติดตั้งด้วย: npm install --no-save playwright && npx playwright install chromium');
      process.exit(2);
    }
  }
}
const { chromium } = loadPlaywright();

export const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
export const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

export async function launch({ launchArgs, ...opts } = {}) {
  const browser = await chromium.launch(launchArgs ? { args: launchArgs } : {});
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    serviceWorkers: 'block',
    ...opts,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  return { browser, ctx, page, errors };
}

export async function shot(page, name, full = true) {
  await page.waitForTimeout(250);
  // ซ่อน toast ชั่วคราวเพื่อดูเลย์เอาต์ (ข้อความ toast ถูกตรวจในสถานการณ์ทดสอบแล้ว)
  const h = await page.addStyleTag({ content: '.toasts{display:none!important}' });
  await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: full });
  await h.evaluate((el) => el.remove());
}

const scenario = process.argv[2];
if (scenario) {
  const mod = await import(`./scenarios/${scenario}.mjs`);
  const { browser, page, errors } = await launch(mod.options ?? {});
  let failed = false;
  try {
    await mod.default({ page, shot: (n, f) => shot(page, n, f), BASE });
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
    await shot(page, `${scenario}-FAIL`).catch(() => undefined);
  }
  // สถานการณ์ที่จำลองเครือข่ายล่ม/404 ตั้งใจ ระบุข้อความ console ที่ยอมรับได้ผ่าน export const ignoreConsole
  const real = errors.filter((e) => !(mod.ignoreConsole ?? []).some((re) => re.test(e)));
  if (real.length) {
    failed = true;
    console.error('Browser errors:\n' + real.join('\n'));
  }
  await browser.close();
  console.log(failed ? `✗ ${scenario}` : `✓ ${scenario}`);
  process.exit(failed ? 1 : 0);
}
