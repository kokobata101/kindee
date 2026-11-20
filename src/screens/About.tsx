import { Code2, Heart, ShieldCheck } from 'lucide-react';
import { Header } from '../ui/kit';
import { APP_NAME, APP_NAME_EN, APP_VERSION, LICENSE_NAME } from '../app/meta';
import { ACTIVITY_LEVELS } from '../lib/nutrition';

import { t } from '../i18n';
export default function About() {
  return (
    <>
      <Header title={t('เกี่ยวกับกินดี')} />
      <main className="screen no-tabs">
        <section className="hero col gap8">
          <span className="h2">{APP_NAME} · {APP_NAME_EN}</span>
          <span style={{ opacity: 0.78 }}>{t('เวอร์ชัน {APP_VERSION} · {LICENSE_NAME}', { APP_VERSION, LICENSE_NAME })}</span>
          <span style={{ opacity: 0.78 }}>{t('แอปนับแคลอรี่สำหรับคนไทย ใช้ฟรี 100% ไม่มีโฆษณา ไม่มีการจ่ายเงินเพื่อปลดล็อกฟีเจอร์')}</span>
        </section>

        <section className="card card-pad col gap8">
          <h2 className="h3"><ShieldCheck size={18} style={{ verticalAlign: '-3px' }} />{' '}{t('ความเป็นส่วนตัว')}</h2>
          <p className="body-m t2">{t('ข้อมูลทั้งหมด (โปรไฟล์ อาหาร น้ำหนัก กิจกรรม) เก็บใน IndexedDB ของเบราว์เซอร์ในเครื่องคุณ ไม่มีบัญชีผู้ใช้ ไม่มีเซิร์ฟเวอร์ ไม่มีการติดตามหรือส่งข้อมูลออกไปที่ใด การแชร์รายงานทำเมื่อคุณสั่งเท่านั้น และข้อมูลอยู่ในตัวลิงก์')}</p>
        </section>

        <section className="card card-pad col gap8">
          <h2 className="h3"><Code2 size={18} style={{ verticalAlign: '-3px' }} />{' '}{t('โอเพนซอร์ส')}</h2>
          <p className="body-m t2">{t('เผยแพร่ภายใต้สัญญาอนุญาต GNU GPL v3 หรือใหม่กว่า คุณใช้ แก้ไข และแจกจ่ายต่อได้ โดยงานดัดแปลงต้องเปิดซอร์สภายใต้สัญญาเดียวกัน ข้อความเต็มอยู่ในไฟล์ LICENSE ของโปรเจกต์')}</p>
        </section>

        <section className="card card-pad col gap8">
          <h2 className="h3">{t('สูตรคำนวณที่ใช้')}</h2>
          <ul className="body-m t2" style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li><b>BMR</b>{' '}{t('สูตร Mifflin-St Jeor: 10×น้ำหนัก(กก.) + 6.25×ส่วนสูง(ซม.) − 5×อายุ + 5 (ชาย) หรือ − 161 (หญิง)')}</li>
            <li><b>TDEE</b>{' '}{t('= BMR × ตัวคูณกิจกรรม ({factors})', { factors: ACTIVITY_LEVELS.map((a) => a.factor).join(' / ') })}</li>
            <li><b>{t('เป้าแคลอรี่')}</b>{' '}{t('= TDEE ± (กก./สัปดาห์ × 7,700 ÷ 7) ปัดเป็นหลัก 10 และไม่ต่ำกว่า 1,500 (ชาย) / 1,200 (หญิง)')}</li>
            <li><b>{t('น้ำดื่ม')}</b>{' '}{t('≈ 35 มล. × น้ำหนักตัว ปัดเป็นหลัก 50')}</li>
            <li><b>{t('แคลอรี่จากกิจกรรม')}</b>{' '}{t('= MET × น้ำหนัก(กก.) × ชั่วโมง')}</li>
            <li><b>BMI</b>{' '}{t('ใช้เกณฑ์สำหรับคนเอเชีย (สมส่วน 18.5–22.9)')}</li>
          </ul>
        </section>

        <section className="card card-pad col gap8">
          <h2 className="h3">{t('ข้อมูลสินค้าจากบาร์โค้ด')}</h2>
          <p className="body-m t2">{t('เมื่อสแกนบาร์โค้ด แอปจะส่งเฉพาะเลขบาร์โค้ดไปค้นหาที่')}{' '}<a className="link" href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>{' '}{t('ฐานข้อมูลอาหารเปิดที่อาสาสมัครทั่วโลกช่วยกันเพิ่ม เผยแพร่ภายใต้สัญญาอนุญาต ODbL ภาพจากกล้องถูกประมวลผลบนเครื่องและไม่ถูกส่งไปที่ใด ข้อมูลอาจไม่ครบหรือไม่ตรงกับฉลากเสมอไป')}</p>
        </section>

        <section className="card card-pad col gap8">
          <h2 className="h3">{t('ข้อควรรู้เกี่ยวกับข้อมูลอาหาร')}</h2>
          <p className="body-m t2">{t('ค่าพลังงานและสารอาหารของอาหารในแอปเป็นค่าประมาณต่อ 1 หน่วยบริโภคทั่วไป ยังไม่ได้ตรวจทานกับตารางองค์ประกอบอาหารไทยฉบับทางการ ปริมาณจริงต่างกันตามร้านและวิธีปรุง หากพบค่าที่ไม่ตรง สร้างอาหารของคุณเองในแอปได้')}</p>
        </section>

        <section className="card card-pad col gap8" style={{ background: 'var(--calorie-soft)' }}>
          <h2 className="h3"><Heart size={18} style={{ verticalAlign: '-3px' }} />{' '}{t('ข้อจำกัดความรับผิดชอบ')}</h2>
          <p className="body-m">{t('แอปนี้ให้ข้อมูลทั่วไปเพื่อช่วยติดตามการกิน ไม่ใช่คำแนะนำทางการแพทย์ ไม่ใช่การวินิจฉัยหรือการรักษา หากมีโรคประจำตัว ตั้งครรภ์ ให้นมบุตร มีประวัติความผิดปกติทางการกิน หรืออายุต่ำกว่า 18 ปี ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนตั้งเป้าหมาย')}</p>
        </section>
      </main>
    </>
  );
}
