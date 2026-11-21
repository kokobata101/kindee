// ล็อกอิน + ซิงก์ข้ามเครื่อง ด้วยเบราว์เซอร์จริง 2 เครื่อง (2 browser context = IndexedDB แยกกัน)
// ใช้รุ่น cloudmock: ปุ่มล็อกอินสร้างผู้ใช้ปลอม ส่วนที่เก็บข้อมูลคุยกับ "เซิร์ฟเวอร์ปลอม" ที่สคริปต์นี้ดักไว้ด้วย context.route
// ไม่ได้ทดสอบกับ Google/Facebook/Apple/LINE หรือ Firebase จริง (ทำไม่ได้ในเครื่องทดสอบนี้)
// รัน: npm run build:cloudmock && npx vite preview --outDir dist-cloudmock --port 4174 &
//      BASE_URL=http://localhost:4174/ node e2e/run.mjs cloud
import { strict as assert } from 'node:assert';
import { restoreSeed } from '../seed.mjs';

const MOCK = 'https://mock-cloud.invalid/';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/** เซิร์ฟเวอร์ปลอม: พฤติกรรมเดียวกับที่เก็บจริง (ตรวจ rev ก่อนเขียน → 409 ถ้าไม่ตรง) */
function makeServer() {
  const data = new Map(); // uid → { meta, payload }
  const log = [];
  return {
    data,
    log,
    rev: (uid) => data.get(uid)?.meta.rev ?? 0,
    async attach(ctx) {
      await ctx.route(`${MOCK}**`, async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const [action, uid] = url.pathname.split('/').filter(Boolean);
        const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        log.push(`${req.method()} ${action}`);
        const cur = data.get(uid);
        if (action === 'meta') return cur ? json(200, cur.meta) : route.fulfill({ status: 404, headers: CORS, body: '' });
        if (action === 'payload') return cur ? route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/plain' }, body: cur.payload }) : route.fulfill({ status: 404, headers: CORS, body: '' });
        if (action === 'remove') {
          data.delete(uid);
          return json(200, {});
        }
        if (action === 'put') {
          const a = JSON.parse(req.postData());
          if ((cur?.meta.rev ?? 0) !== a.expectedRev) return json(409, { rev: cur?.meta.rev ?? 0 });
          const meta = { rev: (cur?.meta.rev ?? 0) + 1, updatedAt: Date.now(), deviceId: a.deviceId, encrypted: a.encrypted, chunkCount: 1, hash: a.hash, size: a.payload.length };
          data.set(uid, { meta, payload: a.payload });
          return json(200, meta);
        }
        return json(404, {});
      });
    },
  };
}

async function until(fn, what, ms = 20000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try {
      last = await fn();
      if (last) return last;
    } catch {
      /* ลองใหม่ */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`รอไม่ทัน: ${what}`);
}

const status = (p) => p.getByTestId('sync-status').innerText();
async function waitSynced(p) {
  await until(async () => /ซิงก์ล่าสุด/.test(await status(p)), 'สถานะ "ซิงก์ล่าสุด"');
}
const water = async (p) => {
  await p.goto(p.url().split('#')[0] + '#/water');
  const el = p.getByTestId('water-liters');
  await el.waitFor();
  // ค่าแรกที่วาดอาจเป็น 0 ก่อนฐานข้อมูลตอบ (live query) จึงอ่านซ้ำจนนิ่ง
  let prev = (await el.innerText()).trim();
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(250);
    const cur = (await el.innerText()).trim();
    if (cur === prev) return cur;
    prev = cur;
  }
  return prev;
};
async function openAccount(p) {
  await p.goto(p.url().split('#')[0] + '#/account');
}

// เซิร์ฟเวอร์จำลองตอบ 404 ตั้งใจ เมื่อยังไม่มีข้อมูลสำรอง (เบราว์เซอร์บันทึกเป็น console error)
export const ignoreConsole = [/Failed to load resource: the server responded with a status of 404/];

export default async function ({ page: A, shot, BASE }) {
  const server = makeServer();
  await server.attach(A.context());
  const browser = A.context().browser();
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
    await server.attach(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('B pageerror:', e.message));
    return { ctx, page };
  };

  // ───── เครื่อง A: มีข้อมูลอยู่แล้ว (ข้อมูลจำลอง 14 วัน) → ไปหน้าบัญชีจากเมนู "ฉัน" ─────
  await restoreSeed(A, BASE);
  await A.getByRole('link', { name: 'ฉัน' }).click();
  await A.getByRole('button', { name: /^บัญชีและซิงก์ข้ามเครื่อง/ }).click();
  await A.getByRole('heading', { name: 'ล็อกอินเพื่อสำรองและใช้ข้ามเครื่อง' }).waitFor();
  for (const n of ['Google', 'Facebook', 'Apple', 'LINE']) {
    assert(await A.getByRole('button', { name: `ดำเนินการต่อด้วย ${n}` }).isVisible(), `ต้องมีปุ่ม ${n}`);
  }
  await shot('70-account-signed-out');

  await A.getByRole('button', { name: 'ดำเนินการต่อด้วย Google' }).click();
  await A.getByTestId('acct-name').waitFor();
  await waitSynced(A);
  assert.equal((await A.getByTestId('sync-rev').innerText()).trim(), 'ข้อมูลสำรองรุ่นที่ 1');
  assert.equal(server.rev('mock-google'), 1, 'ต้องอัปโหลดรุ่นที่ 1 ขึ้นเซิร์ฟเวอร์');
  await shot('71-account-signed-in');
  const waterA0 = await water(A);

  // ───── เครื่อง B: เปล่า → ล็อกอินบัญชีเดียวกัน → ได้ข้อมูลลงมาเอง ─────
  const { ctx: ctxB, page: B } = await mk();
  await B.goto(BASE);
  await B.getByText('นับแคลอรี่ง่ายๆ').waitFor();
  await B.getByRole('button', { name: 'เข้าสู่ระบบเพื่อดึงข้อมูลจากคลาวด์' }).click();
  await B.getByRole('button', { name: 'ดำเนินการต่อด้วย Google' }).click();
  await B.getByTestId('acct-name').waitFor({ timeout: 20000 }); // โปรไฟล์ลงมาแล้ว → หน้าเปลี่ยนเป็นแบบล็อกอินแล้ว
  await waitSynced(B);
  assert.equal(await water(B), waterA0, 'น้ำของเครื่อง B ต้องตรงกับ A หลังดึงข้อมูล');
  await B.goto(BASE);
  await B.getByText('คำแนะนำวันนี้').waitFor();
  assert.equal((await B.getByTestId('remaining').innerText()).trim(), (await (async () => { await A.goto(BASE); await A.getByText('คำแนะนำวันนี้').waitFor(); return A.getByTestId('remaining').innerText(); })()).trim(), 'แคลอรี่คงเหลือต้องเท่ากันทั้งสองเครื่อง');
  await shot('72-device-b-restored');

  // ───── ซิงก์อัตโนมัติ: A เพิ่มน้ำ → ขึ้นเซิร์ฟเวอร์เอง → B กด "ซิงก์ตอนนี้" ได้ค่าใหม่ ─────
  await A.goto(BASE + '#/water');
  await A.getByRole('button', { name: 'เพิ่มน้ำ 250 มิลลิลิตร' }).click();
  await until(() => server.rev('mock-google') === 2, 'ซิงก์อัตโนมัติรุ่นที่ 2 (ดีเลย์ราว 8 วินาที)', 30000);
  const waterA1 = await water(A);
  assert.notEqual(waterA1, waterA0);
  await openAccount(B);
  await B.getByRole('button', { name: 'ซิงก์ตอนนี้' }).click();
  await until(async () => (await B.getByTestId('sync-rev').innerText()).includes('รุ่นที่ 2'), 'B ได้รุ่นที่ 2');
  // ป้ายรุ่นแสดงตอนรู้เลขรุ่นบนคลาวด์ ก่อนดึงข้อมูลเสร็จ จึงรอจนข้อมูลลงเครื่องจริง
  await until(async () => (await water(B)) === waterA1, 'B ต้องได้ปริมาณน้ำล่าสุดจาก A');

  // ───── สองเครื่องแก้พร้อมกัน → ต้องหยุดถาม ไม่ทับเงียบๆ ─────
  for (const p of [A, B]) {
    await openAccount(p);
    await p.getByRole('switch', { name: 'ซิงก์อัตโนมัติ' }).click(); // ปิดเพื่อควบคุมจังหวะเอง
    assert.equal(await p.getByRole('switch', { name: 'ซิงก์อัตโนมัติ' }).getAttribute('aria-checked'), 'false');
  }
  await A.goto(BASE + '#/water');
  await A.getByRole('button', { name: 'เพิ่มน้ำ 150 มิลลิลิตร' }).click();
  const waterA2 = await water(A);
  await openAccount(A);
  await A.getByRole('button', { name: 'ซิงก์ตอนนี้' }).click();
  await until(() => server.rev('mock-google') === 3, 'A อัปโหลดรุ่นที่ 3');

  await B.goto(BASE + '#/water');
  await B.getByRole('button', { name: 'เพิ่มน้ำ 500 มิลลิลิตร' }).click();
  const waterB2 = await water(B);
  assert.notEqual(waterA2, waterB2);
  await openAccount(B);
  await B.getByRole('button', { name: 'ซิงก์ตอนนี้' }).click();
  await B.getByRole('heading', { name: 'ข้อมูลสองฝั่งไม่ตรงกัน' }).waitFor();
  assert.equal(server.rev('mock-google'), 3, 'ระหว่างรอเลือก ห้ามเขียนทับคลาวด์');
  assert.equal(await water(B), waterB2, 'ระหว่างรอเลือก ข้อมูลเครื่อง B ต้องไม่เปลี่ยน');
  await openAccount(B);
  await B.getByRole('heading', { name: 'ข้อมูลสองฝั่งไม่ตรงกัน' }).waitFor();
  await shot('73-conflict');

  // เลือกใช้ข้อมูลเครื่อง B (ทับคลาวด์) → รุ่น 4 → A ดึงไปได้
  await B.getByRole('button', { name: 'ใช้ข้อมูลเครื่องนี้ (ทับคลาวด์)' }).click();
  await B.getByRole('button', { name: 'ใช้ข้อมูลเครื่องนี้', exact: true }).click();
  await until(() => server.rev('mock-google') === 4, 'B ทับคลาวด์เป็นรุ่นที่ 4');
  await openAccount(A);
  await A.getByRole('button', { name: 'ซิงก์ตอนนี้' }).click();
  await until(async () => (await A.getByTestId('sync-rev').innerText()).includes('รุ่นที่ 4'), 'A ได้รุ่นที่ 4');
  assert.equal(await water(A), waterB2, 'A ต้องได้ข้อมูลของ B หลังแก้ conflict');

  // ───── เข้ารหัสด้วยรหัสผ่าน: เครื่องอื่นต้องใส่รหัสถึงจะเปิดได้ ─────
  await openAccount(A);
  await A.getByRole('switch', { name: 'เข้ารหัสด้วยรหัสผ่านของฉัน' }).click();
  await A.getByRole('textbox', { name: 'รหัสผ่านเข้ารหัส', exact: true }).fill('short');
  await A.getByRole('textbox', { name: 'ยืนยันรหัสผ่าน', exact: true }).fill('short');
  await A.getByRole('button', { name: 'เปิดการเข้ารหัส' }).click();
  assert(await A.getByText('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร').first().isVisible(), 'รหัสสั้นต้องถูกปฏิเสธ');
  await A.getByRole('textbox', { name: 'รหัสผ่านเข้ารหัส', exact: true }).fill('correct-horse-9');
  await A.getByRole('textbox', { name: 'ยืนยันรหัสผ่าน', exact: true }).fill('different-horse-9');
  await A.getByRole('button', { name: 'เปิดการเข้ารหัส' }).click();
  assert(await A.getByText('รหัสผ่านสองช่องไม่ตรงกัน').isVisible(), 'รหัสไม่ตรงกันต้องถูกปฏิเสธ');
  await A.getByRole('textbox', { name: 'ยืนยันรหัสผ่าน', exact: true }).fill('correct-horse-9');
  await A.getByRole('button', { name: 'เปิดการเข้ารหัส' }).click();
  await until(() => server.data.get('mock-google')?.meta.encrypted === true, 'อัปโหลดแบบเข้ารหัส');
  assert.equal(server.rev('mock-google'), 5);
  const raw = server.data.get('mock-google').payload;
  assert(!Buffer.from(raw, 'base64url').toString('latin1').includes('มะนาว'), 'ข้อมูลบนคลาวด์ต้องอ่านไม่ออก');
  assert.equal(await A.getByRole('switch', { name: 'เข้ารหัสด้วยรหัสผ่านของฉัน' }).getAttribute('aria-checked'), 'true');

  // B โหลดหน้าใหม่ (รหัสในหน่วยความจำหาย) → ต้องถูกล็อกจนกว่าจะใส่รหัสถูก และข้อมูลไม่เปลี่ยนระหว่างนั้น
  await B.goto(BASE);
  await openAccount(B);
  await B.getByRole('button', { name: 'ซิงก์ตอนนี้' }).click();
  await B.getByRole('heading', { name: 'ใส่รหัสผ่านเข้ารหัส' }).waitFor({ timeout: 8000 }).catch(async (e) => { console.log('DEBUG', (await B.locator('main').innerText()).slice(0, 900)); throw e; });
  await shot('74-locked');
  const beforeWrong = await water(B);
  await openAccount(B);
  await B.getByRole('textbox', { name: 'รหัสผ่านเข้ารหัส', exact: true }).fill('wrong-passphrase');
  await B.getByRole('button', { name: 'ปลดล็อกและซิงก์' }).click();
  await B.getByTestId('sync-error').waitFor();
  assert.equal(await water(B), beforeWrong, 'รหัสผิดต้องไม่ทำให้ข้อมูลเปลี่ยน');
  await openAccount(B);
  await B.getByRole('textbox', { name: 'รหัสผ่านเข้ารหัส', exact: true }).fill('correct-horse-9');
  await B.getByRole('button', { name: 'ปลดล็อกและซิงก์' }).click();
  await until(async () => (await B.getByTestId('sync-rev').innerText()).includes('รุ่นที่ 5'), 'B ถอดรหัสแล้วได้รุ่นที่ 5');

  // ───── ออกจากระบบ: ข้อมูลในเครื่องยังอยู่ ─────
  await B.getByText('ออกจากระบบ', { exact: true }).click();
  await B.getByRole('heading', { name: 'ล็อกอินเพื่อสำรองและใช้ข้ามเครื่อง' }).waitFor();
  await B.goto(BASE);
  await B.getByText('คำแนะนำวันนี้').waitFor();

  // ───── ลบข้อมูลบนคลาวด์: เซิร์ฟเวอร์ว่าง ข้อมูลในเครื่องอยู่ ─────
  await openAccount(A);
  await A.getByText('ลบข้อมูลสำรองบนคลาวด์', { exact: true }).click();
  await A.getByRole('button', { name: 'ลบบนคลาวด์' }).click();
  await until(() => server.rev('mock-google') === 0, 'ข้อมูลบนเซิร์ฟเวอร์ถูกลบ');
  assert.equal(await A.getByRole('switch', { name: 'ซิงก์อัตโนมัติ' }).getAttribute('aria-checked'), 'false');
  await A.goto(BASE);
  await A.getByText('คำแนะนำวันนี้').waitFor();
  await shot('75-after-delete');

  await ctxB.close();
}
