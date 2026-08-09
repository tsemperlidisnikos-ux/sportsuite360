import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { getSession } from '../auth/auth';
import { getClubById, updateClubLogo } from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { getPreviewClubId } from '../platform/platformConfig';

const MAX_LOGO_BYTES = 500_000;

export function SettingsPage() {
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;
  const [club, setClub] = useState(() => getClubById(clubId));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  if (!clubId || !club) {
    return (
      <div className="stack-lg">
        <PageHeader title="Ρυθμίσεις" subtitle="Ρυθμίσεις συλλόγου." />
        <p className="form-error">Δεν βρέθηκε σύλλογος για τον λογαριασμό.</p>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Ρυθμίσεις"
        subtitle="Εμφάνιση και στοιχεία συλλόγου."
      />

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
    </div>
  );
}
