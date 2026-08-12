import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ClipboardCopy, ImagePlus, Trash2 } from 'lucide-react';
import * as publicClubCloudService from '../api/services/publicClubCloudService';
import {
  getClubById,
  getClubPublicRegistration,
  updateClubPublicRegistration,
  type ClubPublicRegistrationSettings,
} from '../auth/clubs';
import { Button } from './ui/Button';

const MAX_HERO_BYTES = 700_000;

type Props = {
  clubId: string;
};

export function ClubPublicRegistrationPanel({ clubId }: Props) {
  const club = getClubById(clubId);
  const [form, setForm] = useState<ClubPublicRegistrationSettings>(() =>
    getClubPublicRegistration(clubId),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(getClubPublicRegistration(clubId));
    setMessage('');
    setError('');
  }, [clubId]);

  const joinPath = useMemo(() => {
    const slug = form.slug.trim() || 'club';
    return `/join/${slug}`;
  }, [form.slug]);

  const joinUrl = useMemo(() => {
    if (typeof window === 'undefined') return joinPath;
    return `${window.location.origin}${joinPath}`;
  }, [joinPath]);

  const heroPreview = form.heroImageUrl || club?.logoUrl || null;

  function setField<K extends keyof ClubPublicRegistrationSettings>(
    key: K,
    value: ClubPublicRegistrationSettings[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    const result = updateClubPublicRegistration(clubId, {
      ...form,
      notifyEmail: form.notifyEmail ?? '',
    });
    if (!result.success) {
      setSaving(false);
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setForm(getClubPublicRegistration(clubId));
    const publish = await publicClubCloudService.publishPublicClubCloud(clubId);
    setSaving(false);
    if (!publish.success) {
      setMessage(
        'Οι ρυθμίσεις αποθηκεύτηκαν τοπικά. Cloud δημοσίευση απέτυχε — δοκιμάστε ξανά στο live (Vercel) με Redis.',
      );
      setError(publish.error ?? '');
      return;
    }
    setMessage(
      publish.data?.durable
        ? 'Αποθηκεύτηκε και δημοσιεύτηκε στο cloud. Το /join είναι διαθέσιμο από οποιαδήποτε συσκευή.'
        : 'Αποθηκεύτηκε. Cloud χωρίς Redis — το /join από άλλες συσκευές μπορεί να μην είναι διαθέσιμο.',
    );
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(joinUrl).then(
      () => setMessage('Ο σύνδεσμος αντιγράφηκε.'),
      () => setError('Αδυναμία αντιγραφής συνδέσμου.'),
    );
  }

  function handleHeroFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Επιλέξτε εικόνα (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > MAX_HERO_BYTES) {
      setError('Η φωτογραφία πρέπει να είναι έως ~700KB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setField('heroImageUrl', String(reader.result ?? ''));
      setMessage('Η φωτογραφία φόρμας ενημερώθηκε — πατήστε Αποθήκευση.');
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="panel settings-panel public-reg-panel">
      <h3>Δημόσια εγγραφή αθλητή</h3>

      <div className="public-reg-info">
        <span className="public-reg-info-icon" aria-hidden>
          i
        </span>
        <p>
          Ενεργοποίησε τη φόρμα και μοιράσου το link σε γονείς/αθλητές. Οι αιτήσεις εγκρίνονται από
          το προσωπικό.
        </p>
      </div>

      <label className="public-reg-check">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setField('enabled', e.target.checked)}
        />
        <span>Ενεργή δημόσια εγγραφή</span>
      </label>

      <label className="public-reg-check">
        <input
          type="checkbox"
          checked={form.autoApprove}
          onChange={(e) => setField('autoApprove', e.target.checked)}
        />
        <span>Άμεση εμφάνιση στη λίστα αθλητών</span>
      </label>

      <div className="public-reg-info">
        <span className="public-reg-info-icon" aria-hidden>
          i
        </span>
        <p>
          Αν είναι ενεργό, ο αθλητής προστίθεται αμέσως μετά τη φόρμα. Αν όχι, χρειάζεται έγκριση από
          Αθλητές.
        </p>
      </div>

      <label className="public-reg-check">
        <input
          type="checkbox"
          checked={form.allowTrial}
          onChange={(e) => setField('allowTrial', e.target.checked)}
        />
        <span>Δοκιμαστική προπόνηση στη δημόσια εγγραφή</span>
      </label>

      <label className="public-reg-check">
        <input
          type="checkbox"
          checked={form.allowWaitlist}
          onChange={(e) => setField('allowWaitlist', e.target.checked)}
        />
        <span>Λίστα αναμονής στη δημόσια εγγραφή</span>
      </label>

      <div className="public-reg-info">
        <span className="public-reg-info-icon" aria-hidden>
          i
        </span>
        <p>
          Όταν γεμίσει ένα τμήμα ή επιλεγεί λίστα αναμονής, οι αιτήσεις μπαίνουν σε σειρά.
        </p>
      </div>

      <label className="field">
        <span className="field-label">Σύνδεσμος (slug)</span>
        <input
          className="field-input"
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value.toLowerCase())}
          placeholder="π.χ. promitheas-patras"
        />
      </label>

      <div className="public-reg-info">
        <span className="public-reg-info-icon" aria-hidden>
          i
        </span>
        <p>
          Το URL θα είναι <code>/join/{'{slug}'}</code>. Αν μείνει κενό, δημιουργείται αυτόματα.
        </p>
      </div>

      <div className="public-reg-link-row">
        <code className="public-reg-link">{joinUrl}</code>
        <Button type="button" variant="secondary" onClick={handleCopyLink}>
          <ClipboardCopy size={16} /> Αντιγραφή
        </Button>
        <a className="text-link" href={joinPath} target="_blank" rel="noreferrer">
          Προεπισκόπηση →
        </a>
      </div>

      <label className="field">
        <span className="field-label">Email ειδοποίησης νέας αίτησης</span>
        <input
          className="field-input"
          type="email"
          value={form.notifyEmail ?? ''}
          onChange={(e) => setField('notifyEmail', e.target.value)}
          placeholder="π.χ. admin@club.gr"
        />
      </label>
      <div className="public-reg-info">
        <span className="public-reg-info-icon" aria-hidden>
          i
        </span>
        <p>
          Αν το SMTP είναι ενεργό στις Ρυθμίσεις → Email, στέλνεται ειδοποίηση σε αυτό το address
          και επιβεβαίωση στον κηδεμόνα (αν δόθηκε email). Αν μείνει κενό, χρησιμοποιείται το email
          του διαχειριστή ή το SMTP username. Μετά την Αποθήκευση η φόρμα δημοσιεύεται στο cloud.
        </p>
      </div>

      <div className="public-reg-photo">
        <h4>Φωτογραφία φόρμας εγγραφής</h4>
        <p className="lede">
          Εμφανίζεται στην κεφαλίδα του δημόσιου συνδέσμου. Αν δεν οριστεί, χρησιμοποιείται το logo
          συλλόγου.
        </p>
        <div className="public-reg-photo-row">
          <div className="public-reg-photo-preview">
            {heroPreview ? (
              <img src={heroPreview} alt={`Φόρμα ${club?.name ?? ''}`} />
            ) : (
              <span>Χωρίς φωτογραφία</span>
            )}
          </div>
          <div className="public-reg-photo-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={handleHeroFile}
            />
            <Button type="button" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={16} /> Ανέβασμα φωτογραφίας
            </Button>
            {form.heroImageUrl ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setField('heroImageUrl', null);
                  setMessage('Η φωτογραφία αφαιρέθηκε — πατήστε Αποθήκευση.');
                }}
              >
                <Trash2 size={16} /> Αφαίρεση
              </Button>
            ) : null}
            <p className="settings-hint">JPG / PNG / WEBP · έως ~700KB · οριζόντια αναλογία ιδανική</p>
          </div>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      <Button type="button" disabled={saving} onClick={handleSave}>
        {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
      </Button>
    </section>
  );
}
