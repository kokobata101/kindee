import 'fake-indexeddb/auto';
// เทสต์ส่วนใหญ่ตรวจข้อความภาษาไทย จึงล็อกภาษาไว้ที่ไทยก่อน i18n จะอ่านค่า
(globalThis as { __KINDEE_LANG__?: string }).__KINDEE_LANG__ = 'th';
