import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import * as clubUsersService from '../api/services/clubUsersService';
import { getSession, type AppUser } from '../auth/auth';
import { useAppData } from '../hooks/useAppData';
import { Button } from './ui/Button';
import { SettingsFormRow } from './ui/SettingsFormRow';
import {
  CLUB_PERMISSION_LABELS,
  CLUB_PERMISSIONS,
  CLUB_ROLE_LABELS,
  CLUB_ROLES,
  type ClubPermission,
  type ClubRole,
} from '../platform/platformConfig';

type ClubUsersPanelProps = {
  clubId: string;
  mode?: 'users' | 'invitations';
};

function generatePassword(): string {
  return `ss${Math.random().toString(36).slice(2, 8)}`;
}

export function ClubUsersPanel({ clubId, mode = 'users' }: ClubUsersPanelProps) {
  const session = getSession();
  const navigate = useNavigate();
  const { data: appData, refresh: refreshAppData } = useAppData();
  const isInvitations = mode === 'invitations';
  const [users, setUsers] = useState<AppUser[]>([]);
  const [directory, setDirectory] = useState<clubUsersService.ClubDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchLastName, setSearchLastName] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchRole, setSearchRole] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<ClubRole>('coach');
  const [athleteId, setAthleteId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [permissions, setPermissions] = useState<ClubPermission[]>(() =>
    clubUsersService.defaultPermissionsForRole('coach'),
  );

  const editingUser = useMemo(
    () => users.find((u) => u.id === editingId) ?? null,
    [users, editingId],
  );

  const showForm = isInvitations || Boolean(editingUser);

  const roleOptions = useMemo(() => {
    const labels = new Set(directory.map((row) => row.roleLabel));
    return [...labels].sort((a, b) => a.localeCompare(b, 'el'));
  }, [directory]);

  const filteredDirectory = useMemo(() => {
    const lastQ = searchLastName.trim().toLowerCase();
    const firstQ = searchFirstName.trim().toLowerCase();
    const roleQ = searchRole.trim().toLowerCase();

    return directory.filter((row) => {
      const parts = row.fullName.trim().split(/\s+/).filter(Boolean);
      const lastName = (parts[0] ?? '').toLowerCase();
      const firstName = parts.slice(1).join(' ').toLowerCase();

      if (lastQ && !lastName.includes(lastQ) && !row.fullName.toLowerCase().includes(lastQ)) {
        return false;
      }
      if (firstQ && !firstName.includes(firstQ) && !row.fullName.toLowerCase().includes(firstQ)) {
        return false;
      }
      if (roleQ && !row.roleLabel.toLowerCase().includes(roleQ)) {
        return false;
      }
      return true;
    });
  }, [directory, searchLastName, searchFirstName, searchRole]);

  async function refresh() {
    setLoading(true);
    const [usersResult, directoryResult] = await Promise.all([
      clubUsersService.listClubUsers(clubId),
      clubUsersService.listClubDirectory(clubId),
    ]);
    setLoading(false);
    if (!usersResult.success) {
      setError(usersResult.error ?? 'Αποτυχία φόρτωσης');
      return;
    }
    if (!directoryResult.success) {
      setError(directoryResult.error ?? 'Αποτυχία φόρτωσης μητρώου');
      return;
    }
    setUsers(usersResult.data ?? []);
    setDirectory(directoryResult.data ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [clubId]);

  useEffect(() => {
    if (isInvitations) {
      resetForm();
      setError('');
      setMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching to invitations tab
  }, [isInvitations]);

  const athleteOptions = useMemo(
    () =>
      [...(appData.students ?? [])]
        .filter((s) => s.status !== 'inactive')
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'el'),
        ),
    [appData.students],
  );

  const coachOptions = useMemo(
    () =>
      [...(appData.coaches ?? [])]
        .filter((c) => c.active)
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'el'),
        ),
    [appData.coaches],
  );

  function applyRoleDefaults(nextRole: ClubRole) {
    setRole(nextRole);
    setPermissions(clubUsersService.defaultPermissionsForRole(nextRole));
    if (nextRole !== 'athlete') setAthleteId('');
    if (nextRole !== 'coach') setCoachId('');
  }

  function togglePermission(permission: ClubPermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  }

  function resetForm() {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setPassword(generatePassword());
    setAthleteId('');
    setCoachId('');
    applyRoleDefaults('coach');
  }

  function startEdit(user: AppUser) {
    setEditingId(user.id);
    setFullName(user.fullName);
    setEmail(user.email);
    setPassword('');
    const nextRole = (CLUB_ROLES as readonly string[]).includes(user.role)
      ? (user.role as ClubRole)
      : 'coach';
    setRole(nextRole);
    setAthleteId(user.athleteId ?? '');
    setCoachId(user.coachId ?? '');
    setPermissions(
      user.permissions
        ? (user.permissions.filter((p) =>
            (CLUB_PERMISSIONS as readonly string[]).includes(p),
          ) as ClubPermission[])
        : clubUsersService.defaultPermissionsForRole(nextRole),
    );
    setError('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (editingId) {
      const result = await clubUsersService.updateClubUser(clubId, editingId, {
        fullName,
        role,
        permissions,
        password: password.trim() ? password : undefined,
        athleteId: role === 'athlete' ? athleteId || null : null,
        coachId: role === 'coach' ? coachId || null : null,
      });
      if (!result.success) {
        setError(result.error ?? 'Αποτυχία ενημέρωσης');
        return;
      }
      setMessage('Ο χρήστης ενημερώθηκε.');
      resetForm();
      await refresh();
      return;
    }

    const result = await clubUsersService.inviteClubUser({
      clubId,
      fullName,
      email,
      password,
      role,
      permissions,
      athleteId: role === 'athlete' ? athleteId || null : null,
      coachId: role === 'coach' ? coachId || null : null,
    });
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία πρόσκλησης');
      return;
    }
    setMessage(`Προσκλήθηκε: ${result.data?.email} · κωδικός: ${password}`);
    resetForm();
    await refresh();
  }

  function handleEdit(row: clubUsersService.ClubDirectoryRow) {
    const loginUser = row.userId ? users.find((u) => u.id === row.userId) : undefined;
    if (loginUser) {
      startEdit(loginUser);
      return;
    }
    if (row.kind === 'athlete' && row.entityId) {
      navigate(`/athletes/${row.entityId}`, { state: { editing: true } });
      return;
    }
    if (row.kind === 'coach') {
      navigate('/coaches');
      return;
    }
    if (row.kind === 'staff') {
      navigate('/staff');
      return;
    }
    setError('Δεν υπάρχει φόρμα επεξεργασίας για αυτή την εγγραφή.');
  }

  async function handleDelete(row: clubUsersService.ClubDirectoryRow) {
    if (!confirm(`Διαγραφή «${row.fullName}»;`)) return;
    setError('');
    const result = await clubUsersService.removeClubDirectoryMember(clubId, row);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία διαγραφής');
      return;
    }
    if (row.userId && editingId === row.userId) resetForm();
    setMessage('Η εγγραφή διαγράφηκε.');
    refreshAppData();
    await refresh();
  }

  async function handleToggleActive(row: clubUsersService.ClubDirectoryRow) {
    setError('');
    setMessage('');
    setTogglingId(row.id);
    const nextActive = !row.active;
    const result = await clubUsersService.setClubMemberActive(clubId, row, nextActive);
    setTogglingId(null);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία αλλαγής κατάστασης');
      return;
    }
    setMessage(
      nextActive
        ? `${row.fullName} ενεργοποιήθηκε.`
        : `${row.fullName} απενεργοποιήθηκε και δεν εμφανίζεται πλέον στις αντίστοιχες λίστες.`,
    );
    refreshAppData();
    await refresh();
  }

  if (session?.role !== 'admin' && session?.role !== 'platform_admin') {
    return (
      <section className="panel settings-panel">
        <p className="form-error">Μόνο ο διαχειριστής συλλόγου μπορεί να προσκαλεί χρήστες.</p>
      </section>
    );
  }

  return (
    <section className="panel settings-panel club-users-panel">
      <h3>{isInvitations ? 'Προσκλήσεις' : 'Χρήστες'}</h3>
      <p className="lede">
        {isInvitations
          ? 'Προσκαλέστε μέλη στον σύλλογο και ορίστε ρόλο + δικαιώματα πρόσβασης.'
          : 'Στο μητρώο φαίνονται όλοι οι εγγεγραμμένοι (αθλητές, προπονητές, προσωπικό, λογαριασμοί). Ανενεργά μέλη δεν εμφανίζονται στις αντίστοιχες λίστες της εφαρμογής.'}
      </p>

      {showForm ? (
        <form className="entry-form club-users-form settings-form" onSubmit={handleSubmit}>
          <h4>{editingUser ? 'Επεξεργασία χρήστη' : 'Νέα πρόσκληση'}</h4>

          <SettingsFormRow label="Ονοματεπώνυμο" htmlFor="club-user-fullname">
            <input
              id="club-user-fullname"
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </SettingsFormRow>

          <SettingsFormRow label="Email" htmlFor="club-user-email">
            <input
              id="club-user-email"
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={Boolean(editingId)}
            />
          </SettingsFormRow>

          <SettingsFormRow
            label={editingId ? 'Νέος κωδικός (προαιρετικό)' : 'Κωδικός εισόδου'}
            htmlFor="club-user-password"
          >
            <input
              id="club-user-password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editingId}
              minLength={editingId ? undefined : 6}
              placeholder={editingId ? 'Αφήστε κενό για να μην αλλάξει' : ''}
            />
          </SettingsFormRow>

          <SettingsFormRow label="Ρόλος" htmlFor="club-user-role">
            <select
              id="club-user-role"
              className="field-input"
              value={role}
              onChange={(e) => applyRoleDefaults(e.target.value as ClubRole)}
            >
              {CLUB_ROLES.map((item) => (
                <option key={item} value={item}>
                  {CLUB_ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </SettingsFormRow>

          {role === 'athlete' ? (
            <SettingsFormRow label="Σύνδεση με αθλητή" htmlFor="club-user-athlete">
              <select
                id="club-user-athlete"
                className="field-input"
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
              >
                <option value="">— χωρίς σύνδεση —</option>
                {athleteOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName} {s.firstName}
                  </option>
                ))}
              </select>
            </SettingsFormRow>
          ) : null}

          {role === 'coach' ? (
            <SettingsFormRow label="Σύνδεση με προπονητή" htmlFor="club-user-coach">
              <select
                id="club-user-coach"
                className="field-input"
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
              >
                <option value="">— χωρίς σύνδεση —</option>
                {coachOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName} {c.firstName}
                  </option>
                ))}
              </select>
            </SettingsFormRow>
          ) : null}

          <SettingsFormRow label="Δικαιώματα πρόσβασης">
            <div className="club-users-permissions-grid">
              {CLUB_PERMISSIONS.map((permission) => (
                <label key={permission} className="admin-check">
                  <span>{CLUB_PERMISSION_LABELS[permission]}</span>
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                </label>
              ))}
            </div>
          </SettingsFormRow>

          <div className="settings-form-actions admin-entry-actions">
            <Button type="submit">
              <UserPlus size={16} /> {editingId ? 'Αποθήκευση' : 'Πρόσκληση'}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Άκυρο
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPassword(generatePassword())}
              >
                Νέος κωδικός
              </Button>
            )}
          </div>
        </form>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      {!isInvitations ? (
        <div className="club-users-list">
          <h4>Εγγεγραμμένοι στην εφαρμογή</h4>
          <div className="club-users-search settings-form">
            <SettingsFormRow label="Επώνυμο" htmlFor="club-user-search-last">
              <input
                id="club-user-search-last"
                className="field-input"
                value={searchLastName}
                onChange={(e) => setSearchLastName(e.target.value)}
                placeholder="Αναζήτηση επωνύμου"
              />
            </SettingsFormRow>
            <SettingsFormRow label="Όνομα" htmlFor="club-user-search-first">
              <input
                id="club-user-search-first"
                className="field-input"
                value={searchFirstName}
                onChange={(e) => setSearchFirstName(e.target.value)}
                placeholder="Αναζήτηση ονόματος"
              />
            </SettingsFormRow>
            <SettingsFormRow label="Ρόλος" htmlFor="club-user-search-role">
              <select
                id="club-user-search-role"
                className="field-input"
                value={searchRole}
                onChange={(e) => setSearchRole(e.target.value)}
              >
                <option value="">Όλοι οι ρόλοι</option>
                {roleOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </SettingsFormRow>
          </div>
          {loading ? <p className="lede">Φόρτωση…</p> : null}
          {!loading && directory.length === 0 ? (
            <p className="lede">Δεν υπάρχουν ακόμα εγγεγραμμένα μέλη.</p>
          ) : null}
          {!loading && directory.length > 0 && filteredDirectory.length === 0 ? (
            <p className="lede">Δεν βρέθηκαν αποτελέσματα για την αναζήτηση.</p>
          ) : null}
          <div className="ta-table">
            {filteredDirectory.map((row) => (
              <div key={row.id} className="ta-row">
                <div className="ta-title">{row.roleLabel}</div>
                <div className="ta-analysis">
                  <div className="admin-record-line">
                    <span>
                      {row.fullName} · {row.email}
                      {row.hasLogin ? ' · λογαριασμός' : ' · μητρώο'}
                      {row.customPermissions ? ' · προσαρμοσμένα δικαιώματα' : ''}
                      {row.linkedLabel ? ` · ${row.linkedLabel}` : ''}
                      {' · '}
                      <span className={row.active ? 'badge badge-active' : 'badge badge-inactive'}>
                        {row.active ? 'Ενεργός' : 'Ανενεργός'}
                      </span>
                    </span>
                    <div className="admin-record-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={togglingId === row.id}
                        onClick={() => void handleToggleActive(row)}
                      >
                        {row.active ? 'Ανενεργός' : 'Ενεργός'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleEdit(row)}
                      >
                        Επεξεργασία
                      </button>
                      {row.userId !== session?.id ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleDelete(row)}
                        >
                          Διαγραφή
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
