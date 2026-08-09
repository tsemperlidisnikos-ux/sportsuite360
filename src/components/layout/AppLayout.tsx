import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
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
  Building2,
  Trophy,
  Printer,
  Megaphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState, type ComponentType, type SVGProps } from 'react';
import { getSession, isPlatformAdmin, logout, roleLabels } from '../../auth/auth';
import { getClubById } from '../../auth/clubs';
import { AthletesIcon } from '../icons/AthletesIcon';
import { TrainingsIcon } from '../icons/TrainingsIcon';
import {
  ACADEMY_MODULES,
  endPreview,
  getAcademyModulesForClub,
  getPreviewClubId,
  type AcademyModuleId,
} from '../../platform/platformConfig';

type NavIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const academyItems: Array<{
  id: AcademyModuleId;
  to: string;
  label: string;
  icon: NavIcon;
  end?: boolean;
}> = [
  { id: 'dashboard', to: '/', label: 'Επισκόπηση', icon: LayoutDashboard, end: true },
  { id: 'athletes', to: '/athletes', label: 'Αθλητές', icon: AthletesIcon },
  { id: 'staff', to: '/staff', label: 'Προσωπικό', icon: UsersRound },
  { id: 'coaches', to: '/coaches', label: 'Προπονητές', icon: UserCog },
  { id: 'classes', to: '/classes', label: 'Τμήματα', icon: Layers },
  { id: 'trainings', to: '/trainings', label: 'Προπονήσεις', icon: TrainingsIcon },
  { id: 'schedule', to: '/schedule', label: 'Πρόγραμμα', icon: CalendarDays },
  { id: 'attendance', to: '/attendance', label: 'Παρουσίες', icon: ClipboardCheck },
  { id: 'associations', to: '/associations', label: 'Σωματείο', icon: Building2 },
  { id: 'sports', to: '/sports', label: 'Άθλημα', icon: Trophy },
  { id: 'announcements', to: '/announcements', label: 'Ανακοινώσεις', icon: Megaphone },
  { id: 'prints', to: '/prints', label: 'Εκτυπώσεις', icon: Printer },
];

const analysisItems: Array<{
  id: AcademyModuleId;
  to: string;
  label: string;
  icon: NavIcon;
}> = [
  { id: 'fees', to: '/fees', label: 'Συνδρομές / Πληρωμές', icon: CreditCard },
  { id: 'transactions', to: '/transactions', label: 'Συναλλαγές', icon: ArrowLeftRight },
  { id: 'finance', to: '/finance', label: 'Οικονομικά', icon: Wallet },
];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const session = getSession();
  const previewClubId = getPreviewClubId();
  const clubId = previewClubId ?? session?.clubId ?? null;
  const club = getClubById(clubId);

  const enabledModules = useMemo(() => {
    if (!clubId) return new Set(ACADEMY_MODULES.map((m) => m.id));
    return new Set(getAcademyModulesForClub(clubId));
  }, [clubId]);

  const visibleAcademy = academyItems.filter((item) => enabledModules.has(item.id));
  const visibleAnalysis = analysisItems.filter((item) => enabledModules.has(item.id));

  function handleLogout() {
    endPreview();
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={`app-shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AH</span>
          <div>
            <strong>AcademyHub</strong>
            <span>{club?.name ?? 'Διαχείριση & Οικονομικά'}</span>
          </div>
          <button
            className="icon-btn mobile-only"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Κλείσιμο μενού"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="side-nav">
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
              {item.label}
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

        <div className="sidebar-user">
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
        <header className="topbar">
          <button
            className="icon-btn mobile-only"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Άνοιγμα μενού"
          >
            <Menu size={18} />
          </button>
          <div className="topbar-copy">
            <span className="eyebrow">Ενιαία πλατφόρμα ακαδημίας</span>
            <strong>Λειτουργία & ταμείο σε ένα μέρος</strong>
          </div>
        </header>
        <main className="page">
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
  );
}
