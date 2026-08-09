import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSession, getUsers, logout } from '../auth/auth';
import { getClubs, type Club } from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { createId, getData, mutateData, resetData } from '../data/repository';
import { loadStore, saveStore } from '../data/store';
import {
  ACADEMY_MODULES,
  ACADEMY_PERMISSIONS,
  ACADEMY_PERMISSION_LABELS,
  ACADEMY_ROLE_LABELS,
  ACADEMY_ROLES,
  endPreview,
  getAcademyModulesForClub,
  getPreviewClubId,
  getScfModulesForClub,
  loadPlatformConfig,
  resetFinanceCatalogDefaults,
  savePlatformConfig,
  SCF_CLUB_ROLE_LABELS,
  SCF_CLUB_ROLES,
  SCF_MODULES,
  SCF_PERMISSION_LABELS,
  SCF_PERMISSIONS,
  startPreview,
  type AcademyModuleId,
  type AcademyPermission,
  type AcademyRole,
  type PlatformConfig,
  type ScfClubRole,
  type ScfModuleId,
  type ScfPermission,
} from '../platform/platformConfig';

function AdminRow({
  title,
  description,
  entry,
  records,
}: {
  title: string;
  description: string;
  entry: ReactNode;
  records: ReactNode;
}) {
  return (
    <div className="admin-board-row">
      <div className="admin-board-title">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="admin-board-entry">{entry}</div>
      <div className="admin-board-records">{records}</div>
    </div>
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

export function PlatformAdminPage() {
  const navigate = useNavigate();
  const session = getSession();
  const clubs = useMemo(() => getClubs(), []);
  const [config, setConfig] = useState<PlatformConfig>(() => resetFinanceCatalogDefaults());
  const [catalogClubId, setCatalogClubId] = useState(clubs[0]?.id ?? '');
  const [scfRole, setScfRole] = useState<ScfClubRole>('treasurer');
  const [academyRole, setAcademyRole] = useState<AcademyRole>('admin');
  const [message, setMessage] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [incomeDescSub, setIncomeDescSub] = useState(config.incomeCategories[0] ?? '');
  const [expenseDescSub, setExpenseDescSub] = useState(config.expenseCategories[0] ?? '');
  const [newIncomeDesc, setNewIncomeDesc] = useState('');
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newRegistryKind, setNewRegistryKind] = useState('');
  const [newAssociation, setNewAssociation] = useState('');
  const [newSport, setNewSport] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [tick, setTick] = useState(0);

  const selectedClub: Club | undefined = clubs.find((c) => c.id === catalogClubId);
  const previewClubId = getPreviewClubId();
  const scfModules = catalogClubId ? getScfModulesForClub(catalogClubId) : [];
  const academyModules = catalogClubId ? getAcademyModulesForClub(catalogClubId) : [];
  const appData = useMemo(() => getData(), [tick]);
  const loginAccounts = useMemo(
    () => getUsers().filter((u) => u.role !== 'platform_admin'),
    [tick],
  );

  function persist(next: PlatformConfig) {
    setConfig(next);
    savePlatformConfig(next);
  }

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2500);
  }

  function toggleScfModule(moduleId: ScfModuleId) {
    if (!catalogClubId) return;
    const current = getScfModulesForClub(catalogClubId);
    const nextList = current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId];
    if (nextList.length === 0) {
      flash('Πρέπει να μείνει τουλάχιστον μία καρτέλα.');
      return;
    }
    persist({
      ...config,
      scfModulesByClub: { ...config.scfModulesByClub, [catalogClubId]: nextList },
    });
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

  function toggleScfPermission(permission: ScfPermission) {
    const current = config.scfRolePermissions[scfRole] ?? [];
    const nextList = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    persist({
      ...config,
      scfRolePermissions: { ...config.scfRolePermissions, [scfRole]: nextList },
    });
  }

  function toggleAcademyPermission(permission: AcademyPermission) {
    const current = config.academyRolePermissions[academyRole] ?? [];
    const nextList = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    persist({
      ...config,
      academyRolePermissions: { ...config.academyRolePermissions, [academyRole]: nextList },
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
    const payload = {
      exportedAt: new Date().toISOString(),
      appData: loadStore() ?? getData(),
      platformConfig: loadPlatformConfig(),
      users: getUsers(),
      clubs: getClubs(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academyhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Το backup κατέβηκε.');
  }

  function handleBackupImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('backupFile') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          appData?: ReturnType<typeof getData>;
          platformConfig?: PlatformConfig;
        };
        if (parsed.appData) saveStore(parsed.appData);
        if (parsed.platformConfig) {
          persist(parsed.platformConfig);
        }
        flash('Η επαναφορά ολοκληρώθηκε. Ανανεώστε τη σελίδα.');
        setTick((n) => n + 1);
      } catch {
        flash('Μη έγκυρο αρχείο backup.');
      }
    };
    reader.readAsText(file);
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
            Ρυθμίσεις Sport Club Finance και Academio για συλλόγους, ρόλους και καταλόγους.
          </p>
        </div>
        <div className="platform-admin-actions">
          <span className="platform-admin-user">{session?.fullName}</span>
          <Link className="btn btn-secondary" to="/platform/users">
            Χρήστες
          </Link>
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

      <section className="admin-board-section">
        <h2 className="admin-section-label">Sport Club Finance</h2>
        <div className="admin-board">
          <div className="admin-board-header" aria-hidden="true">
            <div>Τίτλος</div>
            <div>Εισαγωγή δεδομένων</div>
            <div>Καταχωρημένα δεδομένα</div>
          </div>

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
            title="Καρτέλες συλλόγου"
            description="Ποιες καρτέλες εμφανίζονται στο Finance (Dashboard, Έσοδα, Έξοδα, Προϋπολογισμός, Εκτυπώσεις)."
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
                  {SCF_MODULES.map((module) => (
                    <label key={module.id} className="admin-check">
                      <span>
                        {module.label}: {scfModules.includes(module.id) ? 'Εμφανής' : 'Κρυφή'}
                      </span>
                      <input
                        type="checkbox"
                        checked={scfModules.includes(module.id)}
                        onChange={() => toggleScfModule(module.id)}
                        disabled={!catalogClubId}
                      />
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => flash('Οι καρτέλες αποθηκεύτηκαν.')}
                  disabled={!catalogClubId}
                >
                  Αποθήκευση καρτελών
                </Button>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Ενεργές">
                  {selectedClub
                    ? scfModules
                        .map((id) => SCF_MODULES.find((m) => m.id === id)?.label ?? id)
                        .join(' · ') || '—'
                    : 'Επιλέξτε λογαριασμό'}
                </RecordsRow>
              </RecordsTable>
            }
          />

          <AdminRow
            title="Δικαιώματα ρόλων"
            description="Ορισμός δικαιωμάτων για ρόλους συλλόγου (Ταμίας, Γραμματεία κ.λπ.). Ισχύουν στο επόμενο login."
            entry={
              <div className="entry-form admin-entry">
                <div className="admin-role-tabs">
                  {SCF_CLUB_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`report-chip ${scfRole === role ? 'is-active' : ''}`}
                      onClick={() => setScfRole(role)}
                    >
                      {SCF_CLUB_ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
                <div className="admin-check-list">
                  {SCF_PERMISSIONS.map((permission) => (
                    <label key={permission} className="admin-check">
                      <span>
                        {SCF_PERMISSION_LABELS[permission]}:{' '}
                        {(config.scfRolePermissions[scfRole] ?? []).includes(permission)
                          ? 'Ενεργό'
                          : 'Ανενεργό'}
                      </span>
                      <input
                        type="checkbox"
                        checked={(config.scfRolePermissions[scfRole] ?? []).includes(permission)}
                        onChange={() => toggleScfPermission(permission)}
                      />
                    </label>
                  ))}
                </div>
                <Button type="button" onClick={() => flash('Τα δικαιώματα αποθηκεύτηκαν.')}>
                  Αποθήκευση δικαιωμάτων
                </Button>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Ενεργά">
                  {(config.scfRolePermissions[scfRole] ?? [])
                    .map((p) => SCF_PERMISSION_LABELS[p])
                    .join(' · ') || 'Κανένα'}
                </RecordsRow>
                <RecordsRow title="Σημείωση">
                  Οι αλλαγές εφαρμόζονται στο επόμενο login ή ανανέωση συνεδρίας.
                </RecordsRow>
              </RecordsTable>
            }
          />

          <AdminRow
            title="Κατηγορίες εξόδων"
            description="Υποκατηγορίες εξόδων που εμφανίζονται στη φόρμα καταχώρησης (προεπιλογές Sport Club Finance)."
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
                <div className="admin-entry-actions">
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
                    <div className="admin-record-line">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          persist({
                            ...config,
                            expenseCategories: config.expenseCategories.filter((c) => c !== item),
                          });
                        }}
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

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
                    <div className="admin-record-line">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          persist({
                            ...config,
                            incomeCategories: config.incomeCategories.filter((c) => c !== item),
                          });
                        }}
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

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
                  <input name="backupFile" type="file" accept="application/json,.json" />
                  <Button type="submit" variant="secondary">
                    Επαναφορά από αρχείο
                  </Button>
                </form>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Περιεχόμενο">
                  Users, clubs, app data, κατηγορίες, περιγραφές, δικαιώματα.
                </RecordsRow>
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
                    <div className="admin-record-line">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
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
                      >
                        Διαγραφή
                      </button>
                    </div>
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
                    <div className="admin-record-line">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
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
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Μητρώο"
            description="Υποκατηγορίες μητρώου (π.χ. ΑΘΛΗΤΕΣ, ΜΕΛΗ)."
            entry={
              <form
                className="entry-form admin-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = newRegistryKind.trim().toUpperCase();
                  if (!label) return;
                  if (config.registryKinds.includes(label)) return;
                  persist({ ...config, registryKinds: [...config.registryKinds, label] });
                  setNewRegistryKind('');
                }}
              >
                <label className="field">
                  <span>Νέα υποκατηγορία</span>
                  <input
                    value={newRegistryKind}
                    onChange={(e) => setNewRegistryKind(e.target.value)}
                  />
                </label>
                <Button type="submit">Προσθήκη</Button>
              </form>
            }
            records={
              <RecordsTable>
                {config.registryKinds.map((item) => (
                  <RecordsRow key={item} title="Υποκατηγορία">
                    <div className="admin-record-line">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          persist({
                            ...config,
                            registryKinds: config.registryKinds.filter((k) => k !== item),
                          })
                        }
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </RecordsRow>
                ))}
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
                      <div className="admin-record-line">
                        <span>{item.name}</span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            mutateData((data) => {
                              data.associations = data.associations.filter((a) => a.id !== item.id);
                            });
                            setTick((n) => n + 1);
                          }}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </RecordsRow>
                  ))
                )}
              </RecordsTable>
            }
          />

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
                      <div className="admin-record-line">
                        <span>{item.name}</span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            mutateData((data) => {
                              data.sports = data.sports.filter((s) => s.id !== item.id);
                            });
                            setTick((n) => n + 1);
                          }}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </RecordsRow>
                  ))
                )}
              </RecordsTable>
            }
          />

          <AdminRow
            title="Λογαριασμοί σύνδεσης"
            description="Λογαριασμοί χρηστών συλλόγων. Νέοι λογαριασμοί δημιουργούνται από εγγραφή συλλόγου."
            entry={
              <div className="entry-form admin-entry">
                <p className="admin-entry-note">
                  Διαχείριση χρηστών, impersonation και αδειών στην καρτέλα Χρήστες.
                </p>
                <Link className="btn btn-primary" to="/platform/users">
                  Άνοιγμα χρηστών
                </Link>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Ενεργοί">{loginAccounts.length} λογαριασμοί συλλόγου</RecordsRow>
                {loginAccounts.slice(0, 8).map((user) => (
                  <RecordsRow key={user.id} title={user.role}>
                    {user.fullName} · {user.email}
                  </RecordsRow>
                ))}
              </RecordsTable>
            }
          />
        </div>
      </section>

      <section className="admin-board-section">
        <h2 className="admin-section-label">Academio</h2>
        <div className="admin-board">
          <div className="admin-board-header" aria-hidden="true">
            <div>Τίτλος</div>
            <div>Εισαγωγή δεδομένων</div>
            <div>Καταχωρημένα δεδομένα</div>
          </div>

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

          <AdminRow
            title="Δικαιώματα ρόλων Academio"
            description="Δικαιώματα ανά ρόλο ακαδημίας (admin, coach, secretariat, athlete, parent)."
            entry={
              <div className="entry-form admin-entry">
                <div className="admin-role-tabs">
                  {ACADEMY_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`report-chip ${academyRole === role ? 'is-active' : ''}`}
                      onClick={() => setAcademyRole(role)}
                    >
                      {ACADEMY_ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
                <div className="admin-check-list">
                  {ACADEMY_PERMISSIONS.map((permission) => (
                    <label key={permission} className="admin-check">
                      <span>
                        {ACADEMY_PERMISSION_LABELS[permission]}:{' '}
                        {(config.academyRolePermissions[academyRole] ?? []).includes(permission)
                          ? 'Ενεργό'
                          : 'Ανενεργό'}
                      </span>
                      <input
                        type="checkbox"
                        checked={(config.academyRolePermissions[academyRole] ?? []).includes(
                          permission,
                        )}
                        onChange={() => toggleAcademyPermission(permission)}
                      />
                    </label>
                  ))}
                </div>
                <Button type="button" onClick={() => flash('Τα δικαιώματα Academio αποθηκεύτηκαν.')}>
                  Αποθήκευση δικαιωμάτων
                </Button>
              </div>
            }
            records={
              <RecordsTable>
                <RecordsRow title="Ενεργά">
                  {(config.academyRolePermissions[academyRole] ?? [])
                    .map((p) => ACADEMY_PERMISSION_LABELS[p])
                    .join(' · ') || 'Κανένα'}
                </RecordsRow>
              </RecordsTable>
            }
          />

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
                    <div className="admin-record-line">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          persist({
                            ...config,
                            seasons: config.seasons.filter((s) => s !== item),
                          })
                        }
                      >
                        Διαγραφή
                      </button>
                    </div>
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
        </div>
      </section>
    </div>
  );
}
