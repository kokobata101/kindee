import { Capacitor } from '@capacitor/core';

/** ในแอป Android (Capacitor) WebView ดาวน์โหลดไฟล์ผ่าน <a download> ไม่ได้ → เขียนไฟล์ชั่วคราวแล้วเปิดหน้าต่างแชร์/บันทึกของระบบ */
async function shareNative(filename: string, text: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const res = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: filename, files: [res.uri], dialogTitle: filename });
}

/** ดาวน์โหลดไฟล์ข้อความจากเบราว์เซอร์ (ไม่ต้องใช้เซิร์ฟเวอร์) หรือส่งออกผ่านหน้าต่างแชร์เมื่อรันเป็นแอป Android */
export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  if (Capacitor.isNativePlatform()) {
    void shareNative(filename, text).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
