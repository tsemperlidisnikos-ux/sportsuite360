import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pushAccountBundle } from '../api/services/accountSyncService';
import { getSession, getUsers, logout, saveUsers } from '../auth/auth';
import { getClubs, saveClubs, type Club } from '../auth/clubs';
import { BackupSchedulePanel } from '../components/BackupSchedulePanel';
import { ClubWaitlistPanel } from '../components/ClubWaitlistPanel';
import { LoginActivityPanel } from '../components/LoginActivityPanel';
import { PlatformDiagnosticPanel } from '../components/PlatformDiagnosticPanel';
import { Button } from '../components/ui/Button';
import { createId, getData, mutateData, replaceAllClubsData, replaceData, resetData } from '../data/repository';
import { downloadBackupZip, formatBackupError, readBackupFile } from '../utils/backupArchive';
import {
  ACADEMY_MODULES,
  CLUB_PERMISSION_LABELS,
  CLUB_PERMISSIONS,
  CLUB_ROLE_LABELS,
  CLUB_ROLES,
  clearStampedRoleDefaultPermissions,
  endPreview,
  getAcademyModulesForClub,
  getPreviewClubId,
  APPEARANCE_THEMES,
  loadPlatformConfig,
  resetFinanceCatalogDefaults,
  saveFinanceCatalogAsDefaults,
  savePlatformConfig,
  setAppearanceTheme,
  updateAppLogo,
  startPreview,
  type AcademyModuleId,
  type AppearanceTheme,
  type ClubPermission,
  type ClubRole,
  type PlatformConfig,
} from '../platform/platformConfig';

type AdminWorkspaceTab = 'platform' | 'academio' | 'backup';

function AdminZone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-zone">
      <h2 className="admin-zone-title">{title}</h2>
      <div className="admin-zone-stack">{children}</div>
    </section>
  );
}

function AdminRow({
  title,
  description,
  entry,
  records,
  id,
}: {
  title: string;
  description: string;
  entry: ReactNode;
  records: ReactNode;
  id?: string;
}) {
  return (
    <article className="admin-zone-card" id={id}>
      <header className="admin-zone-card-head">
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      <div className="admin-zone-card-body">{entry}</div>
      <div className="admin-zone-card-status">{records}</div>
    </article>
  );
}

function RecordsTable({ children }: { children: ReactNode }) {
  return (
    <div className="ta-table">
      <div className="ta-row ta-header" aria-hidden="true">
        <div className="ta-title">Κατάσταση</div>
        <div className="ta-analysis">Τιμές</div>
      </div>
      {children}
    </div>
  );
}

function RecordsRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ta-row">
      <div className="ta-title">{title}</div>
      <div className="ta-analysis">{children}</div>
    </div>
  );
}

function EditableRecordLine({
  value,
  uppercase = false,
  onSave,
  onDelete,
}: {
  value: string;
  uppercase?: boolean;
  onSave: (nextValue: string) => { success: boolean; error?: string };
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(value);
    setEditing(false);
  }

  function saveEdit() {
    const next = uppercase ? draft.trim().toUpperCase() : draft.trim();
    if (!next) return;
    if (next === value) {
      setEditing(false);
      return;
    }
    const result = onSave(next);
    if (result.success) {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="admin-record-line admin-record-line-edit">
        <input
          className="admin-record-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit();
            }
            if (e.key === 'Escape') cancelEdit();
          }}
          autoFocus
        />
        <div className="admin-record-actions">
          <button type="button" className="btn btn-ghost" onClick={saveEdit}>
            Αποθήκευση
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
            Άκυρο
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-record-line">
      <span>{value}</span>
      <div className="admin-record-actions">
        <button type="button" className="btn btn-ghost" onClick={startEdit}>
          Επεξεργασία
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDelete}>
          Διαγραφή
        </button>
      </div>
    </div>
  );
}

export function PlatformAdminPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [clubsTick, setClubsTick] = useState(0);
  const clubs = useMemo(() => getClubs(), [clubsTick]);
  const [config, setConfig] = useState<PlatformConfig>(() => {
    const loaded = loadPlatformConfig();
    saveFinanceCatalogAsDefaults(loaded);
    return loaded;
  });
  const roleDefaultsBaselineRef = useRef(
    structuredClone(loadPlatformConfig().clubRolePermissions),
  );
  const [catalogClubId, setCatalogClubId] = useState(() => getClubs()[0]?.id ?? '');
  const [clubRole, setClubRole] = useState<ClubRole>('admin');
  const [message, setMessage] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [incomeDescSub, setIncomeDescSub] = useState(config.incomeCategories[0] ?? '');
  const [expenseDescSub, setExpenseDescSub] = useState(config.expenseCategories[0] ?? '');
  const [newIncomeDesc, setNewIncomeDesc] = useState('');
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newAssociation, setNewAssociation] = useState('');
  const [newSport, setNewSport] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [tick, setTick] = useState(0);
  const [adminTab, setAdminTab] = useState<AdminWorkspaceTab>('platform');

  useEffect(() => {
    const onClubsUpdated = () => setClubsTick((n) => n + 1);
    window.addEventListener('academyhub-clubs-updated', onClubsUpdated);
    return () => window.removeEventListener('academyhub-clubs-updated', onClubsUpdated);
  }, []);

  const selectedClub: Club | undefined = clubs.find((c) => c.id === catalogClubId);
  const previewClubId = getPreviewClubId();
  const academyModules = catalogClubId ? getAcademyModulesForClub(catalogClubId) : [];
  const appData = useMemo(() => getData(), [tick]);

  function persist(next: PlatformConfig) {
    setConfig(next);
    savePlatformConfig(next);
  }

  const flash = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2500);
  }, []);

  function toggleClubPermission(permission: ClubPermission) {
    const current = config.clubRolePermissions?.[clubRole] ?? [];
    const nextList = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    persist({
      ...config,
      clubRolePermissions: {
        ...(config.clubRolePermissions ?? {}),
        [clubRole]: nextList,
      },
    });
  }

  function renameIncomeCategory(oldLabel: string, nextLabel: string) {
    if (nextLabel !== oldLabel && config.incomeCategories.includes(nextLabel)) {
      flash('Υπάρχει ήδη.');
      return { success: false, error: 'Υπάρχει ήδη.' };
    }
    const descriptions = { ...config.incomeDescriptions };
    descriptions[nextLabel] = descriptions[oldLabel] ?? [];
    if (nextLabel !== oldLabel) delete descriptions[oldLabel];
    persist({
      ...config,
      incomeCategories: config.incomeCategories.map((c) => (c === oldLabel ? nextLabel : c)),
      incomeDescriptions: descriptions,
    });
    if (incomeDescSub === oldLabel) setIncomeDescSub(nextLabel);
    flash('Η κατηγορία ενημερώθηκε.');
    return { success: true };
  }

  function renameExpenseCategory(oldLabel: string, nextLabel: string) {
    if (nextLabel !== oldLabel && config.expenseCategories.includes(nextLabel)) {
      flash('Υπάρχει ήδη.');
      return { success: false, error: 'Υπάρχει ήδη.' };
    }
    const descriptions = { ...config.expenseDescriptions };
    descriptions[nextLabel] = descriptions[oldLabel] ?? [];
    if (nextLabel !== oldLabel) delete descriptions[oldLabel];
    persist({
      ...config,
      expenseCategories: config.expenseCategories.map((c) => (c === oldLabel ? nextLabel : c)),
      expenseDescriptions: descriptions,
    });
    if (expenseDescSub === oldLabel) setExpenseDescSub(nextLabel);
    flash('Η κατηγορία ενημερώθηκε.');
    return { success: true };
  }

  function renameDescription(
    kind: 'income' | 'expense',
    subcategory: string,
    oldLabel: string,
    nextLabel: string,
  ) {
    const mapKey = kind === 'income' ? 'incomeDescriptions' : 'expenseDescriptions';
    const current = config[mapKey][subcategory] ?? [];
    if (nextLabel !== oldLabel && current.includes(nextLabel)) {
      flash('Υπάρχει ήδη.');
      return { success: false, error: 'Υπάρχει ήδη.' };
    }
    persist({
      ...config,
      [mapKey]: {
        ...config[mapKey],
        [subcategory]: current.map((d) => (d === oldLabel ? nextLabel : d)),
      },
    });
    flash('Η περιγραφή ενημερώθηκε.');
    return { success: true };
  }

  function toggleAcademyModule(moduleId: AcademyModuleId) {
    if (!catalogClubId) return;
    const current = getAcademyModulesForClub(catalogClubId);
    const nextList = current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId];
    if (nextList.length === 0) {
      flash('Πρέπει να μείνει τουλάχιστον μία καρτέλα.');
      return;
    }
    persist({
      ...config,
      academyModulesByClub: { ...config.academyModulesByClub, [catalogClubId]: nextList },
    });
  }

  function handlePreview() {
    if (!catalogClubId) {
      flash('Επιλέξτε λογαριασμό');
      return;
    }
    startPreview(catalogClubId);
    navigate('/');
  }

  function handleEndPreview() {
    endPreview();
    flash('Το preview τερματίστηκε.');
    setTick((n) => n + 1);
  }

  function handleBackupExport() {
    downloadBackupZip();
    flash('Το backup ZIP κατέβηκε.');
  }

  async function applyBackupFile(file: File) {
    try {
      const parsed = await readBackupFile(file);
      if (parsed.appDataByClub && Object.keys(parsed.appDataByClub).length > 0) {
        replaceAllClubsData(parsed.appDataByClub);
      } else if (parsed.appData) {
        replaceData(parsed.appData);
      }
      if (parsed.platformConfig) {
        persist(parsed.platformConfig);
      }
      if (parsed.users?.length) saveUsers(parsed.users);
      if (parsed.clubs?.length) saveClubs(parsed.clubs);

      flash('Η επαναφορά ολοκληρώθηκε. Ανανέωση σελίδας…');
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      flash(formatBackupError(err));
    }
  }

  function handleBackupImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('backupFile') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      flash('Επιλέξτε πρώτα αρχείο backup (.zip).');
      return;
    }
    void applyBackupFile(file);
  }

  function handleBackupFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void applyBackupFile(file);
  }

  function handleResetAppData() {
    if (!confirm('Διαγραφή όλων των δεδομένων εφαρμογής;')) return;
    resetData();
    setTick((n) => n + 1);
    flash('Τα δεδομένα μηδενίστηκαν.');
  }

  return (
    <div className="platform-admin-page">
      <header className="platform-admin-header">
        <div>
          <p className="eyebrow">Platform Admin</p>
          <h1>Διαχείριση</h1>
          <p className="lede">
            Ρυθμίσεις πλατφόρμας και ακαδημίας για συλλόγους και καταλόγους.
          </p>
        </div>
        <div className="platform-admin-actions">
          <span className="platform-admin-user">{session?.fullName}</span>
          <Link className="btn btn-secondary" to="/platform/users">
            Χρήστες
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAdminTab('platform')}
          >
            Λίστα αναμονής
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAdminTab('platform')}
          >
            Ιστορικό εισόδων
          </button>
          <Link className="btn btn-secondary" to="/platform/packages">
            Πακέτα αδειών
          </Link>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Αποσύνδεση
          </Button>
        </div>
      </header>

      {message ? <p className="platform-admin-banner">{message}</p> : null}

      <nav className="admin-workspace-tabs" aria-label="Ενότητες διαχείρισης">
        {(
          [
            ['platform', 'Πλατφόρμα'],
            ['academio', 'Academio'],
            ['backup', 'Backup'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`admin-workspace-tab${adminTab === id ? ' is-active' : ''}`}
            onClick={() => setAdminTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {adminTab === 'platform' ? (
      <div className="admin-zones">
        <AdminZone title="Λειτουργία">
          <AdminRow
            id="club-waitlist"
            title="Λίστα αναμονής ακαδημιών"
            description="Αιτήσεις από /register. Έγκριση με κωδικό δημιουργεί σύλλογο και admin λογαριασμό."
            entry={<ClubWaitlistPanel onSaved={flash} />}
            records={
              <RecordsTable>
                <RecordsRow title="Πηγή">
                  Δημόσια φόρμα εγγραφής ακαδημίας (/register).
                </RecordsRow>
                <RecordsRow title="Έγκριση">
                  Ο Platform Admin ορίζει κωδικό και δημιουργεί σύλλογο + admin. Μετά μπορεί να
                  διαγράψει τον σύλλογο.
                </RecordsRow>
                <RecordsRow title="Αποθήκευση">
                  Cloud durable store + τοπικό αντίγραφο. Μετά την έγκριση γίνεται Push λογαριασμών.
                </RecordsRow>
              </RecordsTable>
            }
          />

          <AdminRow
            id="login-activity"
            title="Ιστορικό εισόδων"
            description="Ποιος συνδέθηκε, σε ποιον σύλλογο ανήκει ο λογαριασμός, ρόλος και ώρα. Αποθήκευση στο cloud."
            entry={<LoginActivityPanel onSaved={flash} />}
            records={
              <RecordsTable>
                <RecordsRow title="Καταγράφει">
                  Επιτυχημένες συνδέσεις και impersonate από Platform Admin.
                </RecordsRow>
                <RecordsRow title="Πεδία">
                  Όνομα, email, σύλλογος, ρόλος, τύπος (σύνδεση / impersonate), ώρα.
                </RecordsRow>
                <RecordsRow title="Αποθήκευση">
                  Cloud durable store (Blob/Redis) + τοπικό αντίγραφο ασφαλείας.
                </RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>

        <AdminZone title="Εμφάνιση">
          <AdminRow
            title="Logo εφαρμογής"
            description="Εμφανίζεται αριστερά από το όνομα SPORTSUITE 360. Μόνο Platform Admin."
            entry={
              <div className="entry-form admin-entry">
                <div className="settings-logo-row">
                  <div className="settings-logo-preview">
                    {config.appLogoUrl ? (
                      <img src={config.appLogoUrl} alt="Logo εφαρμογής" />
                    ) : (
                      <span>SS</span>
                    )}
                  </div>
                  <div className="settings-logo-actions">
                    <input
                      id="platform-app-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (!file.type.startsWith('image/')) {
                          flash('Επιλέξτε εικόνα.');
                          return;
                        }
                        if (file.size > 500_000) {
                          flash('Η εικόνα πρέπει να είναι έως ~500KB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const next = updateAppLogo(String(reader.result ?? ''));
                          setConfig(next);
                          flash('Το logo εφαρμογής αποθηκεύτηκε.');
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const next = updateAppLogo(null);
                        setConfig(next);
                        flash('Το logo εφαρμογής αφαιρέθηκε.');
                      }}
                    >
                      Αφαίρεση logo
                    </Button>
                  </div>
                </div>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Όνομα">{config.appName || 'SPORTSUITE 360'}</RecordsRow>
                <RecordsRow title="Logo">
                  {config.appLogoUrl ? 'Ορισμένο' : 'Προεπιλογή (SS)'}
                </RecordsRow>
              </RecordsTable>
            }
          />

          <AdminRow
            title="Εμφάνιση εφαρμογής"
            description="Επιλέξτε θέμα εμφάνισης για όλη την εφαρμογή (login, shell, modules)."
            entry={
              <div className="entry-form admin-entry appearance-theme-picker">
                {APPEARANCE_THEMES.map((theme) => {
                  const selected =
                    (config.appearanceTheme ?? 'ocean-slate') === theme.id;
                  const swatches: Record<AppearanceTheme, [string, string, string]> = {
                    'ocean-slate': ['#1c2b3a', '#f0f4f8', '#2a9bb5'],
                    'midnight-ice': ['#060b14', '#0f1826', '#5ec8e8'],
                    'indigo-steel': ['#2a3344', '#eef1f6', '#4f5fd4'],
                    classic: ['#0d7377', '#eef3f1', '#e8a838'],
                    'navy-amber': ['#0b1f3a', '#f4f6f8', '#d4a017'],
                  };
                  const [c1, c2, c3] = swatches[theme.id];
                  return (
                    <label
                      key={theme.id}
                      className={`appearance-theme-option${selected ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="appearance-theme"
                        value={theme.id}
                        checked={selected}
                        onChange={() => {
                          const next = setAppearanceTheme(theme.id as AppearanceTheme);
                          setConfig(next);
                          flash(`Ενεργό θέμα: ${theme.label}.`);
                        }}
                      />
                      <div>
                        <strong>{theme.label}</strong>
                        <span>{theme.description}</span>
                        <div className="appearance-theme-swatches" aria-hidden>
                          <i style={{ background: c1 }} />
                          <i style={{ background: c2 }} />
                          <i style={{ background: c3 }} />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Ενεργό">
                  {APPEARANCE_THEMES.find(
                    (t) => t.id === (config.appearanceTheme ?? 'ocean-slate'),
                  )?.label ?? 'Ocean Slate'}
                </RecordsRow>
                <RecordsRow title="Εμβέλεια">Όλη η εφαρμογή (login, shell, modules)</RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>

        <AdminZone title="Κατάλογος & δικαιώματα">
          <AdminRow
            title="Κατηγορίες εσόδων"
            description="Υποκατηγορίες εσόδων που εμφανίζονται στη φόρμα καταχώρησης."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newIncomeCategory.trim().toUpperCase();
                  if (!label) return;
                  if (config.incomeCategories.includes(label)) {
                    flash('Υπάρχει ήδη.');
                    return;
                  }
                  persist({
                    ...config,
                    incomeCategories: [...config.incomeCategories, label],
                    incomeDescriptions: { ...config.incomeDescriptions, [label]: [] },
                  });
                  setNewIncomeCategory('');
                  flash('Προστέθηκε κατηγορία εσόδου.');
                }}
              >
                <div className="admin-entry-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      saveFinanceCatalogAsDefaults(config);
                      flash('Οι τρέχουσες κατηγορίες ορίστηκαν ως προεπιλογές.');
                    }}
                  >
                    Ορισμός ως προεπιλογές
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const next = resetFinanceCatalogDefaults(config);
                      setConfig(next);
                      setIncomeDescSub(next.incomeCategories[0] ?? '');
                      setExpenseDescSub(next.expenseCategories[0] ?? '');
                      flash('Επαναφορά προεπιλογών εσόδων/εξόδων.');
                    }}
                  >
                    Επαναφορά defaults
                  </Button>
                </div>
                <label className="field">
                  <span>Νέα κατηγορία</span>
                  <input
                    value={newIncomeCategory}
                    onChange={(e) => setNewIncomeCategory(e.target.value)}
                    placeholder="π.χ. ΕΚΔΗΛΩΣΕΙΣ VIP"
                  />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {config.incomeCategories.map((item) => (
                  <RecordsRow key={item} title="Κατηγορία">
                    <EditableRecordLine
                      value={item}
                      uppercase
                      onSave={(next) => renameIncomeCategory(item, next)}
                      onDelete={() => {
                        const descriptions = { ...config.incomeDescriptions };
                        delete descriptions[item];
                        persist({
                          ...config,
                          incomeCategories: config.incomeCategories.filter((c) => c !== item),
                          incomeDescriptions: descriptions,
                        });
                        if (incomeDescSub === item) {
                          setIncomeDescSub(
                            config.incomeCategories.find((c) => c !== item) ?? '',
                          );
                        }
                      }}
                    />
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Περιγραφές εσόδων"
            description="Επιλογές dropdown ανά υποκατηγορία εσόδου."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newIncomeDesc.trim().toUpperCase();
                  if (!incomeDescSub || !label) return;
                  const current = config.incomeDescriptions[incomeDescSub] ?? [];
                  if (current.includes(label)) {
                    flash('Υπάρχει ήδη.');
                    return;
                  }
                  persist({
                    ...config,
                    incomeDescriptions: {
                      ...config.incomeDescriptions,
                      [incomeDescSub]: [...current, label],
                    },
                  });
                  setNewIncomeDesc('');
                }}
              >
                <label className="field">
                  <span>Υποκατηγορία</span>
                  <select value={incomeDescSub} onChange={(e) => setIncomeDescSub(e.target.value)}>
                    {config.incomeCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Νέα περιγραφή</span>
                  <input value={newIncomeDesc} onChange={(e) => setNewIncomeDesc(e.target.value)} />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {(config.incomeDescriptions[incomeDescSub] ?? []).map((item) => (
                  <RecordsRow key={item} title="Περιγραφή">
                    <EditableRecordLine
                      value={item}
                      uppercase
                      onSave={(next) => renameDescription('income', incomeDescSub, item, next)}
                      onDelete={() => {
                        persist({
                          ...config,
                          incomeDescriptions: {
                            ...config.incomeDescriptions,
                            [incomeDescSub]: (config.incomeDescriptions[incomeDescSub] ?? []).filter(
                              (d) => d !== item,
                            ),
                          },
                        });
                      }}
                    />
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Κατηγορίες εξόδων"
            description="Υποκατηγορίες εξόδων που εμφανίζονται στη φόρμα καταχώρησης."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newExpenseCategory.trim().toUpperCase();
                  if (!label) return;
                  if (config.expenseCategories.includes(label)) {
                    flash('Υπάρχει ήδη.');
                    return;
                  }
                  persist({
                    ...config,
                    expenseCategories: [...config.expenseCategories, label],
                    expenseDescriptions: { ...config.expenseDescriptions, [label]: [] },
                  });
                  setNewExpenseCategory('');
                  flash('Προστέθηκε κατηγορία εξόδου.');
                }}
              >
                <label className="field">
                  <span>Νέα κατηγορία</span>
                  <input
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    placeholder="π.χ. ΜΕΤΑΦΟΡΕΣ"
                  />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {config.expenseCategories.map((item) => (
                  <RecordsRow key={item} title="Κατηγορία">
                    <EditableRecordLine
                      value={item}
                      uppercase
                      onSave={(next) => renameExpenseCategory(item, next)}
                      onDelete={() => {
                        const descriptions = { ...config.expenseDescriptions };
                        delete descriptions[item];
                        persist({
                          ...config,
                          expenseCategories: config.expenseCategories.filter((c) => c !== item),
                          expenseDescriptions: descriptions,
                        });
                        if (expenseDescSub === item) {
                          setExpenseDescSub(
                            config.expenseCategories.find((c) => c !== item) ?? '',
                          );
                        }
                      }}
                    />
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Περιγραφές εξόδων"
            description="Επιλογές dropdown ανά υποκατηγορία εξόδου."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newExpenseDesc.trim().toUpperCase();
                  if (!expenseDescSub || !label) return;
                  const current = config.expenseDescriptions[expenseDescSub] ?? [];
                  if (current.includes(label)) {
                    flash('Υπάρχει ήδη.');
                    return;
                  }
                  persist({
                    ...config,
                    expenseDescriptions: {
                      ...config.expenseDescriptions,
                      [expenseDescSub]: [...current, label],
                    },
                  });
                  setNewExpenseDesc('');
                }}
              >
                <label className="field">
                  <span>Υποκατηγορία</span>
                  <select
                    value={expenseDescSub}
                    onChange={(e) => setExpenseDescSub(e.target.value)}
                  >
                    {config.expenseCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Νέα περιγραφή</span>
                  <input
                    value={newExpenseDesc}
                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                  />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {(config.expenseDescriptions[expenseDescSub] ?? []).map((item) => (
                  <RecordsRow key={item} title="Περιγραφή">
                    <EditableRecordLine
                      value={item}
                      uppercase
                      onSave={(next) => renameDescription('expense', expenseDescSub, item, next)}
                      onDelete={() => {
                        persist({
                          ...config,
                          expenseDescriptions: {
                            ...config.expenseDescriptions,
                            [expenseDescSub]: (config.expenseDescriptions[expenseDescSub] ?? []).filter(
                              (d) => d !== item,
                            ),
                          },
                        });
                      }}
                    />
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Δικαιώματα ρόλων"
            description="Καθολικές προεπιλογές για όλα τα σωματεία. Ό,τι ορίζει εδώ ο Platform Admin ισχύει by default σε κάθε σύλλογο."
            entry={
              <div className="entry-form admin-entry">
                <p className="admin-entry-note">
                  Τα δικαιώματα αποθηκεύονται κεντρικά και εφαρμόζονται αυτόματα σε όλα τα
                  σωματεία για τον αντίστοιχο ρόλο.
                </p>
                <div className="admin-role-tabs">
                  {CLUB_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`report-chip ${clubRole === role ? 'is-active' : ''}`}
                      onClick={() => setClubRole(role)}
                    >
                      {CLUB_ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
                <div className="admin-check-list">
                  {CLUB_PERMISSIONS.map((permission) => {
                    const active = (config.clubRolePermissions?.[clubRole] ?? []).includes(
                      permission,
                    );
                    return (
                      <label key={permission} className="admin-check">
                        <span>
                          {CLUB_PERMISSION_LABELS[permission]}: {active ? 'Ενεργό' : 'Ανενεργό'}
                        </span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleClubPermission(permission)}
                        />
                      </label>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const previous = structuredClone(roleDefaultsBaselineRef.current);
                      persist(config);
                      saveUsers(
                        clearStampedRoleDefaultPermissions(getUsers(), previous),
                      );
                      roleDefaultsBaselineRef.current = structuredClone(
                        config.clubRolePermissions,
                      );
                      const pushed = await pushAccountBundle();
                      if (!pushed.success) {
                        flash(
                          pushed.error ??
                            'Αποθηκεύτηκε τοπικά, αλλά όχι στο cloud. Κάντε Push από Backup.',
                        );
                        return;
                      }
                      flash(
                        'Τα δικαιώματα ρόλων αποθηκεύτηκαν ως προεπιλογή για όλα τα σωματεία.',
                      );
                    })();
                  }}
                >
                  Αποθήκευση δικαιωμάτων
                </Button>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Εμβέλεια">Όλα τα σωματεία (by default)</RecordsRow>
                <RecordsRow title="Ρόλος">{CLUB_ROLE_LABELS[clubRole]}</RecordsRow>
                <RecordsRow title="Ενεργά">
                  {(config.clubRolePermissions?.[clubRole] ?? [])
                    .map((p) => CLUB_PERMISSION_LABELS[p])
                    .filter(Boolean)
                    .join(' · ') || 'Κανένα'}
                </RecordsRow>
                <RecordsRow title="Σύνολο">
                  {(config.clubRolePermissions?.[clubRole] ?? []).length} /{' '}
                  {CLUB_PERMISSIONS.length}
                </RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>
      </div>
      ) : null}

      {adminTab === 'backup' ? (
      <div className="admin-zones">
        <AdminZone title="Αντίγραφα">
          <AdminRow
            title="Backup βάσης"
            description="Εξαγωγή / εισαγωγή πλήρους αντιγράφου (δεδομένα εφαρμογής + ρυθμίσεις πλατφόρμας)."
            entry={
              <div className="entry-form admin-entry">
                <div className="admin-entry-actions">
                  <Button type="button" onClick={handleBackupExport}>
                    Λήψη backup
                  </Button>
                  <Button type="button" variant="danger" onClick={handleResetAppData}>
                    Μηδενισμός δεδομένων
                  </Button>
                </div>
                <form onSubmit={handleBackupImport} className="admin-import-form">
                  <p className="admin-entry-note">
                    Επιλέξτε αρχείο <strong>.zip</strong> που κατεβάσατε από «Λήψη backup»
                    (υποστηρίζεται και παλιό .json). Η επαναφορά ξεκινά μόλις επιλέξετε το αρχείο.
                  </p>
                  <input
                    name="backupFile"
                    type="file"
                    accept="application/zip,.zip,application/json,.json"
                    onChange={handleBackupFileChange}
                  />
                  <Button type="submit" variant="secondary">
                    Επαναφορά από αρχείο
                  </Button>
                </form>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Περιεχόμενο">
                  Users, clubs, app data, κατηγορίες, περιγραφές.
                </RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>

        <AdminZone title="Πρόγραμμα">
          <AdminRow
            title="Πρόγραμμα backup"
            description="Ορίστε πότε γίνεται full backup εφαρμογής και πότε backup δεδομένων κάθε συλλόγου/χρήστη."
            entry={<BackupSchedulePanel onSaved={flash} />}
            records={
              <RecordsTable>
                <RecordsRow title="Full app">
                  Όλη η βάση (users, clubs, config, δεδομένα).
                </RecordsRow>
                <RecordsRow title="Ανά σύλλογο">
                  Ξεχωριστό ZIP ή cloud mirror ανά tenant.
                </RecordsRow>
                <RecordsRow title="Σημείωση">
                  Αυτόματη εκτέλεση όσο είναι ανοιχτή η εφαρμογή (τοπική ώρα browser).
                </RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>

        <AdminZone title="Έλεγχος">
          <AdminRow
            title="Διαγνωστικό τεστ εφαρμογής"
            description="Αναλυτικός έλεγχος όλων των βασικών λειτουργιών για bugs/ασυνέπειες, με οδηγίες διόρθωσης."
            entry={<PlatformDiagnosticPanel onSaved={flash} />}
            records={
              <RecordsTable>
                <RecordsRow title="Καλύπτει">
                  API, Redis/sync, storage, users, clubs, SMTP/Viva, δεδομένα, οικονομικά, fees,
                  αγώνες, config, backup.
                </RecordsRow>
                <RecordsRow title="Αποτέλεσμα">
                  Κρίσιμα / προειδοποιήσεις / info / OK + τρόπος διόρθωσης ανά εύρημα.
                </RecordsRow>
                <RecordsRow title="Εξαγωγή">
                  Λήψη αναφοράς TXT μετά την εκτέλεση.
                </RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>
      </div>
      ) : null}

      {adminTab === 'academio' ? (
      <div className="admin-zones">
        <AdminZone title="Preview">
          <AdminRow
            title="Preview συλλόγου"
            description="Δείτε την εφαρμογή όπως εμφανίζεται σε συγκεκριμένο λογαριασμό, χωρίς αποθήκευση αλλαγών."
            entry={
              <div className="entry-form admin-entry">
                <label className="field">
                  <span>Λογαριασμός</span>
                  <select
                    value={catalogClubId}
                    onChange={(e) => setCatalogClubId(e.target.value)}
                  >
                    <option value="">Επιλέξτε…</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-entry-actions">
                  <Button type="button" onClick={handlePreview} disabled={!catalogClubId}>
                    Preview εφαρμογής
                  </Button>
                  {previewClubId ? (
                    <Button type="button" variant="secondary" onClick={handleEndPreview}>
                      Τέλος preview
                    </Button>
                  ) : null}
                </div>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Κατάσταση">
                  {previewClubId
                    ? `Ενεργό preview: ${clubs.find((c) => c.id === previewClubId)?.name ?? previewClubId}`
                    : 'Δεν υπάρχει ενεργό preview.'}
                </RecordsRow>
              </RecordsTable>
            }
          />

          <AdminRow
            title="Ομάδες σωματείου"
            description="Σωματεία που εμφανίζονται στις φόρμες εσόδων/εξόδων."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newAssociation.trim();
                  if (!name) return;
                  mutateData((data) => {
                    data.associations.push({
                      id: createId('assoc'),
                      name,
                      city: '',
                      phone: '',
                      email: '',
                      address: '',
                      active: true,
                    });
                  });
                  setNewAssociation('');
                  setTick((n) => n + 1);
                }}
              >
                <label className="field">
                  <span>Νέο σωματείο</span>
                  <input
                    value={newAssociation}
                    onChange={(e) => setNewAssociation(e.target.value)}
                  />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {appData.associations.length === 0 ? (
                  <RecordsRow title="Κατάσταση">Δεν υπάρχουν σωματεία.</RecordsRow>
                ) : (
                  appData.associations.map((item) => (
                    <RecordsRow key={item.id} title="Σωματείο">
                      <EditableRecordLine
                        value={item.name}
                        onSave={(next) => {
                          mutateData((data) => {
                            const target = data.associations.find((a) => a.id === item.id);
                            if (target) target.name = next;
                          });
                          setTick((n) => n + 1);
                          flash('Το σωματείο ενημερώθηκε.');
                          return { success: true };
                        }}
                        onDelete={() => {
                          mutateData((data) => {
                            data.associations = data.associations.filter((a) => a.id !== item.id);
                          });
                          setTick((n) => n + 1);
                        }}
                      />
                    </RecordsRow>
                  ))
                )}
              </RecordsTable>
            }
          />
        </AdminZone>

        <AdminZone title="Κατάλογος ακαδημίας">
          <AdminRow
            title="Αθλήματα"
            description="Αθλήματα καταλόγου για φόρμες και προφίλ."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newSport.trim();
                  if (!name) return;
                  mutateData((data) => {
                    data.sports.push({
                      id: createId('sport'),
                      name,
                      active: true,
                    });
                  });
                  setNewSport('');
                  setTick((n) => n + 1);
                }}
              >
                <label className="field">
                  <span>Νέο άθλημα</span>
                  <input value={newSport} onChange={(e) => setNewSport(e.target.value)} />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {appData.sports.length === 0 ? (
                  <RecordsRow title="Κατάσταση">Δεν υπάρχουν αθλήματα.</RecordsRow>
                ) : (
                  appData.sports.map((item) => (
                    <RecordsRow key={item.id} title="Άθλημα">
                      <EditableRecordLine
                        value={item.name}
                        onSave={(next) => {
                          mutateData((data) => {
                            const target = data.sports.find((s) => s.id === item.id);
                            if (target) target.name = next;
                          });
                          setTick((n) => n + 1);
                          flash('Το άθλημα ενημερώθηκε.');
                          return { success: true };
                        }}
                        onDelete={() => {
                          mutateData((data) => {
                            data.sports = data.sports.filter((s) => s.id !== item.id);
                          });
                          setTick((n) => n + 1);
                        }}
                      />
                    </RecordsRow>
                  ))
                )}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Καρτέλες μενού ακαδημίας"
            description="Εμφάνιση/απόκρυψη στοιχείων sidebar (Αθλητές, Τμήματα, Οικονομικά κ.λπ.)."
            entry={
              <div className="entry-form admin-entry">
                <label className="field">
                  <span>Λογαριασμός</span>
                  <select
                    value={catalogClubId}
                    onChange={(e) => setCatalogClubId(e.target.value)}
                  >
                    <option value="">Επιλέξτε…</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-check-list">
                  {ACADEMY_MODULES.map((module) => (
                    <label key={module.id} className="admin-check">
                      <span>
                        {module.label}:{' '}
                        {academyModules.includes(module.id) ? 'Εμφανής' : 'Κρυφή'}
                      </span>
                      <input
                        type="checkbox"
                        checked={academyModules.includes(module.id)}
                        onChange={() => toggleAcademyModule(module.id)}
                        disabled={!catalogClubId}
                      />
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => flash('Το μενού ακαδημίας αποθηκεύτηκε.')}
                  disabled={!catalogClubId}
                >
                  Αποθήκευση μενού
                </Button>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Ενεργές">
                  {selectedClub
                    ? academyModules
                        .map((id) => ACADEMY_MODULES.find((m) => m.id === id)?.label ?? id)
                        .join(' · ') || '—'
                    : 'Επιλέξτε λογαριασμό'}
                </RecordsRow>
              </RecordsTable>
            }
          />
        </AdminZone>

        <AdminZone title="Σεζόν & άδειες">
          <AdminRow
            title="Σεζόν"
            description="Διαθέσιμες αγωνιστικές σεζόν για φίλτρα και οικονομικά."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newSeason.trim();
                  if (!label) return;
                  if (config.seasons.includes(label)) return;
                  persist({ ...config, seasons: [...config.seasons, label] });
                  setNewSeason('');
                }}
              >
                <label className="field">
                  <span>Νέα σεζόν</span>
                  <input
                    value={newSeason}
                    onChange={(e) => setNewSeason(e.target.value)}
                    placeholder="π.χ. 2027–2028"
                  />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {config.seasons.map((item) => (
                  <RecordsRow key={item} title="Σεζόν">
                    <EditableRecordLine
                      value={item}
                      onSave={(next) => {
                        if (next !== item && config.seasons.includes(next)) {
                          flash('Υπάρχει ήδη.');
                          return { success: false, error: 'Υπάρχει ήδη.' };
                        }
                        persist({
                          ...config,
                          seasons: config.seasons.map((s) => (s === item ? next : s)),
                        });
                        flash('Η σεζόν ενημερώθηκε.');
                        return { success: true };
                      }}
                      onDelete={() =>
                        persist({
                          ...config,
                          seasons: config.seasons.filter((s) => s !== item),
                        })
                      }
                    />
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Άδειες / πακέτα"
            description="Όρια αθλητών και πακέτα αδειών συλλόγου (Academio seat licenses)."
            entry={
              <div className="entry-form admin-entry">
                <p className="admin-entry-note">
                  Διαχείριση πακέτων και αδειών ανά σύλλογο.
                </p>
                <Link className="btn btn-primary" to="/platform/packages">
                  Πακέτα αδειών
                </Link>
                <Link className="btn btn-secondary" to="/platform/users">
                  Άδειες ανά σύλλογο
                </Link>
              </div>
            }
            records={
              <RecordsTable>
                {clubs.map((club) => (
                  <RecordsRow key={club.id} title={club.name}>
                    {club.athleteLicenseUsed} / {club.athleteLicenseLimit} άδειες
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />
        </AdminZone>
      </div>
      ) : null}
    </div>
  );
}
