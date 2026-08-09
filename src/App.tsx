import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isPlatformAdmin } from './auth/auth';
import { RequireAuth } from './auth/RequireAuth';
import { RequirePlatformAdmin } from './auth/RequirePlatformAdmin';
import { AppLayout } from './components/layout/AppLayout';
import { AthleteProfilePage } from './pages/AthleteProfilePage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AssociationsPage } from './pages/AssociationsPage';
import { AttendancePage } from './pages/AttendancePage';
import { ClassesPage } from './pages/ClassesPage';
import { CoachesPage } from './pages/CoachesPage';
import { DashboardPage } from './pages/DashboardPage';
import { FeesPage } from './pages/FeesPage';
import { FinancePage } from './pages/FinancePage';
import { LicensePackagesPage } from './pages/LicensePackagesPage';
import { LoginPage } from './pages/LoginPage';
import { PlatformAdminPage } from './pages/PlatformAdminPage';
import { PlatformUsersPage } from './pages/PlatformUsersPage';
import { PrintsPage } from './pages/PrintsPage';
import { RegisterClubPage } from './pages/RegisterClubPage';
import { SchedulePage } from './pages/SchedulePage';
import { SportsPage } from './pages/SportsPage';
import { StaffPage } from './pages/StaffPage';
import { StudentsPage } from './pages/StudentsPage';
import { TrainingsPage } from './pages/TrainingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { WarehousePage } from './pages/WarehousePage';
import { getPreviewClubId } from './platform/platformConfig';

function HomeRoute() {
  if (isPlatformAdmin() && !getPreviewClubId()) {
    return <Navigate to="/platform" replace />;
  }
  return <DashboardPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterClubPage />} />

        <Route element={<RequireAuth />}>
          <Route path="platform" element={<RequirePlatformAdmin />}>
            <Route index element={<PlatformAdminPage />} />
            <Route path="users" element={<PlatformUsersPage />} />
            <Route path="packages" element={<LicensePackagesPage />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="athletes" element={<StudentsPage />} />
            <Route path="athletes/:athleteId" element={<AthleteProfilePage />} />
            <Route path="students" element={<Navigate to="/athletes" replace />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="coaches" element={<CoachesPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="trainings" element={<TrainingsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="associations" element={<AssociationsPage />} />
            <Route path="sports" element={<SportsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="prints" element={<PrintsPage />} />
            <Route path="warehouse" element={<WarehousePage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
