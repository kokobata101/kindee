import { useNavigate } from 'react-router-dom';
import { Activity, Award, CalendarClock, Cloud, Droplet, Info, Scale, Settings as Cog, Share2, Target } from 'lucide-react';
import { useProfile } from '../app/context';
import { useWeights } from '../app/hooks';
import { bmi, bmiCategory, GOAL_LABEL } from '../lib/nutrition';
import { fmtInt, fmtKg } from '../lib/format';
import { Group, ListRow } from '../ui/kit';
import { useCloud } from '../sync/context';

import { t } from '../i18n';
export default function Me() {
  const p = useProfile();
  const nav = useNavigate();
  const { latest } = useWeights();
  const kg = latest?.kg ?? p.startWeightKg;
  const b = bmi(kg, p.heightCm);
  const cloud = useCloud();
  const cloudSub = !cloud.supported
    ? t('ยังไม่เปิดใช้ในเวอร์ชันนี้')
    : cloud.snap.user
      ? t('{name} · ซิงก์แล้ว', { name: cloud.snap.user.name ?? cloud.snap.user.email ?? t('บัญชีของฉัน') })
      : t('ล็อกอินด้วย Google, Facebook, Apple, LINE');

  return (
    <main className="screen" aria-label={t('ฉัน')}>
      <div className="card card-pad row-flex" style={{ gap: 14, marginTop: 'calc(8px + env(safe-area-inset-top))' }}>
        <span className="avatar" style={{ width: 60, height: 60, fontSize: 26 }} aria-hidden>
          {[...p.name][0] ?? '👤'}
        </span>
        <div className="col grow">
          <b className="h3" data-testid="me-name">{p.name}</b>
          <span className="caption">{t('{v1} · เป้า {kcalGoal} kcal/วัน', { v1: GOAL_LABEL[p.goal], kcalGoal: fmtInt(p.kcalGoal) })}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <div className="card card-pad col center" style={{ padding: 12 }}>
          <b className="num-m">{fmtKg(kg)}</b>
          <span className="caption">{t('น้ำหนัก (กก.)')}</span>
        </div>
        <div className="card card-pad col center" style={{ padding: 12 }}>
          <b className="num-m">{b.toFixed(1)}</b>
          <span className="caption">BMI · {bmiCategory(b)}</span>
        </div>
        <div className="card card-pad col center" style={{ padding: 12 }}>
          <b className="num-m">{p.heightCm}</b>
          <span className="caption">{t('ส่วนสูง (ซม.)')}</span>
        </div>
      </div>

      <Group title={t('ติดตาม')}>
        <ListRow icon={<Scale size={20} />} title={t('น้ำหนักและร่างกาย')} sub={t('บันทึกและดูแนวโน้ม')} chevron onClick={() => nav('/weight')} />
        <ListRow icon={<Activity size={20} />} tone="calorie" title={t('บันทึกกิจกรรม')} sub={t('เดิน วิ่ง ออกกำลังกาย')} chevron onClick={() => nav('/activity')} />
        <ListRow icon={<Droplet size={20} />} tone="water" title={t('น้ำดื่ม')} sub={t('เป้าหมาย {waterGoalMl} มล.', { waterGoalMl: fmtInt(p.waterGoalMl) })} chevron onClick={() => nav('/water')} />
      </Group>

      <Group title={t('เป้าหมายและรางวัล')}>
        <ListRow icon={<Target size={20} />} title={t('เป้าหมายและแผนของฉัน')} sub={t('แคลอรี่ สารอาหาร น้ำดื่ม')} chevron onClick={() => nav('/goals')} />
        <ListRow icon={<Award size={20} />} tone="carb" title={t('รางวัลและสตรีค')} chevron onClick={() => nav('/rewards')} />
        <ListRow icon={<CalendarClock size={20} />} title={t('ตั้งเวลาบันทึกอาหารอัตโนมัติ')} sub={t('มื้อประจำที่กินซ้ำทุกวัน')} chevron onClick={() => nav('/schedules')} />
      </Group>

      <Group title={t('ข้อมูลและแอป')}>
        <ListRow icon={<Cloud size={20} />} tone="water" title={t('บัญชีและซิงก์ข้ามเครื่อง')} sub={cloudSub} chevron onClick={() => nav('/account')} />
        <ListRow icon={<Share2 size={20} />} title={t('แชร์ให้โค้ช / แพทย์')} sub="PDF · CSV · QR" chevron onClick={() => nav('/share')} />
        <ListRow icon={<Cog size={20} />} title={t('ตั้งค่า')} sub={t('ธีม สำรองข้อมูล ลบข้อมูล')} chevron onClick={() => nav('/settings')} />
        <ListRow icon={<Info size={20} />} title={t('เกี่ยวกับกินดี')} sub={t('โอเพนซอร์ส · GPL-3.0')} chevron onClick={() => nav('/about')} />
      </Group>
    </main>
  );
}
