import { HashRouter, MemoryRouter, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, Home as HomeIcon, Plus, User } from 'lucide-react';
import { AppProvider, useApp } from './app/context';
import Welcome from './screens/Welcome';
import Setup from './screens/Setup';
import Home from './screens/Home';
import Diary from './screens/Diary';
import AddFood from './screens/AddFood';
import FoodForm from './screens/FoodForm';
import { ScheduleEditor, Schedules } from './screens/Schedules';
import Activity from './screens/Activity';
import Water from './screens/Water';
import Weight from './screens/Weight';
import Stats from './screens/Stats';
import Me from './screens/Me';
import Goals from './screens/Goals';
import Rewards from './screens/Rewards';
import Share, { ReportViewer } from './screens/Share';
import Settings from './screens/Settings';
import About from './screens/About';
import Scan from './screens/Scan';
import Account from './screens/Account';
import { CloudProvider } from './sync/context';

import { t } from './i18n';
function TabLayout() {
  const nav = useNavigate();
  const tab = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'active' : ''}`;
  return (
    <>
      <Outlet />
      <nav className="tabbar" aria-label={t('เมนูหลัก')}>
        <NavLink to="/" end className={tab}>
          <HomeIcon size={24} />{t('หน้าหลัก')}</NavLink>
        <NavLink to="/diary" className={tab}>
          <BookOpen size={24} />{t('ไดอารี่')}</NavLink>
        <button type="button" className="fab" aria-label={t('เพิ่มอาหาร')} onClick={() => nav('/add')}>
          <Plus size={30} />
        </button>
        <NavLink to="/stats" className={tab}>
          <BarChart3 size={24} />{t('สถิติ')}</NavLink>
        <NavLink to="/me" className={tab}>
          <User size={24} />{t('ฉัน')}</NavLink>
      </nav>
    </>
  );
}

/** รุ่น embed (ฝังในหน้าเว็บที่แก้ URL ไม่ได้) ใช้ MemoryRouter แทน HashRouter */
const Router = import.meta.env.VITE_MEMORY_ROUTER ? MemoryRouter : HashRouter;

function Gate() {
  const { profile } = useApp();
  if (profile === undefined) {
    return (
      <div className="screen no-tabs center" style={{ paddingTop: '40dvh' }} role="status">
        <span className="muted">{t('กำลังโหลด…')}</span>
      </div>
    );
  }
  if (profile === null) {
    return (
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/report" element={<ReportViewer />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route index element={<Home />} />
        <Route path="/diary" element={<Diary />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/me" element={<Me />} />
      </Route>
      <Route path="/add" element={<AddFood />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/food/new" element={<FoodForm />} />
      <Route path="/food/edit/:id" element={<FoodForm />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/water" element={<Water />} />
      <Route path="/weight" element={<Weight />} />
      <Route path="/goals" element={<Goals />} />
      <Route path="/rewards" element={<Rewards />} />
      <Route path="/share" element={<Share />} />
      <Route path="/report" element={<ReportViewer />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/about" element={<About />} />
      <Route path="/account" element={<Account />} />
      <Route path="/schedules" element={<Schedules />} />
      <Route path="/schedule/:id" element={<ScheduleEditor />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/setup" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <CloudProvider>
        <Router>
          <div className="app">
            <Gate />
          </div>
        </Router>
      </CloudProvider>
    </AppProvider>
  );
}
