import { useState, type FormEvent } from 'react';
import { changePassword } from '../auth/auth';
import { Button } from './ui/Button';

export function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const result = changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα ενημέρωσης κωδικού');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Ο κωδικός ενημερώθηκε.');
  }

  return (
    <section className="panel change-password-panel">
      <h2>Αλλαγή κωδικού</h2>
      <form className="change-password-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Τρέχων κωδικός</span>
          <input
            className="field-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Τρέχων"
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span className="field-label">Νέος κωδικός</span>
          <input
            className="field-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Νέος"
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span className="field-label">Επιβεβαίωση</span>
          <input
            className="field-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Επιβεβαίωση"
            autoComplete="new-password"
          />
        </label>

        <div className="change-password-actions">
          <Button type="submit" disabled={saving}>
            {saving ? 'Ενημέρωση…' : 'Ενημέρωση'}
          </Button>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="settings-success">{message}</p> : null}
      </form>
    </section>
  );
}
