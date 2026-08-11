import { useRef, useState, type ChangeEvent } from 'react';
import {
  Building2,
  CreditCard,
  Database,
  FileText,
  ImagePlus,
  KeyRound,
  Mail,
  Ruler,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { getSession } from '../auth/auth';
import { getClubById, updateClubLogo } from '../auth/clubs';
import { BackupPanel } from '../components/BackupPanel';
import { ChangePasswordPanel } from '../components/ChangePasswordPanel';
import { ClubEmailPanel } from '../components/ClubEmailPanel';
import { ClubUsersPanel } from '../components/ClubUsersPanel';
import { ClubVivaPanel } from '../components/ClubVivaPanel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { SizeChartPanel } from '../components/SizeChartPanel';
import { getPreviewClubId } from '../platform/platformConfig';
import { AssociationsPage } from './AssociationsPage';
import { SportsPage } from './SportsPage';
import { TermsOfUsePanel } from './TermsOfUsePanel';

const MAX_LOGO_BYTES = 500_000;

type SettingsTab =
  | 'appearance'
  | 'users'
  | 'password'
  | 'associations'
  | 'sports'
  | 'sizes'
  | 'email'
  | 'viva'
  | 'terms'
  | 'backup';

export function SettingsPage() {
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;
  const [club, setClub] = useState(() => getClubById(clubId));
  const [tab, setTab] = useState<SettingsTab>('appearance');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canManageUsers = session?.role === 'admin' || session?.role === 'platform_admin';

  function refreshClub() {
    setClub(getClubById(clubId));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !clubId) return;

    if (!file.type.startsWith('image/')) {
      setError('Επιλέξτε εικόνα (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Η εικόνα πρέπει να είναι έως ~500KB.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    const reader = new FileReader();
    reader.onerror = () => {
      setSaving(false);
      setError('Αποτυχία ανάγνωσης αρχείου.');
    };
    reader.onload = () => {
      const logoUrl = String(reader.result ?? '');
      const result = updateClubLogo(clubId, logoUrl);
      setSaving(false);
      if (!result.success) {
        setError(result.error ?? 'Σφάλμα αποθήκευσης');
        return;
      }
      setMessage('Το logo αποθηκεύτηκε.');
      refreshClub();
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    if (!clubId) return;
    if (!confirm('Αφαίρεση logo συλλόγου;')) return;
    setSaving(true);
    setError('');
    const result = updateClubLogo(clubId, null);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα διαγραφής');
      return;
    }
    setMessage('Το logo αφαιρέθηκε.');
    refreshClub();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Ρυθμίσεις"
        subtitle="Εμφάνιση συλλόγου, χρήστες, κωδικός, email, Viva, σωματείο, αθλήματα, μεγεθολόγιο, όροι χρήσης και backup."
      />

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'appearance' ? 'active' : ''}`}
          onClick={() => setTab('appearance')}
        >
          Logo συλλόγου
        </button>
        {canManageUsers ? (
          <button
            type="button"
            className={`tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <Users size={15} /> Χρήστες
          </button>
        ) : null}
        <button
          type="button"
          className={`tab ${tab === 'password' ? 'active' : ''}`}
          onClick={() => setTab('password')}
        >
          <KeyRound size={15} /> Αλλαγή κωδικού
        </button>
        <button
          type="button"
          className={`tab ${tab === 'email' ? 'active' : ''}`}
          onClick={() => setTab('email')}
        >
          <Mail size={15} /> Email συλλόγου
        </button>
        <button
          type="button"
          className={`tab ${tab === 'viva' ? 'active' : ''}`}
          onClick={() => setTab('viva')}
        >
          <CreditCard size={15} /> Viva Wallet
        </button>
        <button
          type="button"
          className={`tab ${tab === 'associations' ? 'active' : ''}`}
          onClick={() => setTab('associations')}
        >
          <Building2 size={15} /> Σωματείο
        </button>
        <button
          type="button"
          className={`tab ${tab === 'sports' ? 'active' : ''}`}
          onClick={() => setTab('sports')}
        >
          <Trophy size={15} /> Άθλημα
        </button>
        <button
          type="button"
          className={`tab ${tab === 'sizes' ? 'active' : ''}`}
          onClick={() => setTab('sizes')}
        >
          <Ruler size={15} /> Μεγεθολόγιο
        </button>
        <button
          type="button"
          className={`tab ${tab === 'terms' ? 'active' : ''}`}
          onClick={() => setTab('terms')}
        >
          <FileText size={15} /> Όροι χρήσης
        </button>
        <button
          type="button"
          className={`tab ${tab === 'backup' ? 'active' : ''}`}
          onClick={() => setTab('backup')}
        >
          <Database size={15} /> BACKUP
        </button>
      </div>

      {tab === 'appearance' ? (
        !clubId || !club ? (
          <p className="form-error">Δεν βρέθηκε σύλλογος για τον λογαριασμό.</p>
        ) : (
          <section className="panel settings-panel">
            <h3>Logo συλλόγου</h3>
            <p className="lede">
              Το logo εμφανίζεται στο μενού, πάνω από την ενότητα «Ακαδημία».
            </p>

            <div className="settings-logo-row">
              <div className="settings-logo-preview">
                {club.logoUrl ? (
                  <img src={club.logoUrl} alt={`Logo ${club.name}`} />
                ) : (
                  <span>Χωρίς logo</span>
                )}
              </div>

              <div className="settings-logo-actions">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={16} /> Ανέβασμα φωτογραφίας
                </Button>
                {club.logoUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 size={16} /> Αφαίρεση
                  </Button>
                ) : null}
                <p className="settings-hint">JPG / PNG / WEBP · έως ~500KB</p>
              </div>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {message ? <p className="settings-success">{message}</p> : null}
          </section>
        )
      ) : null}

      {tab === 'users' && clubId ? <ClubUsersPanel clubId={clubId} /> : null}
      {tab === 'password' ? <ChangePasswordPanel /> : null}
      {tab === 'email' ? (
        !clubId ? (
          <p className="form-error">Δεν βρέθηκε σύλλογος για τον λογαριασμό.</p>
        ) : (
          <ClubEmailPanel clubId={clubId} />
        )
      ) : null}
      {tab === 'viva' ? (
        !clubId ? (
          <p className="form-error">Δεν βρέθηκε σύλλογος για τον λογαριασμό.</p>
        ) : (
          <ClubVivaPanel clubId={clubId} />
        )
      ) : null}
      {tab === 'associations' ? <AssociationsPage /> : null}
      {tab === 'sports' ? <SportsPage /> : null}
      {tab === 'sizes' ? <SizeChartPanel /> : null}
      {tab === 'terms' ? <TermsOfUsePanel /> : null}
      {tab === 'backup' ? <BackupPanel /> : null}
    </div>
  );
}
