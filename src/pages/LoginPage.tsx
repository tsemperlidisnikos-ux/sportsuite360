import { type FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getSession, isAuthenticated, login } from '../auth/auth';
import { enterDemoPresentation, getDemoLoginHint } from '../auth/demoAccess';
import { clearDataCache } from '../data/repository';
import { endPreview, getAppLogoUrl, getAppName } from '../platform/platformConfig';

function homeForRole(role?: string) {
  if (role === 'platform_admin') return '/platform';
  return '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const appName = useMemo(() => getAppName(), []);
  const appLogoUrl = useMemo(() => getAppLogoUrl(), []);
  const demoHint = useMemo(() => getDemoLoginHint(), []);

  if (isAuthenticated()) {
    const role = getSession()?.role;
    return <Navigate to={homeForRole(role)} replace />;
  }

  async function completeLogin(result: Awaited<ReturnType<typeof login>>) {
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία σύνδεσης');
      return;
    }
    endPreview();
    clearDataCache();
    window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));

    if (result.data?.clubId || result.data?.role === 'platform_admin') {
      const { syncClubOnLogin } = await import('../data/clubSync');
      await syncClubOnLogin(result.data?.clubId ?? null);
      clearDataCache();
      try {
        const { runDueFeeGenerations } = await import('../api/services/feeChargesService');
        await runDueFeeGenerations();
      } catch {
        /* best-effort auto fees */
      }
    }

    if (result.data?.role === 'platform_admin') {
      navigate('/platform', { replace: true });
      return;
    }
    const target = from && from !== '/login' ? from : '/';
    navigate(target, { replace: true });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await login(email, password);
    await completeLogin(result);
    setSaving(false);
  }

  async function handleEnterDemo() {
    setDemoLoading(true);
    setError('');
    const result = await enterDemoPresentation();
    setDemoLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία εισόδου DEMO');
      return;
    }
    navigate('/', { replace: true });
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

        <button type="submit" className="login-submit" disabled={saving || demoLoading}>
          {saving ? 'Σύνδεση...' : 'Σύνδεση'}
        </button>

        <div className="login-demo-block">
          <button
            type="button"
            className="login-submit login-submit-secondary"
            disabled={saving || demoLoading}
            onClick={() => void handleEnterDemo()}
          >
            {demoLoading ? 'Φόρτωση DEMO…' : 'Είσοδος DEMO παρουσίασης'}
          </button>
          <p className="login-demo-hint">
            Σύλλογος DEMO με πλήρη δείγματα · {demoHint.email} / {demoHint.password}
          </p>
        </div>

        <p className="login-footer-link">
          Δεν έχετε λογαριασμό; <Link to="/register">Εγγραφή συλλόγου</Link>
        </p>
      </form>
    </div>
  );
}
