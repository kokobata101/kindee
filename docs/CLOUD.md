# ล็อกอิน + สำรอง/ซิงก์ข้ามเครื่อง (ตัวเลือกเสริม)

ค่าเริ่มต้นของกินดีคือ **ไม่มีบัญชี ไม่มีเซิร์ฟเวอร์** ข้อมูลอยู่ในเครื่อง ฟีเจอร์นี้เปิดเมื่อ *เจ้าของเว็บที่โฮสต์แอป* ตั้งค่า Firebase ตอน build เท่านั้น ถ้าไม่ตั้งค่า หน้า "บัญชีและซิงก์ข้ามเครื่อง" จะบอกว่ายังไม่เปิดใช้ และทุกอย่างทำงานเหมือนเดิม

## ทำงานอย่างไร
- ล็อกอินด้วย Google / Facebook / Apple / LINE ผ่าน Firebase Authentication
- สำรองทั้งก้อนเป็นสแนปช็อต (ไม่ merge รายรายการ) เก็บที่ Firestore `users/{uid}/backup/*` ตัดเป็นก้อนละ ~700 KB
- มีเลขรุ่น (rev) กันเครื่องหนึ่งเขียนทับอีกเครื่องเงียบๆ ถ้าสองเครื่องแก้พร้อมกันจะถามให้เลือกว่าจะใช้ฝั่งไหน
- เลือกเข้ารหัสด้วยรหัสผ่านได้ (PBKDF2 + AES-256-GCM เหมือนลิงก์แชร์) รหัสผ่านไม่ถูกส่งหรือเก็บถาวร ลืมแล้วกู้ไม่ได้
- ลบข้อมูลบนคลาวด์/ลบบัญชีได้จากหน้าเดียวกัน
- **แอปมือถือ (iOS/Android):** ล็อกอินที่ฝั่งเนทีฟด้วยปลั๊กอิน `@capacitor-firebase/authentication` แล้วส่ง token เข้า Firebase เดิม (ดูหัวข้อ "แอปมือถือ" ด้านล่าง ต้องตั้งค่าเพิ่ม)
- **ไฟล์ file:// (เปิดแบบดับเบิลคลิก)** ไม่รองรับ ให้ใช้ไฟล์สำรองแทน

## ตั้งค่า (เจ้าของเว็บ)
1. สร้างโปรเจกต์ที่ https://console.firebase.google.com เปิด **Authentication** และ **Firestore** (โหมด production)
2. วางกฎจาก `firestore.rules` (เจ้าของข้อมูลเท่านั้นอ่าน/เขียนได้)
3. Authentication → Settings → Authorized domains: เพิ่มโดเมนเว็บของคุณ (เช่น `ชื่อ.github.io`)
4. เปิดผู้ให้บริการที่ต้องการ:
   | ผู้ให้บริการ | สิ่งที่ต้องมี |
   |---|---|
   | Google | เปิดได้เลยในคอนโซล |
   | Facebook | สร้างแอปที่ developers.facebook.com ใส่ App ID/Secret · ถ้าให้คนทั่วไปใช้ต้องผ่านการตรวจแอป (App Review) |
   | Apple | ต้องมีบัญชี Apple Developer แบบเสียเงิน (Services ID, Key) |
   | LINE | ใช้ผ่าน OpenID Connect ของ Identity Platform (ต้องอัปเกรดเป็น Identity Platform ซึ่งผูกบัญชีเรียกเก็บเงิน) ตั้งชื่อผู้ให้บริการเป็น `oidc.line` ใช้ LINE Login channel ของ LINE Developers |
5. ตั้งตัวแปรที่ GitHub: Settings → Secrets and variables → Actions → **Variables**
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_CLOUD_PROVIDERS` (เช่น `google,facebook,apple,line`)
6. รัน workflow "Deploy to GitHub Pages" ใหม่

รันเองในเครื่อง: ใส่ค่าเดียวกันในไฟล์ `.env.local` แล้ว `npm run build`

## แอปมือถือ (iOS / Android)
หน้าต่างล็อกอินของเว็บใช้ใน WebView ไม่ได้ แอปมือถือจึงเรียกล็อกอินของระบบ (Google/Facebook/Apple) หรือเบราว์เซอร์ของระบบ (LINE ผ่าน OIDC) แล้วเอา token มาเข้า Firebase ตัวเดียวกับที่ใช้ซิงก์ ข้อมูลสำรองจึงใช้ร่วมกับเว็บได้

ต้องทำทั้งหมดนี้ (ไม่ตั้ง = แอปไม่มีปุ่มล็อกอิน ที่เหลือใช้ได้ตามปกติ):
1. **ตั้งค่า build:** ใส่ `VITE_FIREBASE_*` และ `VITE_CLOUD_PROVIDERS` ตอน build แอป (workflow Android/iOS อ่านจาก Repository variables ชุดเดียวกับเว็บ) หรือใส่ใน `.env.local` แล้ว `npm run ios:open` / `npm run android:open`
2. **Firebase console → Project settings → Your apps:** เพิ่มแอป iOS (Bundle ID `org.kindee.app` หรือที่คุณเปลี่ยน) และแอป Android (package `org.kindee.app`)
3. **Android:** วาง `google-services.json` ที่ `android/app/` และเพิ่มลายนิ้วมือ SHA-1 ของคีย์ที่ใช้เซ็นแอปใน Firebase (ไม่งั้น Google ล็อกอินไม่ได้) ถ้าลง Google Play ให้เพิ่ม SHA-1 ของ Play app signing ด้วย
4. **iOS:** วาง `GoogleService-Info.plist` ที่ `ios/App/App/` (ลากเข้า Xcode ติ๊ก Copy items และ target App) แล้วใน Xcode → target App → Info → URL Types เพิ่ม 1 แถว ใส่ค่า `REVERSED_CLIENT_ID` จากไฟล์นั้นในช่อง URL Schemes
5. **Google:** เปิด provider ใน Firebase Authentication (ทำแล้วจากหัวข้อตั้งค่าด้านบน)
6. **Facebook:** แก้ 3 ค่าใน `android/app/src/main/res/values/strings.xml` (`facebook_app_id`, `fb_login_protocol_scheme` = `fb` + App ID, `facebook_client_token`) ส่วน iOS เพิ่มใน `Info.plist`: `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`, URL Type scheme `fb<AppID>` และ `LSApplicationQueriesSchemes` = `fbapi`, `fb-messenger-share-api`, `fbauth2`, `fbshareextension` (โค้ดเริ่ม Facebook SDK ทำงานเมื่อมี `FacebookAppID` แล้วเท่านั้น) และเพิ่ม redirect URI ของ Firebase ในแอป Facebook
7. **Apple (iOS):** Xcode → Signing & Capabilities → **+ Capability → Sign in with Apple** (ต้องใช้บัญชี Apple Developer แบบเสียเงินจึงเปิดได้) และเปิด provider Apple ใน Firebase
8. **LINE:** ใช้ OIDC ผ่านเบราว์เซอร์ของระบบ ต้องตั้ง provider `oidc.line` ใน Firebase ตามหัวข้อด้านบน และเพิ่ม URL Scheme ของ `REVERSED_CLIENT_ID` (ข้อ 4) ให้ครบ

คู่มือละเอียดของปลั๊กอิน: https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/authentication/docs

ข้อควรรู้: ข้อ 6 อาจต้องเปิด App Tracking Transparency (`NSUserTrackingUsageDescription`) ตามข้อกำหนดของ Facebook SDK และ Apple App Review มีกฎว่าแอปที่มีล็อกอินโซเชียลต้องมี Sign in with Apple ด้วยถ้าจะขึ้น App Store

## ความเป็นส่วนตัว (ควรบอกผู้ใช้ตามจริง)
เมื่อผู้ใช้เปิดสำรอง ข้อมูลสุขภาพจะอยู่บนโปรเจกต์ Firebase ของเจ้าของเว็บ ซึ่งเจ้าของอ่านได้ถ้าไม่ได้เข้ารหัส แนะนำให้เปิดการเข้ารหัสด้วยรหัสผ่าน และเจ้าของเว็บควรมีนโยบายความเป็นส่วนตัวของตน

## สถานะการทดสอบ
- ทดสอบอัตโนมัติ: ตรรกะตัดสินซิงก์ (อัปโหลด/ดึง/ขัดแย้ง), ตัดก้อน, เข้ารหัส/รหัสผิด, ตรวจเลขรุ่น, และ e2e ด้วยเบราว์เซอร์จริง 2 เครื่องกับเซิร์ฟเวอร์จำลอง (`npm run build:cloudmock`, `e2e/scenarios/cloud.mjs`)
- **ล็อกอินเนทีฟบนมือถือ (iOS/Android) ยังไม่เคยรันบนอุปกรณ์จริง** ทดสอบได้แค่ว่าโปรเจกต์คอมไพล์ผ่านบน GitHub (ไม่ได้ใส่ไฟล์ Firebase) โดยเฉพาะ LINE และ Facebook บน iOS มีโอกาสต้องปรับเพิ่มตอนลองจริง
- **ยังไม่เคยทดสอบกับ Firebase จริง และไม่เคยล็อกอินด้วย Google/Facebook/Apple/LINE จริง** (เครื่องพัฒนาออกเน็ตภายนอกไม่ได้) ควรลองทั้ง 4 ผู้ให้บริการหลังตั้งค่าแล้ว
