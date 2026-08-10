import { type FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, isPlatformAdmin, login } from '../auth/auth';
import { endPreview, getAppLogoUrl, getAppName } from '../platform/platformConfig';

function homeForRole(role?: string) {
  return role === 'platform_admin' ? '/platform' : '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const appName = useMemo(() => getAppName(), []);
  const appLogoUrl = useMemo(() => getAppLogoUrl(), []);

  if (isAuthenticated()) {
    return <Navigate to={homeForRole(isPlatformAdmin() ? 'platform_admin' : 'admin')} replace />;
  }

  function completeLogin(result: ReturnType<typeof login>) {
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία σύνδεσης');
      return;
    }
    if (result.data?.role === 'platform_admin') {
      endPreview();
      navigate('/platform', { replace: true });
      return;
    }
    const target = from && from !== '/login' ? from : '/';
    navigate(target, { replace: true });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = login(email, password);
    setSaving(false);
    completeLogin(result);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          {appLogoUrl ? (
            <img className="login-brand-logo" src={appLogoUrl} alt={appName} />
          ) : (
            <span className="brand-mark">SS</span>
          )}
          <div>
            <strong>{appName}</strong>
            <span>Σύνδεση διαχειριστή</span>
          </div>
        </div>

        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Κωδικός</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="login-submit" disabled={saving}>
          {saving ? 'Σύνδεση...' : 'Σύνδεση'}
        </button>

        <p className="login-footer-link">
          Δεν έχετε λογαριασμό; <Link to="/register">Εγγραφή συλλόγου</Link>
        </p>
      </form>
    </div>
  );
}
