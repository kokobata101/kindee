import { Segmented } from './kit';
import { LANGS, lang, setLang, t, type Lang } from '../i18n';

/** สลับภาษาแสดงผล (ไทย / English) — เปลี่ยนแล้วโหลดหน้าใหม่ ข้อมูลของผู้ใช้ไม่หาย */
export function LanguageSwitch() {
  return (
    <Segmented<Lang>
      label={t('ภาษา')}
      value={lang}
      onChange={(l) => l !== lang && setLang(l)}
      options={LANGS.map((o) => ({ value: o.code, label: o.label }))}
    />
  );
}
