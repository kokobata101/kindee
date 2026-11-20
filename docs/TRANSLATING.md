# การแปลภาษา · Translating KinDee

ตอนนี้รองรับ **ไทย** (ต้นฉบับ) และ **English** · Currently: Thai (source) and English.

## แก้คำแปลอังกฤษ / Fixing an English string

คำแปลอยู่ที่ `src/i18n/en.ts` เป็นคู่ `"ข้อความไทย": "English text"` แก้ฝั่งขวาได้เลย

```ts
"เพิ่มอาหาร": "Add food",
"บันทึก {count} รายการแล้ว": "Logged {count} {count?item:items}",
```

กติกา:

1. **คีย์ (ฝั่งซ้าย) ต้องตรงกับข้อความไทยในโค้ดทุกตัวอักษร** ห้ามแก้คีย์ถ้าไม่ได้แก้ข้อความไทยในโค้ดด้วย
2. **ตัวแปร `{ชื่อ}` ต้องมีครบเหมือนกัน** ทั้งสองฝั่ง (ลำดับในประโยคสลับได้)
3. **เอกพจน์/พหูพจน์**: `{n?คำเมื่อเป็น1:คำเมื่อไม่ใช่1}` เช่น `{n} {n?item:items}`
4. **หน่วยบริโภคของอาหาร** (คีย์เป็นแค่หน่วย เช่น `จาน`) ใช้รูป `"เอกพจน์|พหูพจน์"` เช่น `"plate|plates"`
5. คีย์ที่มีช่องว่างหน้า/หลัง (เช่น `" · อัตโนมัติ"`) เป็นชิ้นส่วนที่ต่อกับข้อความอื่น ให้คงช่องว่างเดิมไว้
6. ถ้าคำไทยเดียวกันแปลต่างกันตามบริบท ใช้ `tc('บริบท', 'ข้อความ')` แล้วเพิ่มคีย์ `"บริบท|ข้อความ"` (ตัวอย่างในโค้ด: `tc('age', 'ปี')` → `yrs`)
7. ใช้น้ำเสียงเรียบง่ายและเป็นกันเอง ข้อความสุขภาพห้ามฟังดูเป็นคำแนะนำทางการแพทย์ ตัวย่อให้สอดคล้องกัน (kcal, g, ml, kg)

## เพิ่มข้อความใหม่ในโค้ด / Adding a new string

```tsx
{t('ข้อความไทย')}
{t('เพิ่ม {n} รายการ', { n: items.length })}
aria-label={t('ลบ {name}', { name })}
```

- ใส่ตัวแปรผ่าน `{ }` อย่าต่อสตริงเอง เพราะลำดับคำอังกฤษต่างจากไทย
- ถ้าประโยคมี JSX แทรกกลาง (เช่น `<b>`) ให้แยกเป็นประโยคเต็มสองประโยค อย่าซอยเป็นชิ้นส่วนเล็ก ๆ
- **อย่าเก็บข้อความที่ `t()` แล้วลงฐานข้อมูล** เก็บเป็นไทยแล้วเรียก `t()` ตอนแสดงผล (ดู `docs/ARCHITECTURE.md`)

## ตรวจความครบถ้วน

```bash
node scripts/i18n-check.mjs          # รายงานข้อความที่ยังไม่มีคำแปล / ตัวแปรไม่ตรง / คำแปลที่ไม่ได้ใช้แล้ว
node scripts/i18n-check.mjs --list   # รายการข้อความทั้งหมดที่ต้องแปล (JSON)
npm test                             # tests/i18n.test.ts ตรวจสิ่งเดียวกัน
node e2e/run.mjs english             # เปิดแอปจริงเป็นภาษาอังกฤษ ตรวจว่าไม่มีตัวอักษรไทยหลงเหลือทุกหน้า
```

ชื่ออาหารตั้งต้นแปลจากคอลัมน์ชื่ออังกฤษใน `src/data/foods.ts` (ไม่ต้องใส่ใน `en.ts`)
ชื่ออาหาร/มื้อประจำที่ผู้ใช้ตั้งเองแสดงตามที่พิมพ์ ไม่ถูกแปล

## เพิ่มภาษาใหม่ / Adding a new language

ตอนนี้ระบบรองรับสองภาษา การเพิ่มภาษาที่สามต้องแก้เล็กน้อยใน `src/i18n/index.ts`:

1. เพิ่มรหัสภาษาใน `Lang` และ `LANGS` และสร้างพจนานุกรมใหม่ (เช่น `src/i18n/ja.ts`) ที่มีคีย์ครบเท่า `en.ts`
2. ทำให้ `translate()` เลือกพจนานุกรมตามภาษา และ `locale` ชี้ไปที่ locale ที่ถูกต้อง
3. ชื่ออาหาร: เพิ่มคอลัมน์ชื่อภาษานั้นใน `foods.ts` (ตอนนี้มีเฉพาะไทย/อังกฤษ) และปรับ `lib/names.ts`
4. ขยายสคริปต์ `scripts/i18n-lib.mjs` ให้ตรวจพจนานุกรมใหม่

เปิด issue คุยก่อนเริ่ม จะช่วยกันทำส่วนโครงสร้างให้ · Please open an issue first so we can help with the plumbing.

---

**English summary.** Translations live in `src/i18n/en.ts` as `"Thai source text": "English text"`. Keep the key identical to the Thai text in code,
keep all `{placeholders}`, and use `{n?one:many}` for plurals (`"singular|plural"` for food serving units). Wrap new UI text in `t('…')`
with placeholders instead of string concatenation. Never store translated text in the database. Run `node scripts/i18n-check.mjs`,
`npm test` and `node e2e/run.mjs english` before opening a PR.
