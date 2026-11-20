# สถาปัตยกรรม (Architecture)

ภาพรวมสำหรับคนที่จะเริ่มแก้โค้ด · English summary at the bottom.

## หลักการ

- **เว็บแอปฝั่งไคลเอนต์ล้วน** (React 19 + TypeScript strict + Vite) ไม่มีเซิร์ฟเวอร์ ไม่มีบัญชีผู้ใช้
- **ข้อมูลอยู่ใน IndexedDB** ผ่าน Dexie แอปทำงานออฟไลน์ (PWA, service worker)
- **ตรรกะคำนวณเป็นฟังก์ชันล้วน** ใน `src/lib/` แยกจาก UI → เทสต์ได้โดยไม่ต้องเปิดเบราว์เซอร์
- **ภาษาต้นฉบับคือไทย** ข้อความทุกจุดผ่าน `t('…')` แล้วแปลเป็นอังกฤษจากพจนานุกรม

## โครงสร้างโฟลเดอร์

```
src/
  app/        context (toast/confirm/โปรไฟล์), hooks, meta (ชื่อแอป/เวอร์ชัน/สัญญาอนุญาต)
  data/       foods.ts — ฐานข้อมูลอาหารตั้งต้น (ข้อมูลล้วน)
  db/         db.ts (สคีมา Dexie + เวอร์ชัน), repo.ts (การอ่าน/เขียนทั้งหมด), backup.ts (JSON/CSV),
              scheduler.ts (รันรายการตั้งเวลา), off.ts (Open Food Facts), types.ts
  lib/        ตรรกะล้วน: nutrition (BMR/TDEE/เป้า), diary, stats, goals, weight, activities,
              rewards/streak, barcode/scanner, share (ลิงก์ QR + เข้ารหัส), combo, quick, validate,
              date, names (ชื่ออาหารตามภาษา)
  i18n/       index.ts (t / tc / setLang), en.ts (พจนานุกรมอังกฤษ)
  screens/    หน้าจอ (หนึ่งไฟล์ต่อหน้า) ผูก hooks + repo + ui
  ui/         คอมโพเนนต์ที่ใช้ซ้ำ (kit.tsx, FoodPicker, Combos, QuickAdd, charts, ReportView …)
  styles/     app.css (ตัวแปรสี/สเปซ ธีมสว่าง-มืด)
tests/        vitest (unit + ฐานข้อมูลด้วย fake-indexeddb)
e2e/          Playwright: scenarios/*.mjs เปิดแอปจริงแล้วกดจริง
scripts/      make-portable.mjs, food-check.mjs (ตรวจค่าอาหาร), i18n-check.mjs (ตรวจคำแปล)
```

## ทางไหลของข้อมูล

```
ผู้ใช้กดปุ่ม → screens/*.tsx → db/repo.ts (เขียน, มี transaction) → IndexedDB
                     ↑                                                  │
                     └──── useLiveQuery (dexie-react-hooks) ◄───────────┘  อ่านแล้วอัปเดตหน้าจออัตโนมัติ
```

- หน้าจออ่านด้วย `useLiveQuery` (เป็นแบบอะซิงโครนัส ข้อมูลมาทีหลังเรนเดอร์แรก — เทสต์ต้องรอ)
- **เขียนผ่าน `repo.ts` เท่านั้น** ฟังก์ชันที่แตะหลายตารางใช้ `db.transaction`
- ไดอารี่เก็บ **สำเนาค่าอาหาร ณ ตอนบันทึก** (`Entry.unit`, `kcal` …) แก้/ลบอาหารต้นทางภายหลังจึงไม่กระทบประวัติ มื้อประจำ (`Combo`) และรายการตั้งเวลา (`Schedule`) ก็เก็บสำเนาเช่นกัน
- วันเก็บเป็นสตริง `YYYY-MM-DD` เวลาท้องถิ่นของเครื่อง (`lib/date.ts`)

## การเปลี่ยนโครงสร้างข้อมูล (migration)

1. เพิ่ม `this.version(N+1).stores({...})` ใน `db/db.ts` (ห้ามแก้เวอร์ชันเก่า)
2. อัปเดต `db/backup.ts`: ตารางใหม่เป็น "optional" ตอนกู้คืนเพื่อให้ไฟล์สำรองรุ่นเก่ายังใช้ได้ และตรวจรูปแบบข้อมูลที่เข้ามา (ไฟล์สำรองมาจากผู้ใช้ ห้ามเชื่อ)
3. เขียนเทสต์ upgrade v(N)→v(N+1) และเทสต์กู้คืนไฟล์รุ่นเก่า (ดูตัวอย่างใน `tests/combos-repo.test.ts`)

## ระบบแปลภาษา

- `t('ข้อความไทย {ตัวแปร}', { ตัวแปร })` · ภาษาไทยคืนข้อความเดิม ภาษาอังกฤษค้นจาก `i18n/en.ts` ไม่พบก็คืนไทย
- ภาษาถูกกำหนดตอนโหลดหน้า (จาก `localStorage` แล้วค่อยดูภาษาเบราว์เซอร์) การสลับภาษาจึงโหลดหน้าใหม่ — ค่าคงที่ระดับโมดูลที่เรียก `t()` จึงใช้ได้ปกติ
- **ข้อมูลที่เก็บลงฐานข้อมูลเก็บเป็นไทย (ต้นฉบับ) แล้วแปลตอนแสดงผล** เช่น ชื่อกิจกรรม ชื่อ "แคลอรี่ด่วน" หน่วยบริโภค — ดู `lib/names.ts` (`foodName`, `unitLabel`) อย่าเก็บข้อความที่แปลแล้วลงฐานข้อมูล
- ข้อความมีรูปเอกพจน์/พหูพจน์: `"{n} {n?item:items}"`

## ข้อจำกัดของเว็บที่ควรรู้ก่อนออกแบบฟีเจอร์

- ทำงานเบื้องหลังตอนปิดแอปไม่ได้ (รายการตั้งเวลารันตอนเปิดแอป)
- กล้อง/ติดตั้ง PWA ต้องใช้ HTTPS (หรือ localhost) · เปิดแบบดับเบิลคลิก `file://` ได้ แต่ไม่มี service worker
- Health Connect / Apple Health เข้าถึงจากเว็บไม่ได้ (ต้องห่อเป็นแอปเนทีฟ)

---

## English summary

KinDee is a client-only React 19 + TypeScript (strict) + Vite PWA. All data lives in IndexedDB (Dexie). Pure logic is in `src/lib/`
(unit-testable), screens in `src/screens/`, reusable UI in `src/ui/`, and **every write goes through `src/db/repo.ts`**
(transactions for multi-table writes). Diary entries, saved meals and schedules store a **snapshot** of nutrition values so later
edits to a food don't rewrite history. Schema changes need a new Dexie version, a backward-compatible backup importer and an upgrade
test. UI text is Thai-as-key: `t('ไทย {x}', { x })`, translated through `src/i18n/en.ts`; the language is fixed at page load (switching
reloads the page). Data persisted to the database stays in Thai and is translated at display time (`src/lib/names.ts`).
