import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  UserCog,
  Layers,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  ArrowLeftRight,
  UsersRound,
  CreditCard,
  Menu,
  X,
  LogOut,
  Printer,
  Images,
  Users,
  Megaphone,
  Package,
  Building2,
  Settings,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type SVGProps,
} from 'react';
import { getSession, getUserById, isPlatformAdmin, logout, roleLabels } from '../../auth/auth';
import { getClubById, ensureSessionClub } from '../../auth/clubs';
import { AthletesIcon } from '../icons/AthletesIcon';
import { TrainingsIcon } from '../icons/TrainingsIcon';
import {
  ACADEMY_MODULES,
  endPreview,
  getAcademyModulesForClub,
  getAppLogoUrl,
  getAppName,
  getPreviewClubId,
  userCanAccessModule,
  updateAppLogo,
  type AcademyModuleId,
} from '../../platform/platformConfig';
import { useAppData } from '../../hooks/useAppData';
import * as publicClubCloudService from '../../api/services/publicClubCloudService';

type NavIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const academyItems: Array<{
  id: AcademyModuleId;
  to: string;
  label: string;
  icon: NavIcon;
  end?: boolean;
}> = [
  { id: 'dashboard', to: '/', label: 'Επισκόπηση', icon: LayoutDashboard, end: true },
  { id: 'calendar', to: '/calendar', label: 'Ημερολόγιο', icon: Calendar },
  { id: 'athletes', to: '/athletes', label: 'Αθλητές', icon: AthletesIcon },
  { id: 'staff', to: '/staff', label: 'Προσωπικό', icon: UsersRound },
  { id: 'coaches', to: '/coaches', label: 'Προπονητές', icon: UserCog },
  { id: 'classes', to: '/classes', label: 'Τμήματα', icon: Layers },
  { id: 'parents', to: '/parents', label: 'Γονείς', icon: Users },
  { id: 'trainings', to: '/trainings', label: 'Προπονήσεις', icon: TrainingsIcon },
  { id: 'matches', to: '/matches', label: 'Αγώνες', icon: Trophy },
  { id: 'schedule', to: '/schedule', label: 'Πρόγραμμα', icon: CalendarDays },
  { id: 'attendance', to: '/attendance', label: 'Παρουσίες', icon: ClipboardCheck },
  { id: 'announcements', to: '/announcements', label: 'Ανακοινώσεις', icon: Megaphone },
  { id: 'prints', to: '/prints', label: 'Εκτυπώσεις', icon: Printer },
  { id: 'photos', to: '/photos', label: 'Φωτογραφίες', icon: Images },
  { id: 'warehouse', to: '/warehouse', label: 'Αποθήκη', icon: Package },
  { id: 'fees', to: '/fees', label: 'Συνδρομές / Πληρωμές', icon: CreditCard },
  { id: 'transactions', to: '/transactions', label: 'Συναλλαγές', icon: ArrowLeftRight },
  {
    id: 'partnerBusinesses',
    to: '/partner-businesses',
    label: 'Συμβεβλημένες Επιχειρήσεις',
    icon: Building2,
  },
  { id: 'settings', to: '/settings', label: 'Ρυθμίσεις', icon: Settings },
];

const analysisItems: Array<{
  id: AcademyModuleId;
  to: string;
  label: string;
  icon: NavIcon;
}> = [
  { id: 'finance', to: '/finance', label: 'Οικονομικά', icon: Wallet },
];

const MAX_APP_LOGO_BYTES = 500_000;

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [clubTick, setClubTick] = useState(0);
  const [platformTick, setPlatformTick] = useState(0);
  const [logoError, setLogoError] = useState('');
  const navigate = useNavigate();
  const session = getSession();
  const previewClubId = getPreviewClubId();
  const clubId = previewClubId ?? session?.clubId ?? null;
  const club = useMemo(() => {
    if (previewClubId) return getClubById(previewClubId);
    return ensureSessionClub(session) ?? getClubById(clubId);
  }, [clubId, clubTick, previewClubId, session?.clubId, session?.id, session?.email]);
  const appName = useMemo(() => getAppName(), [platformTick]);
  const appLogoUrl = useMemo(() => getAppLogoUrl(), [platformTick]);
  const appLogoInputRef = useRef<HTMLInputElement>(null);
  const canUploadAppLogo = isPlatformAdmin();

  const [usersTick, setUsersTick] = useState(0);
  const { data: appData } = useAppData();
  const pendingRegistrationCount = useMemo(
    () =>
      (appData.registrationApplications ?? []).filter((app) => app.status === 'pending')
        .length,
    [appData.registrationApplications],
  );

  useEffect(() => {
    const onClubsUpdated = () => setClubTick((n) => n + 1);
    const onPlatformUpdated = () => setPlatformTick((n) => n + 1);
    const onUsersUpdated = () => setUsersTick((n) => n + 1);
    window.addEventListener('academyhub-clubs-updated', onClubsUpdated);
    window.addEventListener('academyhub-platform-updated', onPlatformUpdated);
    window.addEventListener('academyhub-users-updated', onUsersUpdated);
    return () => {
      window.removeEventListener('academyhub-clubs-updated', onClubsUpdated);
      window.removeEventListener('academyhub-platform-updated', onPlatformUpdated);
      window.removeEventListener('academyhub-users-updated', onUsersUpdated);
    };
  }, []);

  useEffect(() => {
    if (!clubId) return;
    void publicClubCloudService.pullRemoteRegistrationApplications(clubId);
  }, [clubId]);

  const enabledModules = useMemo(() => {
    if (!clubId) return new Set(ACADEMY_MODULES.map((m) => m.id));
    return new Set(getAcademyModulesForClub(clubId));
  }, [clubId, platformTick]);

  const accessUser = useMemo(() => {
    if (!session) return { role: '' as const, permissions: null };
    if (session.role === 'platform_admin') {
      return { role: session.role, permissions: null };
    }
    const stored = getUserById(session.id);
    return {
      role: session.role,
      permissions: stored?.permissions ?? null,
    };
  }, [session, platformTick, clubTick, usersTick]);

  const visibleAcademy = academyItems
    .filter((item) => enabledModules.has(item.id) && userCanAccessModule(accessUser, item.id))
    .map((item) => {
      if (item.id !== 'dashboard') return item;
      if (session?.role === 'parent') return { ...item, label: 'Αρχική γονέα' };
      if (session?.role === 'coach') return { ...item, label: 'Αρχική προπονητή' };
      if (session?.role === 'athlete') return { ...item, label: 'Αρχική αθλητή' };
      return item;
    });
  const visibleAnalysis = analysisItems.filter(
    (item) => enabledModules.has(item.id) && userCanAccessModule(accessUser, item.id),
  );

  function handleLogout() {
    endPreview();
    logout();
    navigate('/login', { replace: true });
  }

  function handleAppLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canUploadAppLogo) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Επιλέξτε εικόνα (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > MAX_APP_LOGO_BYTES) {
      setLogoError('Η εικόνα πρέπει να είναι έως ~500KB.');
      return;
    }
    setLogoError('');
    const reader = new FileReader();
    reader.onload = () => {
      updateAppLogo(String(reader.result ?? ''));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={`app-frame ${open ? 'nav-open' : ''}`}>
      <header className="app-header">
        <div className="app-header-brand">
          <button
            className="icon-btn mobile-only"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Άνοιγμα μενού"
          >
            <Menu size={18} />
          </button>

          <input
            ref={appLogoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={handleAppLogoChange}
          />
          <button
            type="button"
            className={`app-logo-btn ${canUploadAppLogo ? 'is-editable' : ''}`}
            onClick={() => {
              if (canUploadAppLogo) appLogoInputRef.current?.click();
            }}
            aria-label={
              canUploadAppLogo ? 'Ανέβασμα logo εφαρμογής' : appName
            }
            title={
              canUploadAppLogo
                ? 'Platform Admin: κλικ για ανέβασμα logo εφαρμογής'
                : appName
            }
          >
            {appLogoUrl ? (
              <img src={appLogoUrl} alt="" />
            ) : (
              <span className="brand-mark">SS</span>
            )}
          </button>

          <div>
            <strong>{appName}</strong>
            {logoError ? <em className="app-logo-error">{logoError}</em> : null}
          </div>
        </div>

        <div className="app-header-user">
          <div>
            <strong>{session?.fullName ?? 'Χρήστης'}</strong>
            <span>{session ? roleLabels[session.role] : ''}</span>
          </div>
          <div className="sidebar-user-actions">
            {isPlatformAdmin() ? (
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  endPreview();
                  navigate('/platform');
                }}
                aria-label="Διαχείριση πλατφόρμας"
                title="Διαχείριση πλατφόρμας"
              >
                <UsersRound size={16} />
              </button>
            ) : null}
            <button type="button" className="icon-btn" onClick={handleLogout} aria-label="Αποσύνδεση">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-mobile-close mobile-only">
            <button
              className="icon-btn"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Κλείσιμο μενού"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="side-nav">
            {club?.logoUrl ? (
              <div className="sidebar-club-logo">
                <img src={club.logoUrl} alt={club.name} />
              </div>
            ) : null}
            <p className="nav-section">Ακαδημία</p>
            {visibleAcademy.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <item.icon size={18} />
                <span className="nav-link-label">{item.label}</span>
                {item.id === 'athletes' && pendingRegistrationCount > 0 ? (
                  <span className="nav-badge" title="Εκκρεμείς αιτήσεις εγγραφής">
                    {pendingRegistrationCount > 99 ? '99+' : pendingRegistrationCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
            {visibleAnalysis.length > 0 ? <p className="nav-section">Ανάλυση</p> : null}
            {visibleAnalysis.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="main-area">
          {previewClubId && isPlatformAdmin() ? (
            <div className="preview-banner">
              <div>
                <strong>Preview συλλόγου</strong>
                <span>{club?.name ?? previewClubId} · μόνο προβολή</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  endPreview();
                  navigate('/platform');
                }}
              >
                Τέλος preview
              </button>
            </div>
          ) : null}
          <main className="page page--flush-top">
            <Outlet />
          </main>
        </div>

        {open ? (
          <button
            className="nav-scrim"
            type="button"
            aria-label="Κλείσιμο"
            onClick={() => setOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
