# เผยแพร่เป็นเว็บแอป (ติดตั้งลงมือถือได้ ทั้ง Android และ iPhone)

วิธีนี้ฟรีและง่ายที่สุด ไม่ต้องมี Mac ไม่ต้องสร้าง APK

1. สร้าง repository บน GitHub แล้วอัปโหลดโปรเจกต์นี้ขึ้นสาขา `main`
2. ไปที่ **Settings > Pages > Build and deployment > Source** เลือก **GitHub Actions**
3. รอ workflow **Deploy to GitHub Pages** ทำงานจนเสร็จ (แท็บ Actions ประมาณ 2–3 นาที)
4. เปิด `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/` บนมือถือ
   - Android (Chrome): เมนู ⋮ > **ติดตั้งแอป**
   - iPhone (Safari): ปุ่มแชร์ > **เพิ่มไปยังหน้าจอโฮม**

แอปใช้ HashRouter และ `base: './'` จึงทำงานใต้ path ย่อยของ GitHub Pages ได้ทันที ข้อมูลอยู่ในเครื่องของแต่ละคนเท่านั้น
ผู้ใช้ iPhone ควรกด ตั้งค่า > สำรองข้อมูล เป็นประจำ เพราะ iOS อาจลบข้อมูลเว็บแอปที่ไม่ได้เปิดนาน
