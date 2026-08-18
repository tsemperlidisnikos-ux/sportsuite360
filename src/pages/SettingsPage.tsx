import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Building2,
  Database,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Plus,
  Ruler,
  ShieldCheck,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { getSession } from '../auth/auth';
import {
  ensureSessionClub,
  getClubById,
  getClubSmtp,
  getClubViva,
  updateClubLogo,
  updateClubProfile,
  updateClubSmtp,
  updateClubViva,
  type ClubSmtpSettings,
  type ClubVivaSettings,
} from '../auth/clubs';
import {
  periodLabel,
  resolveClubLicensePackage,
} from '../auth/licensePackages';
import * as emailService from '../api/services/emailService';
import { getSessionToken, updateCloudClubLogo, uploadClubPhotoBlob } from '../api/services/sessionService';
import { BackupPanel } from '../components/BackupPanel';
import { ChangePasswordPanel } from '../components/ChangePasswordPanel';
import { ClubEmailPanel } from '../components/ClubEmailPanel';
import { ClubPublicRegistrationPanel } from '../components/ClubPublicRegistrationPanel';
import { ClubUsersPanel } from '../components/ClubUsersPanel';
import { ClubVivaPanel } from '../components/ClubVivaPanel';
import { Button } from '../components/ui/Button';
import { SizeChartPanel } from '../components/SizeChartPanel';
import { useAppData } from '../hooks/useAppData';
import { getPreviewClubId } from '../platform/platformConfig';
import { AssociationsPage } from './AssociationsPage';
import { AmkaCompliancePanel } from './AmkaCompliancePanel';
import { FacilitiesPage } from './FacilitiesPage';
import { SportsPage } from './SportsPage';
import { TermsOfUsePanel } from './TermsOfUsePanel';

const MAX_LOGO_BYTES = 2_000_000;
const MAX_LOGO_DATA_URL_LENGTH = 180_000;

type SettingsTab =
  | 'club'
  | 'users'
  | 'email'
  | 'viva'
  | 'publicRegistration'
  | 'password'
  | 'associations'
  | 'facilities'
  | 'sports'
  | 'sizes'
  | 'terms'
  | 'amka'
  | 'backup';

type ClubForm = {
  name: string;
  vatNumber: string;
  taxOffice: string;
  address: string;
  foundedYear: string;
  website: string;
  phone: string;
  email: string;
};

async function optimizeLogoDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Αποτυχία ανάγνωσης αρχείου.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/svg+xml' || dataUrl.length <= MAX_LOGO_DATA_URL_LENGTH) {
    if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
      throw new Error('Το SVG λογότυπο είναι υπερβολικά μεγάλο. Χρησιμοποιήστε μικρότερο αρχείο.');
    }
    return dataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Αποτυχία επεξεργασίας λογοτύπου.'));
    element.src = dataUrl;
  });
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Αδυναμία επεξεργασίας λογοτύπου.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const optimized = canvas.toDataURL('image/jpeg', 0.82);
  if (optimized.length > MAX_LOGO_DATA_URL_LENGTH) {
    throw new Error('Το λογότυπο παραμένει υπερβολικά μεγάλο. Χρησιμοποιήστε μικρότερο αρχείο.');
  }
  return optimized;
}

const PRIMARY_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'club', label: 'Σύλλογος' },
  { id: 'facilities', label: 'Γήπεδο' },
  { id: 'users', label: 'Χρήστες' },
  { id: 'email', label: 'Email' },
  { id: 'viva', label: 'Viva' },
  { id: 'publicRegistration', label: 'Εγγραφή' },
];

const MORE_TABS: Array<{ id: SettingsTab; label: string; icon: typeof KeyRound }> = [
  { id: 'password', label: 'Κωδικός', icon: KeyRound },
  { id: 'associations', label: 'Σωματείο', icon: Building2 },
  { id: 'sports', label: 'Άθλημα', icon: Trophy },
  { id: 'sizes', label: 'Μεγεθολόγιο', icon: Ruler },
  { id: 'terms', label: 'Όροι', icon: FileText },
  { id: 'amka', label: 'GDPR', icon: ShieldCheck },
  { id: 'backup', label: 'Backup', icon: Database },
];

export function SettingsPage() {
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;
  const { data } = useAppData();
  const [club, setClub] = useState(() => ensureSessionClub(session) ?? getClubById(clubId));
  const [tab, setTab] = useState<SettingsTab>('club');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showVivaSecret, setShowVivaSecret] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canManageUsers = session?.role === 'admin' || session?.role === 'platform_admin';

  const activeAthleteLicenses = data.students.filter((s) => s.status === 'active').length;
  const licenseLimit = club?.athleteLicenseLimit ?? 0;
  const licensePackage = club ? resolveClubLicensePackage(club) : null;
  const licensePct =
    licenseLimit > 0
      ? Math.min(100, Math.round((activeAthleteLicenses / licenseLimit) * 100))
      : 0;
  const [clubForm, setClubForm] = useState<ClubForm>({
    name: '',
    vatNumber: '',
    taxOffice: '',
    address: '',
    foundedYear: '',
    website: '',
    phone: '',
    email: '',
  });
  const [smtpForm, setSmtpForm] = useState<ClubSmtpSettings>(() => getClubSmtp(clubId));
  const [vivaForm, setVivaForm] = useState<ClubVivaSettings>(() => getClubViva(clubId));

  const refreshClub = useCallback(() => {
    const next = ensureSessionClub(getSession()) ?? getClubById(clubId);
    setClub(next);
    if (next) {
      setClubForm({
        name: next.name ?? '',
        vatNumber: next.vatNumber ?? '',
        taxOffice: next.taxOffice ?? '',
        address: next.address ?? next.city ?? '',
        foundedYear: next.foundedYear ?? '',
        website: next.website ?? '',
        phone: next.phone ?? '',
        email: next.email ?? '',
      });
    }
    setSmtpForm(getClubSmtp(clubId));
    setVivaForm(getClubViva(clubId));
  }, [clubId]);

  useEffect(() => {
    refreshClub();
  }, [refreshClub]);

  useEffect(() => {
    const onClubsUpdated = () => refreshClub();
    window.addEventListener('academyhub-clubs-updated', onClubsUpdated);
    return () => window.removeEventListener('academyhub-clubs-updated', onClubsUpdated);
  }, [refreshClub]);

  async function readLogoFile(file: File) {
    if (!clubId) return;
    if (!file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      setError('Επιλέξτε εικόνα (PNG, JPG ή SVG).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Η εικόνα πρέπει να είναι έως 2MB.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let logoUrl = await optimizeLogoDataUrl(file);
      if (getSessionToken()) {
        if (logoUrl.startsWith('data:image/') && !logoUrl.startsWith('data:image/svg')) {
          const contentType = logoUrl.slice(5, logoUrl.indexOf(';')) || 'image/jpeg';
          const uploaded = await uploadClubPhotoBlob({
            clubId,
            fileName: 'club-logo.jpg',
            contentType,
            dataBase64: logoUrl,
          });
          if (uploaded.success && uploaded.data?.url) {
            logoUrl = uploaded.data.url;
          }
        }
        const cloud = await updateCloudClubLogo(clubId, logoUrl);
        if (!cloud.success) throw new Error(cloud.error ?? 'Αποτυχία cloud αποθήκευσης λογοτύπου.');
      }
      const result = updateClubLogo(clubId, logoUrl);
      if (!result.success) throw new Error(result.error ?? 'Σφάλμα αποθήκευσης');
      setMessage(getSessionToken() ? 'Το λογότυπο αποθηκεύτηκε στο cloud.' : 'Το λογότυπο αποθηκεύτηκε τοπικά.');
      refreshClub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης λογοτύπου.');
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void readLogoFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readLogoFile(file);
  }

  async function handleSaveAll() {
    if (!clubId) return;
    setSaving(true);
    setError('');
    setMessage('');

    const profile = updateClubProfile(clubId, {
      ...clubForm,
      city: clubForm.address,
    });
    if (!profile.success) {
      setSaving(false);
      setError(profile.error ?? 'Σφάλμα αποθήκευσης συλλόγου');
      return;
    }

    const smtp = updateClubSmtp(clubId, {
      ...getClubSmtp(clubId),
      ...smtpForm,
      enabled: Boolean(smtpForm.host && smtpForm.username),
      fromEmail: smtpForm.fromEmail || '',
      security: smtpForm.security || 'starttls',
      requireAuth: smtpForm.requireAuth ?? true,
      port:
        smtpForm.security === 'ssl'
          ? '465'
          : smtpForm.security === 'none'
            ? smtpForm.port || '25'
            : smtpForm.port || '587',
    });
    if (!smtp.success) {
      setSaving(false);
      setError(smtp.error ?? 'Σφάλμα αποθήκευσης SMTP');
      return;
    }

    const viva = updateClubViva(clubId, vivaForm);
    if (!viva.success) {
      setSaving(false);
      setError(viva.error ?? 'Σφάλμα αποθήκευσης Viva');
      return;
    }

    setSaving(false);
    setMessage('Οι ρυθμίσεις αποθηκεύτηκαν.');
    refreshClub();
  }

  async function handleSmtpTest() {
    if (!clubId) return;
    setTestingSmtp(true);
    setError('');
    setMessage('');
    updateClubSmtp(clubId, { ...getClubSmtp(clubId), ...smtpForm, enabled: true });
    const to = (smtpForm.fromEmail || smtpForm.username || session?.email || '').trim();
    if (!to) {
      setTestingSmtp(false);
      setError('Συμπληρώστε email χρήστη SMTP για έλεγχο σύνδεσης.');
      return;
    }
    const result = await emailService.sendClubEmail({
      clubId,
      to,
      subject: `Έλεγχος SMTP — ${clubForm.name || 'SPORTSUITE 360'}`,
      text: 'Δοκιμαστικό μήνυμα ελέγχου σύνδεσης SMTP από τις Ρυθμίσεις.',
    });
    setTestingSmtp(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία ελέγχου SMTP');
      return;
    }
    setMessage(`Επιτυχής έλεγχος SMTP · στάλθηκε στο ${to}.`);
  }

  function handleVivaTest() {
    if (!vivaForm.clientId.trim() || !vivaForm.clientSecret.trim()) {
      setError('Συμπληρώστε Client ID και Client Secret για έλεγχο.');
      return;
    }
    setMessage('Τα διαπιστευτήρια Viva φαίνονται συμπληρωμένα. Αποθηκεύστε για εφαρμογή.');
    setError('');
  }

  const tabs = PRIMARY_TABS.filter((t) => (t.id === 'users' ? canManageUsers : true));

  return (
    <div className="set-page">
      <header className="set-page-head">
        <h1>Ρυθμίσεις</h1>
      </header>

      <nav className="set-tabs" aria-label="Κατηγορίες ρυθμίσεων">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
        <div className="set-tabs-more">
          {MORE_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'is-active' : ''}
                onClick={() => setTab(item.id)}
                title={item.label}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      {tab === 'club' ? (
        !clubId || !club ? (
          <p className="form-error">Δεν βρέθηκε σύλλογος για τον λογαριασμό.</p>
        ) : (
          <div className="set-club-layout">
            <section className="set-card panel set-license-card">
              <h2>Συνδρομή &amp; άδειες αθλητών</h2>
              <p className="set-card-lede">
                Όριο αδειών σύμφωνα με το πακέτο συνδρομής του συλλόγου.
              </p>
              <div className="set-license-grid">
                <div className="set-license-stat">
                  <span>Πακέτο</span>
                  <strong>{licensePackage?.name ?? 'Χωρίς πακέτο'}</strong>
                  {licensePackage ? (
                    <em>
                      {periodLabel(licensePackage.periodMonths)} ·{' '}
                      {licensePackage.athleteLicenses} άδειες στο πακέτο
                    </em>
                  ) : (
                    <em>Το όριο ορίζεται από τον διαχειριστή πλατφόρμας.</em>
                  )}
                  <em>
                    {club.usageEndsOn
                      ? `Λογαριασμός ενεργός έως ${new Date(`${club.usageEndsOn}T00:00:00`).toLocaleDateString('el-GR')}`
                      : 'Λογαριασμός χωρίς ημερομηνία λήξης'}
                  </em>
                </div>
                <div className="set-license-stat">
                  <span>Χρήση αδειών</span>
                  <strong>
                    {activeAthleteLicenses} / {licenseLimit || '—'}
                  </strong>
                  <em>
                    {licenseLimit > 0
                      ? `${licensePct}% πληρότητα · ενεργοί αθλητές`
                      : 'Δεν έχει οριστεί όριο αδειών'}
                  </em>
                </div>
              </div>
              {licenseLimit > 0 ? (
                <div
                  className="set-license-bar"
                  role="progressbar"
                  aria-valuenow={activeAthleteLicenses}
                  aria-valuemin={0}
                  aria-valuemax={licenseLimit}
                >
                  <i style={{ width: `${licensePct}%` }} />
                </div>
              ) : null}
            </section>

            <section className="set-card panel">
              <h2>Λογότυπο Συλλόγου</h2>
              <p className="set-card-lede">
                Ανεβάστε το λογότυπο του συλλόγου. Προτεινόμενη διάσταση: 512×512px.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={handleFileChange}
              />
              {club.logoUrl ? (
                <div className="set-logo-current">
                  <img src={club.logoUrl} alt={`Logo ${club.name}`} />
                  <div className="set-logo-current-actions">
                    <Button type="button" disabled={saving} onClick={() => fileRef.current?.click()}>
                      Αλλαγή
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => {
                        if (!confirm('Αφαίρεση λογότυπου;')) return;
                        void (async () => {
                          setSaving(true);
                          setError('');
                          try {
                            if (getSessionToken()) {
                              const cloud = await updateCloudClubLogo(clubId, null);
                              if (!cloud.success) {
                                throw new Error(cloud.error ?? 'Αποτυχία αφαίρεσης στο cloud.');
                              }
                            }
                            updateClubLogo(clubId, null);
                            refreshClub();
                            setMessage('Το λογότυπο αφαιρέθηκε.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Αποτυχία αφαίρεσης λογοτύπου.');
                          } finally {
                            setSaving(false);
                          }
                        })();
                      }}
                    >
                      Αφαίρεση
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`set-logo-drop${dragOver ? ' is-drag' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Plus size={28} />
                  <strong>Κάντε κλικ για επιλογή αρχείου ή σύρετε το αρχείο εδώ</strong>
                  <span>PNG, JPG ή SVG (μέγ. 2MB)</span>
                </div>
              )}
            </section>

            <section className="set-card panel">
              <h2>Ρυθμίσεις SMTP (Email)</h2>
              <div className="set-grid-2">
                <label className="set-field">
                  <span>SMTP Host</span>
                  <input
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </label>
                <label className="set-field">
                  <span>SMTP Port</span>
                  <input
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                    placeholder="587"
                  />
                </label>
                <label className="set-field">
                  <span>Όνομα Χρήστη</span>
                  <input
                    value={smtpForm.username}
                    onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="set-field">
                  <span>Κωδικός</span>
                  <div className="set-pass-wrap">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpForm.password}
                      onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="set-eye"
                      onClick={() => setShowSmtpPass((v) => !v)}
                      aria-label={showSmtpPass ? 'Απόκρυψη' : 'Εμφάνιση'}
                    >
                      {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <label className="set-field">
                  <span>Ασφάλεια</span>
                  <select
                    value={smtpForm.security}
                    onChange={(e) =>
                      setSmtpForm({
                        ...smtpForm,
                        security: e.target.value as ClubSmtpSettings['security'],
                      })
                    }
                  >
                    <option value="starttls">STARTTLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">Καμία</option>
                  </select>
                </label>
                <label className="set-field">
                  <span>Απαιτείται Έλεγχος ταυτότητας</span>
                  <select
                    value={smtpForm.requireAuth ? 'yes' : 'no'}
                    onChange={(e) =>
                      setSmtpForm({ ...smtpForm, requireAuth: e.target.value === 'yes' })
                    }
                  >
                    <option value="yes">Ναι</option>
                    <option value="no">Όχι</option>
                  </select>
                </label>
                <label className="set-field">
                  <span>Από Email</span>
                  <input
                    type="email"
                    value={smtpForm.fromEmail}
                    onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })}
                  />
                </label>
                <label className="set-field">
                  <span>Από Όνομα</span>
                  <input
                    value={smtpForm.fromName}
                    onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="set-test-btn"
                disabled={testingSmtp}
                onClick={() => void handleSmtpTest()}
              >
                {testingSmtp ? 'Έλεγχος…' : 'Έλεγχος Σύνδεσης'}
              </button>
            </section>

            <section className="set-card panel">
              <h2>Στοιχεία Συλλόγου</h2>
              <div className="set-grid-2">
                <label className="set-field set-field--full">
                  <span>Όνομα Συλλόγου</span>
                  <input
                    value={clubForm.name}
                    onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
                  />
                </label>
                <label className="set-field">
                  <span>Α.Φ.Μ.</span>
                  <input
                    value={clubForm.vatNumber}
                    onChange={(e) => setClubForm({ ...clubForm, vatNumber: e.target.value })}
                  />
                </label>
                <label className="set-field">
                  <span>Δ.Ο.Υ.</span>
                  <input
                    value={clubForm.taxOffice}
                    onChange={(e) => setClubForm({ ...clubForm, taxOffice: e.target.value })}
                  />
                </label>
                <label className="set-field">
                  <span>Έδρα</span>
                  <input
                    value={clubForm.address}
                    onChange={(e) => setClubForm({ ...clubForm, address: e.target.value })}
                  />
                </label>
                <label className="set-field">
                  <span>Έτος Ίδρυσης</span>
                  <input
                    value={clubForm.foundedYear}
                    onChange={(e) => setClubForm({ ...clubForm, foundedYear: e.target.value })}
                  />
                </label>
                <label className="set-field">
                  <span>Ιστοσελίδα</span>
                  <input
                    value={clubForm.website}
                    onChange={(e) => setClubForm({ ...clubForm, website: e.target.value })}
                    placeholder="https://"
                  />
                </label>
                <label className="set-field">
                  <span>Τηλέφωνο</span>
                  <input
                    value={clubForm.phone}
                    onChange={(e) => setClubForm({ ...clubForm, phone: e.target.value })}
                  />
                </label>
                <label className="set-field set-field--full">
                  <span>Email</span>
                  <input
                    type="email"
                    value={clubForm.email}
                    onChange={(e) => setClubForm({ ...clubForm, email: e.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="set-card panel">
              <h2>Διαπιστευτήρια Viva</h2>
              <div className="set-grid-1">
                <label className="set-field">
                  <span>Merchant ID</span>
                  <input
                    value={vivaForm.merchantId}
                    onChange={(e) => setVivaForm({ ...vivaForm, merchantId: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="set-field">
                  <span>Client ID</span>
                  <input
                    value={vivaForm.clientId}
                    onChange={(e) => setVivaForm({ ...vivaForm, clientId: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="set-field">
                  <span>Client Secret</span>
                  <div className="set-pass-wrap">
                    <input
                      type={showVivaSecret ? 'text' : 'password'}
                      value={vivaForm.clientSecret}
                      onChange={(e) => setVivaForm({ ...vivaForm, clientSecret: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="set-eye"
                      onClick={() => setShowVivaSecret((v) => !v)}
                      aria-label={showVivaSecret ? 'Απόκρυψη' : 'Εμφάνιση'}
                    >
                      {showVivaSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </div>
              <button type="button" className="set-test-btn" onClick={handleVivaTest}>
                Έλεγχος Σύνδεσης
              </button>
            </section>

            <div className="set-save-bar">
              <Button type="button" disabled={saving} onClick={() => void handleSaveAll()}>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </Button>
            </div>
          </div>
        )
      ) : null}

      {tab === 'users' && clubId ? <ClubUsersPanel clubId={clubId} mode="users" /> : null}
      {tab === 'email' && clubId ? <ClubEmailPanel clubId={clubId} /> : null}
      {tab === 'viva' && clubId ? <ClubVivaPanel clubId={clubId} /> : null}
      {tab === 'publicRegistration' && clubId ? (
        <div className="set-embed">
          <div className="set-embed-head">
            <UserPlus size={18} />
            <h2>Δημόσια εγγραφή</h2>
          </div>
          <ClubPublicRegistrationPanel clubId={clubId} onOpenGdpr={() => setTab('amka')} />
        </div>
      ) : null}
      {tab === 'password' ? <ChangePasswordPanel /> : null}
      {tab === 'associations' ? <AssociationsPage /> : null}
      {tab === 'facilities' ? <FacilitiesPage /> : null}
      {tab === 'sports' ? <SportsPage /> : null}
      {tab === 'sizes' ? <SizeChartPanel /> : null}
      {tab === 'terms' ? <TermsOfUsePanel /> : null}
      {tab === 'amka' ? <AmkaCompliancePanel /> : null}
      {tab === 'backup' ? <BackupPanel /> : null}
    </div>
  );
}
