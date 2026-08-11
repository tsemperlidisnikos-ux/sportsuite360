import { useEffect, useMemo, useState } from 'react';
import {
  getClubById,
  getClubViva,
  updateClubViva,
  VIVA_WEBHOOK_URL,
  type ClubVivaSettings,
} from '../auth/clubs';
import { Button } from './ui/Button';

type Props = {
  clubId: string;
};

export function ClubVivaPanel({ clubId }: Props) {
  const club = getClubById(clubId);
  const [form, setForm] = useState<ClubVivaSettings>(() => getClubViva(clubId));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const successUrlHint = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://your-domain';
    return `${origin}/fees`;
  }, []);

  useEffect(() => {
    setForm(getClubViva(clubId));
    setMessage('');
    setError('');
  }, [clubId]);

  function setField<K extends keyof ClubVivaSettings>(key: K, value: ClubVivaSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    const result = updateClubViva(clubId, form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setForm(getClubViva(clubId));
    setMessage('Οι ρυθμίσεις Viva Wallet αποθηκεύτηκαν για τον σύλλογο.');
  }

  return (
    <section className="panel club-email-panel club-viva-panel">
      <div className="club-email-head">
        <div>
          <h2>Viva Wallet</h2>
          <p className="club-email-banner">
            Συνδέστε Client ID, Client Secret και Source Code από το Viva banking app για online
            πληρωμές (Smart Checkout) του συλλόγου «{club?.name ?? '—'}».
          </p>
          <p className="club-email-banner club-viva-info">
            Webhook URL: <code>{VIVA_WEBHOOK_URL}</code>
          </p>
          <p className="club-email-banner club-viva-info">
            Στο Viva payment source, ορίστε Success URL:{' '}
            <code>{successUrlHint}</code> (επιστρέφει ?t=transactionid).
          </p>
        </div>
      </div>

      <label className="checkbox-row club-email-enabled">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setField('enabled', e.target.checked)}
        />
        <span>Ενεργές online πληρωμές Viva</span>
      </label>

      <div className="club-email-grid">
        <label className="field">
          <span className="field-label">Client ID</span>
          <input
            className="field-input"
            value={form.clientId}
            onChange={(e) => setField('clientId', e.target.value)}
            placeholder="Client ID"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">Client Secret</span>
          <input
            className="field-input"
            type="password"
            value={form.clientSecret}
            onChange={(e) => setField('clientSecret', e.target.value)}
            placeholder="Client Secret"
            autoComplete="new-password"
          />
        </label>

        <label className="field">
          <span className="field-label">Merchant ID (προαιρετικό)</span>
          <input
            className="field-input"
            value={form.merchantId}
            onChange={(e) => setField('merchantId', e.target.value)}
            placeholder="Merchant ID"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">Source Code (4 ψηφία)</span>
          <input
            className="field-input"
            value={form.sourceCode}
            onChange={(e) =>
              setField('sourceCode', e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="π.χ. 1234"
            inputMode="numeric"
            maxLength={4}
          />
        </label>

        <label className="field">
          <span className="field-label">Περιβάλλον</span>
          <select
            className="field-input"
            value={form.environment}
            onChange={(e) =>
              setField('environment', e.target.value as ClubVivaSettings['environment'])
            }
          >
            <option value="demo">Demo / δοκιμή</option>
            <option value="live">Live / παραγωγή</option>
          </select>
        </label>
      </div>

      <div className="club-email-actions">
        <Button type="button" disabled={saving} onClick={handleSave}>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </Button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}
    </section>
  );
}
