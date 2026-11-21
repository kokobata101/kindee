// รุ่นปกติ (ไม่ได้ตั้งค่า Firebase): ต้องไม่โชว์ปุ่มล็อกอิน แอปใช้ได้เหมือนเดิม และหน้าบัญชีอธิบายสถานะตรงๆ
import { strict as assert } from 'node:assert';
import { restoreSeed } from '../seed.mjs';

export default async function ({ page, shot, BASE }) {
  await page.goto(BASE);
  await page.getByText('นับแคลอรี่ง่ายๆ').waitFor();
  assert(!(await page.getByRole('button', { name: 'เข้าสู่ระบบเพื่อดึงข้อมูลจากคลาวด์' }).count()), 'Welcome ต้องไม่โชว์ปุ่มล็อกอินเมื่อยังไม่เปิดใช้');
  await restoreSeed(page, BASE);
  await page.getByRole('link', { name: 'ฉัน' }).click();
  await page.getByRole('button', { name: /^บัญชีและซิงก์ข้ามเครื่อง/ }).click();
  await page.getByRole('heading', { name: 'ยังไม่เปิดใช้ล็อกอินในเวอร์ชันนี้' }).waitFor();
  assert(!(await page.getByRole('button', { name: /ดำเนินการต่อด้วย/ }).count()), 'ต้องไม่มีปุ่มล็อกอิน');
  await shot('76-account-off');
}
