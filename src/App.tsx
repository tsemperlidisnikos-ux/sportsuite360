import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getSession, isPlatformAdmin } from './auth/auth';
import { RequireAuth } from './auth/RequireAuth';
import { RequireModule } from './auth/RequireModule';
import { RequirePlatformAdmin } from './auth/RequirePlatformAdmin';
import { AppLayout } from './components/layout/AppLayout';
import { AthleteProfilePage } from './pages/AthleteProfilePage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AssociationsPage } from './pages/AssociationsPage';
import { AttendancePage } from './pages/AttendancePage';
import { ClassesPage } from './pages/ClassesPage';
import { CoachesPage } from './pages/CoachesPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalendarPage } from './pages/CalendarPage';
import { FeesPage } from './pages/FeesPage';
import { FinancePage } from './pages/FinancePage';
import { LicensePackagesPage } from './pages/LicensePackagesPage';
import { LoginPage } from './pages/LoginPage';
import { ParentPortalPage } from './pages/ParentPortalPage';
import { CoachPortalPage } from './pages/CoachPortalPage';
import { AthletePortalPage } from './pages/AthletePortalPage';
import { PlatformAdminPage } from './pages/PlatformAdminPage';
import { PlatformUsersPage } from './pages/PlatformUsersPage';
import { PrintsPage } from './pages/PrintsPage';
import { RegisterClubPage } from './pages/RegisterClubPage';
import { SchedulePage } from './pages/SchedulePage';
import { SettingsPage } from './pages/SettingsPage';
import { SportsPage } from './pages/SportsPage';
import { StaffPage } from './pages/StaffPage';
import { StudentsPage } from './pages/StudentsPage';
import { TrainingsPage } from './pages/TrainingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { WarehousePage } from './pages/WarehousePage';
import { PartnerBusinessesPage } from './pages/PartnerBusinessesPage';
import { PhotosPage } from './pages/PhotosPage';
import { ParentsPage } from './pages/ParentsPage';
import { getPreviewClubId } from './platform/platformConfig';

function HomeRoute() {
  if (isPlatformAdmin() && !getPreviewClubId()) {
    return <Navigate to="/platform" replace />;
  }
  const session = getSession();
  if (session?.role === 'parent') return <ParentPortalPage />;
  if (session?.role === 'coach') return <CoachPortalPage />;
  if (session?.role === 'athlete') return <AthletePortalPage />;
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
            <Route
              path="calendar"
              element={
                <RequireModule moduleId="calendar">
                  <CalendarPage />
                </RequireModule>
              }
            />
            <Route
              path="athletes"
              element={
                <RequireModule moduleId="athletes">
                  <StudentsPage />
                </RequireModule>
              }
            />
            <Route
              path="athletes/:athleteId"
              element={
                <RequireModule moduleId="athletes">
                  <AthleteProfilePage />
                </RequireModule>
              }
            />
            <Route path="students" element={<Navigate to="/athletes" replace />} />
            <Route
              path="staff"
              element={
                <RequireModule moduleId="staff">
                  <StaffPage />
                </RequireModule>
              }
            />
            <Route
              path="coaches"
              element={
                <RequireModule moduleId="coaches">
                  <CoachesPage />
                </RequireModule>
              }
            />
            <Route
              path="classes"
              element={
                <RequireModule moduleId="classes">
                  <ClassesPage />
                </RequireModule>
              }
            />
            <Route
              path="parents"
              element={
                <RequireModule moduleId="parents">
                  <ParentsPage />
                </RequireModule>
              }
            />
            <Route
              path="trainings"
              element={
                <RequireModule moduleId="trainings">
                  <TrainingsPage />
                </RequireModule>
              }
            />
            <Route
              path="schedule"
              element={
                <RequireModule moduleId="schedule">
                  <SchedulePage />
                </RequireModule>
              }
            />
            <Route
              path="attendance"
              element={
                <RequireModule moduleId="attendance">
                  <AttendancePage />
                </RequireModule>
              }
            />
            <Route
              path="associations"
              element={
                <RequireModule moduleId="associations">
                  <AssociationsPage />
                </RequireModule>
              }
            />
            <Route
              path="sports"
              element={
                <RequireModule moduleId="sports">
                  <SportsPage />
                </RequireModule>
              }
            />
            <Route
              path="announcements"
              element={
                <RequireModule moduleId="announcements">
                  <AnnouncementsPage />
                </RequireModule>
              }
            />
            <Route
              path="prints"
              element={
                <RequireModule moduleId="prints">
                  <PrintsPage />
                </RequireModule>
              }
            />
            <Route
              path="photos"
              element={
                <RequireModule moduleId="photos">
                  <PhotosPage />
                </RequireModule>
              }
            />
            <Route
              path="warehouse"
              element={
                <RequireModule moduleId="warehouse">
                  <WarehousePage />
                </RequireModule>
              }
            />
            <Route
              path="fees"
              element={
                <RequireModule moduleId="fees">
                  <FeesPage />
                </RequireModule>
              }
            />
            <Route
              path="transactions"
              element={
                <RequireModule moduleId="transactions">
                  <TransactionsPage />
                </RequireModule>
              }
            />
            <Route
              path="partner-businesses"
              element={
                <RequireModule moduleId="partnerBusinesses">
                  <PartnerBusinessesPage />
                </RequireModule>
              }
            />
            <Route
              path="settings"
              element={
                <RequireModule moduleId="settings">
                  <SettingsPage />
                </RequireModule>
              }
            />
            <Route
              path="finance"
              element={
                <RequireModule moduleId="finance">
                  <FinancePage />
                </RequireModule>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
