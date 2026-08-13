import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '../api/services/sessionService';
import { getSession, isAuthenticated, login } from '../auth/auth';
import { enterDemoPresentation, getDemoLoginHint, getDemoRoleHints } from '../auth/demoAccess';
import { clearDataCache } from '../data/repository';
import { endPreview, getAppLogoUrl, getAppName } from '../platform/platformConfig';

function homeForRole(role?: string) {
  if (role === 'platform_admin') return '/platform';
  return '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const appName = useMemo(() => getAppName(), []);
  const appLogoUrl = useMemo(() => getAppLogoUrl(), []);
  const demoHint = useMemo(() => getDemoLoginHint(), []);
  const demoRoles = useMemo(() => getDemoRoleHints(), []);

  useEffect(() => {
    const token = searchParams.get('reset')?.trim();
    if (!token) return;
    setResetToken(token);
    setShowReset(true);
    setInfo('Ορίστε νέο κωδικό για να ολοκληρώσετε την επαναφορά από το email.');
    const next = new URLSearchParams(searchParams);
    next.delete('reset');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
    setInfo('');
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

  async function handleForgot() {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Συμπληρώστε το email για επαναφορά.');
      return;
    }
    setSaving(true);
    const result = await requestPasswordReset(email.trim());
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία αιτήματος');
      return;
    }
    setInfo(result.data?.message ?? 'Ελέγξτε το email σας για οδηγίες επαναφοράς.');
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!resetToken.trim() || newPassword.trim().length < 6) {
      setError('Απαιτείται σύνδεσμος επαναφοράς και νέος κωδικός (τουλάχιστον 6 χαρακτήρες).');
      return;
    }
    setSaving(true);
    const result = await resetPasswordWithToken(resetToken.trim(), newPassword.trim());
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία επαναφοράς');
      return;
    }
    setInfo('Ο κωδικός άλλαξε. Συνδεθείτε με τον νέο κωδικό.');
    setShowReset(false);
    setPassword('');
    setNewPassword('');
    setResetToken('');
    if (result.data?.email) setEmail(result.data.email);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={showReset ? handleReset : handleSubmit}>
        <div className="login-brand">
          {appLogoUrl ? (
            <img className="login-brand-logo" src={appLogoUrl} alt={appName} />
          ) : (
            <span className="brand-mark">SS</span>
          )}
          <div>
            <strong>{appName}</strong>
            <span>{showReset ? 'Νέος κωδικός' : 'Σύνδεση διαχειριστή'}</span>
          </div>
        </div>

        {!showReset ? (
          <>
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
          </>
        ) : (
          <>
            <label>
              <span>Νέος κωδικός</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <p className="login-demo-hint">Ο σύνδεσμος από το email ισχύει για 1 ώρα.</p>
          </>
        )}

        {error ? <p className="form-error">{error}</p> : null}
        {info ? <p className="settings-success">{info}</p> : null}

        <button type="submit" className="login-submit" disabled={saving || demoLoading}>
          {saving
            ? 'Αναμονή...'
            : showReset
              ? 'Αποθήκευση νέου κωδικού'
              : 'Σύνδεση'}
        </button>

        {!showReset ? (
          <p className="login-footer-link">
            <button
              type="button"
              className="linkish"
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              onClick={() => void handleForgot()}
              disabled={saving}
            >
              Ξέχασα τον κωδικό
            </button>
          </p>
        ) : (
          <p className="login-footer-link">
            <button
              type="button"
              className="linkish"
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              onClick={() => {
                setShowReset(false);
                setResetToken('');
                setNewPassword('');
              }}
            >
              Επιστροφή στη σύνδεση
            </button>
          </p>
        )}

        {!showReset ? (
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
            <p className="login-demo-hint">
              Ρόλοι:{' '}
              {demoRoles.map((r) => `${r.role} ${r.email}`).join(' · ')} (κωδικός{' '}
              {demoHint.password})
            </p>
          </div>
        ) : null}

        <p className="login-footer-link">
          Δεν έχετε λογαριασμό; <Link to="/register">Εγγραφή συλλόγου</Link>
        </p>
      </form>
    </div>
  );
}
