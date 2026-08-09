import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../auth/auth';
import { registerClub } from '../auth/clubs';

export function RegisterClubPage() {
  const navigate = useNavigate();
  const [clubName, setClubName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = registerClub({
      clubName,
      city,
      phone,
      adminFullName,
      email,
      password,
      confirmPassword,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία εγγραφής');
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="login-page">
      <form className="login-card login-card-wide" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark">AH</span>
          <div>
            <strong>AcademyHub</strong>
            <span>Νέα εγγραφή συλλόγου</span>
          </div>
        </div>

        <label>
          <span>Όνομα συλλόγου</span>
          <input
            type="text"
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            placeholder="π.χ. Α.Σ. ΑΠΟΛΛΩΝΙΑΔΑ"
            required
          />
        </label>

        <div className="login-grid-2">
          <label>
            <span>Πόλη</span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <label>
            <span>Τηλέφωνο συλλόγου</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>

        <label>
          <span>Ονοματεπώνυμο διαχειριστή</span>
          <input
            type="text"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
            required
          />
        </label>

        <label>
          <span>Email διαχειριστή</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <div className="login-grid-2">
          <label>
            <span>Κωδικός</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Επιβεβαίωση κωδικού</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="login-submit" disabled={saving}>
          {saving ? 'Εγγραφή...' : 'Εγγραφή συλλόγου'}
        </button>

        <p className="login-footer-link">
          Έχετε ήδη λογαριασμό; <Link to="/login">Σύνδεση</Link>
        </p>
      </form>
    </div>
  );
}
