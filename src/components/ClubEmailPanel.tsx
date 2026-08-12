import { useEffect, useState } from 'react';
import { BookOpen, History, Send } from 'lucide-react';
import * as emailService from '../api/services/emailService';
import * as publicClubCloudService from '../api/services/publicClubCloudService';
import {
  getClubById,
  getClubSmtp,
  getClubSmtpSendLog,
  updateClubSmtp,
  type ClubSmtpSettings,
} from '../auth/clubs';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

type Props = {
  clubId: string;
};

export function ClubEmailPanel({ clubId }: Props) {
  const club = getClubById(clubId);
  const [form, setForm] = useState<ClubSmtpSettings>(() => getClubSmtp(clubId));
  const [testTo, setTestTo] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => getClubSmtpSendLog(clubId));

  useEffect(() => {
    setForm(getClubSmtp(clubId));
    setHistory(getClubSmtpSendLog(clubId));
    setMessage('');
    setError('');
  }, [clubId]);

  function setField<K extends keyof ClubSmtpSettings>(key: K, value: ClubSmtpSettings[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'provider' && value === 'gmail') {
        next.host = next.host.trim() || 'smtp.gmail.com';
        next.port = next.port.trim() || '587';
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    const result = updateClubSmtp(clubId, form);
    if (!result.success) {
      setSaving(false);
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setForm(getClubSmtp(clubId));
    const publish = await publicClubCloudService.publishPublicClubCloud(clubId);
    setSaving(false);
    if (!publish.success) {
      setMessage('Οι ρυθμίσεις email αποθηκεύτηκαν τοπικά. Cloud sync ειδοποιήσεων απέτυχε.');
      return;
    }
    setMessage('Οι ρυθμίσεις email συλλόγου αποθηκεύτηκαν και συγχρονίστηκαν για δημόσια εγγραφή.');
  }

  async function handleTestSend() {
    setError('');
    setMessage('');
    const to = testTo.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setError('Συμπληρώστε έγκυρο παραλήπτη δοκιμής.');
      return;
    }

    const current = getClubSmtp(clubId);
    if (!current.enabled) {
      setError('Ενεργοποιήστε το SMTP και αποθηκεύστε πριν τη δοκιμή.');
      return;
    }
    if (!current.host || !current.port || !current.username || !current.password) {
      setError('Αποθηκεύστε πλήρεις ρυθμίσεις SMTP πριν τη δοκιμή.');
      return;
    }

    setTesting(true);
    const result = await emailService.sendClubEmail({
      clubId,
      to,
      subject: `Δοκιμή SMTP — ${club?.name ?? 'SPORTSUITE 360'}`,
      text: `Αυτό είναι δοκιμαστικό μήνυμα από το SportSuite 360 για τον σύλλογο «${club?.name ?? '—'}».\n\nΑν το λαμβάνετε, οι ρυθμίσεις SMTP λειτουργούν.`,
    });
    setTesting(false);
    setHistory(getClubSmtpSendLog(clubId));
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία αποστολής');
      return;
    }
    setMessage(`Το δοκιμαστικό email στάλθηκε επιτυχώς στο ${to}.`);
  }

  return (
    <section className="panel club-email-panel">
      <div className="club-email-head">
        <div>
          <h2>Email συλλόγου (Gmail/SMTP)</h2>
          <p className="club-email-banner">
            Σύνδεσε Gmail μέσω App Password ή άλλο SMTP για προσκλήσεις, υπενθυμίσεις και
            αποδείξεις του συλλόγου «{club?.name ?? '—'}».
          </p>
          <p className="club-email-banner club-viva-info">
            Η πραγματική αποστολή γίνεται μέσω του production API (`/api/send-email`). Σε τοπικό
            `npm run dev` η δοκιμή θα αποτύχει μέχρι να κάνετε deploy στο Vercel.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setShowHelp(true)}>
          <BookOpen size={15} /> Οδηγίες ρύθμισης
        </Button>
      </div>

      <label className="checkbox-row club-email-enabled">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setField('enabled', e.target.checked)}
        />
        <span>Ενεργό SMTP συλλόγου</span>
      </label>

      <div className="club-email-grid">
        <label className="field">
          <span className="field-label">Πάροχος</span>
          <select
            className="field-input"
            value={form.provider}
            onChange={(e) =>
              setField('provider', e.target.value as ClubSmtpSettings['provider'])
            }
          >
            <option value="gmail">Gmail</option>
            <option value="custom">Προσαρμοσμένο SMTP</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">SMTP Host</span>
          <input
            className="field-input"
            value={form.host}
            onChange={(e) => setField('host', e.target.value)}
            placeholder="SMTP host"
          />
        </label>

        <label className="field">
          <span className="field-label">Port</span>
          <input
            className="field-input"
            value={form.port}
            onChange={(e) => setField('port', e.target.value)}
            placeholder="587"
          />
          <span className="settings-hint">
            587 → STARTTLS (recommended). 465 → SSL. Do not mix SSL with 587.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Email / username</span>
          <input
            className="field-input"
            type="email"
            value={form.username}
            onChange={(e) => setField('username', e.target.value)}
            placeholder="Email / username"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="field-label">App Password / κωδικός SMTP</span>
          <input
            className="field-input"
            type="password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder="App Password / κωδικός SMTP"
            autoComplete="new-password"
          />
          <span className="settings-hint">
            Στο Gmail χρησιμοποίησε App Password 16 χαρακτήρων από Google Security — όχι τον
            κανονικό κωδικό.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Αποστολέας (From)</span>
          <input
            className="field-input"
            value={form.fromName}
            onChange={(e) => setField('fromName', e.target.value)}
            placeholder="Αποστολέας (From)"
          />
          <span className="settings-hint">
            Το όνομα είναι προαιρετικό (π.χ. «{club?.name ?? 'Όνομα συλλόγου'}»). Ως διεύθυνση
            χρησιμοποιείται το email του λογαριασμού.
          </span>
        </label>
      </div>

      <div className="club-email-actions">
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </Button>
      </div>

      <div className="club-email-test">
        <p>Στείλε δοκιμαστικό μήνυμα για επαλήθευση</p>
        <div className="club-email-test-row">
          <input
            className="field-input"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Παραλήπτης δοκιμής"
          />
          <Button type="button" disabled={testing} onClick={() => void handleTestSend()}>
            <Send size={15} /> {testing ? 'Αποστολή…' : 'Αποστολή δοκιμής'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowHistory(true)}>
            <History size={15} /> Ιστορικό αποστολών
          </Button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      <Modal
        open={showHelp}
        title="Οδηγίες ρύθμισης Gmail / SMTP"
        onClose={() => setShowHelp(false)}
        footer={
          <Button type="button" onClick={() => setShowHelp(false)}>
            Κλείσιμο
          </Button>
        }
      >
        <div className="stack-md">
          <p>
            1. Άνοιξε τον λογαριασμό Google → Ασφάλεια → Επαλήθευση σε 2 βήματα (πρέπει να είναι
            ενεργή).
          </p>
          <p>2. Δημιούργησε App Password για «Mail» / «Άλλη εφαρμογή».</p>
          <p>3. Επικόλλησε το App Password 16 χαρακτήρων στο πεδίο κωδικού (όχι τον κανονικό κωδικό).</p>
          <p>
            4. Host: <code>smtp.gmail.com</code>, Port: <code>587</code> (STARTTLS).
          </p>
          <p>5. Ενεργοποίησε «Ενεργό SMTP συλλόγου» και πάτα Αποθήκευση.</p>
          <p>6. Κάνε deploy στο Vercel και δοκίμασε «Αποστολή δοκιμής» από το production.</p>
          <p className="muted">
            Οι ρυθμίσεις αποθηκεύονται μόνο για αυτόν τον σύλλογο και δεν επηρεάζουν άλλους
            συλλόγους.
          </p>
        </div>
      </Modal>

      <Modal
        open={showHistory}
        title="Ιστορικό αποστολών"
        onClose={() => setShowHistory(false)}
        wide
        footer={
          <Button type="button" variant="secondary" onClick={() => setShowHistory(false)}>
            Κλείσιμο
          </Button>
        }
      >
        {history.length === 0 ? (
          <p className="muted">Δεν υπάρχουν αποστολές ακόμα.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ημ/νία</th>
                  <th>Παραλήπτης</th>
                  <th>Κατάσταση</th>
                  <th>Μήνυμα</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.at.replace('T', ' ').slice(0, 19)}</td>
                    <td>{item.to}</td>
                    <td>{item.status === 'ok' ? 'OK' : 'Σφάλμα'}</td>
                    <td>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </section>
  );
}
