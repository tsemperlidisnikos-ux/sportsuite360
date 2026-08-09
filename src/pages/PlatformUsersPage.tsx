import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteUser,
  getSession,
  getUsers,
  impersonateUser,
  isPlatformAdmin,
  logout,
  updateUserEmail,
  type UserRole,
} from '../auth/auth';
import {
  deleteClub,
  getClubById,
  getClubs,
  updateClubLicenses,
  type Club,
} from '../auth/clubs';
import { loadStore } from '../data/store';

type PlatformRole =
  | 'platform_admin'
  | 'admin'
  | 'secretariat'
  | 'coach'
  | 'athlete'
  | 'parent';

interface PlatformUserRow {
  id: string;
  fullName: string;
  email: string;
  role: PlatformRole;
  clubId: string | null;
  clubName: string;
  roleLabel: string;
  licenseText: string | null;
  canDelete: boolean;
  canImpersonate: boolean;
  source: 'user' | 'student';
  athleteId?: string;
}

const ROLE_CARDS: Array<{
  role: PlatformRole;
  title: string;
  accent: string;
}> = [
  { role: 'platform_admin', title: 'Διαχειριστές πλατφόρμας', accent: 'purple' },
  { role: 'admin', title: 'Διαχειριστές συλλόγων', accent: 'blue' },
  { role: 'secretariat', title: 'Γραμματεία', accent: 'cyan' },
  { role: 'coach', title: 'Προπονητές', accent: 'orange' },
  { role: 'athlete', title: 'Αθλητές', accent: 'teal' },
  { role: 'parent', title: 'Γονείς', accent: 'pink' },
];

function licenseText(club: Club | null): string | null {
  if (!club) return null;
  return `ΑΔΕΙΕΣ ΑΘΛΗΤΩΝ ${club.athleteLicenseUsed} / ${club.athleteLicenseLimit}`;
}

function buildRows(): PlatformUserRow[] {
  const clubs = getClubs();
  const users = getUsers();
  const data = loadStore();
  const session = getSession();

  const fromUsers: PlatformUserRow[] = users
    .filter((u) =>
      (['platform_admin', 'admin', 'secretariat', 'coach', 'athlete', 'parent'] as UserRole[]).includes(
        u.role,
      ),
    )
    .map((u) => {
      const club = getClubById(u.clubId);
      const clubName = club?.name ?? '';
      let roleLabel = '';
      if (u.role === 'admin') roleLabel = clubName ? `${clubName} Διαχειριστής` : 'Διαχειριστής συλλόγου';
      else if (u.role === 'athlete') roleLabel = clubName ? `${clubName} Αθλητής` : 'Αθλητής';
      else if (u.role === 'coach') roleLabel = clubName ? `${clubName} Προπονητής` : 'Προπονητής';
      else if (u.role === 'secretariat') roleLabel = clubName ? `${clubName} Γραμματεία` : 'Γραμματεία';
      else if (u.role === 'parent') roleLabel = clubName ? `${clubName} Γονέας` : 'Γονέας';

      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role as PlatformRole,
        clubId: u.clubId ?? null,
        clubName,
        roleLabel,
        licenseText:
          u.role === 'admin' || u.role === 'athlete' ? licenseText(club) : null,
        canDelete: u.role !== 'platform_admin' && u.id !== session?.id,
        canImpersonate: u.id !== session?.id,
        source: 'user' as const,
        athleteId: u.athleteId ?? undefined,
      };
    });

  const athleteUserEmails = new Set(
    fromUsers.filter((u) => u.role === 'athlete').map((u) => u.email.toLowerCase()),
  );

  const defaultClub = clubs[0] ?? null;
  const fromStudents: PlatformUserRow[] = (data?.students ?? [])
    .filter((s) => s.email && !athleteUserEmails.has(s.email.toLowerCase()))
    .map((s) => {
      const club =
        clubs.find((c) => c.name === s.clubName) ??
        defaultClub;
      const clubName = club?.name ?? s.clubName ?? '';
      return {
        id: `student_${s.id}`,
        fullName: `${s.lastName} ${s.firstName}`.trim(),
        email: s.email,
        role: 'athlete' as const,
        clubId: club?.id ?? null,
        clubName,
        roleLabel: clubName ? `${clubName} Αθλητής` : 'Αθλητής',
        licenseText: licenseText(club),
        canDelete: false,
        canImpersonate: true,
        source: 'student' as const,
        athleteId: s.id,
      };
    });

  return [...fromUsers, ...fromStudents];
}

export function PlatformUsersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PlatformUserRow[]>(() => buildRows());
  const [queries, setQueries] = useState<Record<PlatformRole, string>>({
    platform_admin: '',
    admin: '',
    secretariat: '',
    coach: '',
    athlete: '',
    parent: '',
  });
  const [emailEdit, setEmailEdit] = useState<PlatformUserRow | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [licenseEdit, setLicenseEdit] = useState<PlatformUserRow | null>(null);
  const [licenseLimit, setLicenseLimit] = useState(10);
  const [licenseUsed, setLicenseUsed] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      ROLE_CARDS.map((c) => [c.role, [] as PlatformUserRow[]]),
    ) as Record<PlatformRole, PlatformUserRow[]>;
    for (const row of rows) {
      map[row.role]?.push(row);
    }
    return map;
  }, [rows]);

  function refresh() {
    setRows(buildRows());
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleEnter(row: PlatformUserRow) {
    setError('');
    if (row.source === 'student' && row.athleteId) {
      navigate(`/athletes/${row.athleteId}`);
      return;
    }
    const result = impersonateUser(row.id);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία εισόδου');
      return;
    }
    if (result.data?.role === 'platform_admin') {
      navigate('/platform', { replace: true });
      return;
    }
    navigate('/', { replace: true });
  }

  function openEmailEdit(row: PlatformUserRow) {
    if (row.source !== 'user') {
      setError('Η αλλαγή email για αθλητές από τα δεδομένα ακαδημίας γίνεται στο προφίλ αθλητή.');
      return;
    }
    setEmailEdit(row);
    setEmailValue(row.email);
    setError('');
  }

  function saveEmail() {
    if (!emailEdit) return;
    const result = updateUserEmail(emailEdit.id, emailValue);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία ενημέρωσης');
      return;
    }
    setEmailEdit(null);
    setMessage('Το email ενημερώθηκε.');
    refresh();
  }

  function openLicenses(row: PlatformUserRow) {
    if (!row.clubId) {
      setError('Δεν υπάρχει συνδεδεμένος σύλλογος για άδειες.');
      return;
    }
    const club = getClubById(row.clubId);
    if (!club) {
      setError('Ο σύλλογος δεν βρέθηκε.');
      return;
    }
    setLicenseEdit(row);
    setLicenseLimit(club.athleteLicenseLimit);
    setLicenseUsed(club.athleteLicenseUsed);
    setError('');
  }

  function saveLicenses() {
    if (!licenseEdit?.clubId) return;
    const result = updateClubLicenses(licenseEdit.clubId, {
      athleteLicenseLimit: licenseLimit,
      athleteLicenseUsed: licenseUsed,
    });
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία ενημέρωσης αδειών');
      return;
    }
    setLicenseEdit(null);
    setMessage('Οι άδειες ενημερώθηκαν.');
    refresh();
  }

  function handleDelete(row: PlatformUserRow) {
    if (!row.canDelete) return;
    const ok = window.confirm(`Διαγραφή χρήστη «${row.fullName}»;`);
    if (!ok) return;
    const result = deleteUser(row.id);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία διαγραφής');
      return;
    }
    if (row.role === 'admin' && row.clubId) {
      deleteClub(row.clubId);
    }
    setMessage('Ο χρήστης διαγράφηκε.');
    refresh();
  }

  if (!isPlatformAdmin()) {
    return null;
  }

  return (
    <div className="platform-page">
      <header className="platform-topbar">
        <div className="platform-brand">
          <span className="brand-mark">SS</span>
          <strong>SPORTSUITE 360</strong>
        </div>
        <button type="button" className="platform-logout" onClick={handleLogout}>
          Έξοδος
        </button>
      </header>

      <div className="platform-header">
        <div>
          <h1>Χρήστες πλατφόρμας</h1>
          <p>
            Όλοι οι εγγεγραμμένοι χρήστες, ομαδοποιημένοι ανά ρόλο. Πατήστε «Αλλαγή
            email» για να διορθώσετε οποιοδήποτε σφάλμα σε όλους τους ρόλους.
          </p>
          <Link to="/platform" className="platform-packages-btn">
            ← Διαχείριση
          </Link>
          <Link to="/platform/packages" className="platform-packages-btn">
            Πακέτα &amp; τιμές αδειών
          </Link>
        </div>
      </div>

      {message ? <p className="platform-flash platform-flash-ok">{message}</p> : null}
      {error ? <p className="platform-flash platform-flash-error">{error}</p> : null}

      <div className="platform-grid">
        {ROLE_CARDS.map((card) => {
          const q = queries[card.role].trim().toLowerCase();
          const list = grouped[card.role].filter((row) => {
            if (!q) return true;
            return (
              row.fullName.toLowerCase().includes(q) ||
              row.email.toLowerCase().includes(q) ||
              row.clubName.toLowerCase().includes(q)
            );
          });
          return (
            <section
              key={card.role}
              className={`platform-card platform-card-${card.accent}`}
            >
              <div className="platform-card-head">
                <h2>{card.title}</h2>
                <div className="platform-card-tools">
                  <input
                    type="search"
                    placeholder="Αναζήτηση..."
                    value={queries[card.role]}
                    onChange={(e) =>
                      setQueries((prev) => ({ ...prev, [card.role]: e.target.value }))
                    }
                  />
                  <span className="platform-count">{grouped[card.role].length}</span>
                </div>
              </div>

              {list.length === 0 ? (
                <p className="platform-empty">
                  Δεν υπάρχουν χρήστες σε αυτή την κατηγορία.
                </p>
              ) : (
                <ul className="platform-user-list">
                  {list.map((row) => (
                    <li key={row.id} className="platform-user-item">
                      <div className="platform-user-meta">
                        <strong>{row.fullName}</strong>
                        <span>{row.email}</span>
                        {row.roleLabel ? (
                          <span className="platform-user-role">{row.roleLabel}</span>
                        ) : null}
                        {row.licenseText ? (
                          <span className="platform-user-licenses">{row.licenseText}</span>
                        ) : null}
                      </div>
                      <div className="platform-user-actions">
                        <button
                          type="button"
                          className="pu-btn pu-btn-enter"
                          onClick={() => handleEnter(row)}
                          disabled={!row.canImpersonate && row.source === 'user'}
                        >
                          Είσοδος →
                        </button>
                        <button
                          type="button"
                          className="pu-btn pu-btn-email"
                          onClick={() => openEmailEdit(row)}
                        >
                          Αλλαγή email
                        </button>
                        <button
                          type="button"
                          className="pu-btn pu-btn-access"
                          onClick={() => openLicenses(row)}
                        >
                          Πρόσβαση &amp; άδειες αθλητών
                        </button>
                        <button
                          type="button"
                          className="pu-btn pu-btn-delete"
                          onClick={() => handleDelete(row)}
                          disabled={!row.canDelete}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {emailEdit ? (
        <div className="platform-modal-backdrop">
          <div className="platform-modal">
            <h3>Αλλαγή email</h3>
            <p>{emailEdit.fullName}</p>
            <label>
              <span>Νέο email</span>
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />
            </label>
            <div className="platform-modal-actions">
              <button type="button" className="pu-btn pu-btn-access" onClick={() => setEmailEdit(null)}>
                Ακύρωση
              </button>
              <button type="button" className="pu-btn pu-btn-enter" onClick={saveEmail}>
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {licenseEdit ? (
        <div className="platform-modal-backdrop">
          <div className="platform-modal">
            <h3>Πρόσβαση &amp; άδειες αθλητών</h3>
            <p>
              {licenseEdit.clubName || 'Σύλλογος'} — {licenseEdit.fullName}
            </p>
            <label>
              <span>Όριο αδειών</span>
              <input
                type="number"
                min={0}
                value={licenseLimit}
                onChange={(e) => setLicenseLimit(Number(e.target.value))}
              />
            </label>
            <label>
              <span>Χρησιμοποιημένες άδειες</span>
              <input
                type="number"
                min={0}
                value={licenseUsed}
                onChange={(e) => setLicenseUsed(Number(e.target.value))}
              />
            </label>
            <div className="platform-modal-actions">
              <button
                type="button"
                className="pu-btn pu-btn-access"
                onClick={() => setLicenseEdit(null)}
              >
                Ακύρωση
              </button>
              <button type="button" className="pu-btn pu-btn-enter" onClick={saveLicenses}>
                Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
