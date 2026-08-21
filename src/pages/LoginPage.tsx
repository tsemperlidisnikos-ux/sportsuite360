import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
} from 'lucide-react';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '../api/services/sessionService';
import { getSession, isAuthenticated, isPresentationDemoEmail, login } from '../auth/auth';
import { enterDemoPresentation, getDemoLoginHint, getDemoRoleHints } from '../auth/demoAccess';
import { clearDataCache } from '../data/repository';
import {
  endPreview,
  getAppearanceTheme,
  getAppLogoUrl,
  getAppName,
} from '../platform/platformConfig';

const REMEMBER_KEY = 'academyhub-login-remember-email-v1';

function homeForRole(role?: string) {
  if (role === 'platform_admin') return '/platform';
  return '/';
}

function splitAppName(name: string): { title: string; accent: string } {
  const trimmed = name.trim() || 'SPORTSUITE 360';
  if (/\s*360\s*$/i.test(trimmed)) {
    return {
      title: trimmed.replace(/\s*360\s*$/i, '').trim() || 'SPORTSUITE',
      accent: '360',
    };
  }
  return { title: trimmed, accent: '360' };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [appearance, setAppearance] = useState(() => getAppearanceTheme());
  const [appName, setAppName] = useState(() => getAppName());
  const [appLogoUrl, setAppLogoUrl] = useState(() => getAppLogoUrl());
  const brand = useMemo(() => splitAppName(appName), [appName]);

  const demoHint = useMemo(() => getDemoLoginHint(), []);
  const demoRoles = useMemo(() => getDemoRoleHints(), []);
  const useSplitLogin =
    appearance === 'navy-amber' ||
    appearance === 'midnight-ice' ||
    appearance === 'ocean-slate' ||
    appearance === 'indigo-steel' ||
    appearance === 'pitch-heritage' ||
    appearance === 'graphite-ember';

  const heroTagline =
    appearance === 'navy-amber'
      ? 'Οργάνωση. Απόδοση. Εξέλιξη.'
      : appearance === 'midnight-ice'
        ? 'One Suite. Every Sport. Total Control.'
        : appearance === 'indigo-steel'
          ? 'One Platform. Every Sport. Total Control.'
          : appearance === 'pitch-heritage'
            ? 'Παράδοση. Γήπεδο. Ομάδα.'
            : appearance === 'graphite-ember'
              ? 'Match day. Total control.'
              : 'Η ολοκληρωμένη πλατφόρμα διαχείρισης για αθλητικούς οργανισμούς και ομάδες.';

  const cardSubtitle = showReset
    ? 'Ορίστε νέο κωδικό για τον λογαριασμό σας.'
    : appearance === 'navy-amber'
      ? 'Καλώς ήρθατε πίσω! Παρακαλώ συνδεθείτε στον λογαριασμό σας.'
      : appearance === 'midnight-ice'
        ? 'Καλωσορίσατε ξανά! Παρακαλώ συνδεθείτε στον λογαριασμό σας.'
        : appearance === 'pitch-heritage'
          ? 'Καλώς ήρθατε. Συνδεθείτε στον σύλλογο.'
          : appearance === 'graphite-ember'
            ? 'Συνδεθείτε για να συνεχίσετε.'
            : 'Εισαγάγετε τα διαπιστευτήριά σας για να συνεχίσετε.';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      setAppearance(getAppearanceTheme());
      setAppName(getAppName());
      setAppLogoUrl(getAppLogoUrl());
    };
    sync();
    window.addEventListener('academyhub-platform-updated', sync);
    return () => window.removeEventListener('academyhub-platform-updated', sync);
  }, []);

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
    try {
      if (rememberMe && email.trim()) {
        localStorage.setItem(REMEMBER_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      /* ignore */
    }
    endPreview();
    clearDataCache();
    window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));

    if (
      (result.data?.clubId || result.data?.role === 'platform_admin') &&
      !isPresentationDemoEmail(result.data?.email)
    ) {
      const { syncClubOnLogin } = await import('../data/clubSync');
      await syncClubOnLogin(result.data?.clubId ?? null);
      clearDataCache();
      try {
        const { migrateUsersToPlatformRoleDefaults } = await import(
          '../api/services/clubUsersService'
        );
        migrateUsersToPlatformRoleDefaults();
      } catch {
        /* best-effort role defaults */
      }
      try {
        const { runDueFeeGenerations, runDueFeeReminders } = await import(
          '../api/services/feeChargesService'
        );
        await runDueFeeGenerations();
        if (result.data?.clubId) {
          await runDueFeeReminders(result.data.clubId);
        }
      } catch {
        /* best-effort auto fees / reminders */
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
    <div
      className={`login-page${useSplitLogin ? ' login-page--split' : ''}`}
      data-login-theme={appearance}
    >
      <aside className="login-hero-panel">
        <div className="login-hero-glow" aria-hidden />
        <div className="login-hero-watermark" aria-hidden>
          360
        </div>
        <div className="login-hero-brand">
          {appLogoUrl ? (
            <img className="login-hero-logo" src={appLogoUrl} alt="" />
          ) : null}
          <div className="login-hero-title">
            <span className="login-hero-name">{brand.title}</span>
            <span className="login-hero-360">{brand.accent}</span>
          </div>
          <div className="login-hero-accent" aria-hidden />
          <p className="login-hero-tagline">{heroTagline}</p>
        </div>
      </aside>

      <div className="login-form-panel">
        <form className="login-card" onSubmit={showReset ? handleReset : handleSubmit}>
          {useSplitLogin ? (
            <header className="login-card-head">
              <h1>{showReset ? 'Νέος κωδικός' : 'Σύνδεση'}</h1>
              <p>{cardSubtitle}</p>
            </header>
          ) : (
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
          )}

          {!showReset ? (
            <>
              <label className="login-field">
                <span>Email</span>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" size={18} aria-hidden />
                  <input
                    type="email"
                    autoComplete="username"
                    placeholder="email@paradeigma.gr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </label>
              <label className="login-field">
                <span>Κωδικός πρόσβασης</span>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" size={18} aria-hidden />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <div className="login-row-actions">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Να με θυμάσαι</span>
                </label>
                <button
                  type="button"
                  className="login-text-link"
                  onClick={() => void handleForgot()}
                  disabled={saving}
                >
                  Ξέχασα τον κωδικό μου
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="login-field">
                <span>Νέος κωδικός</span>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" size={18} aria-hidden />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
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

          {showReset ? (
            <p className="login-footer-link">
              <button
                type="button"
                className="login-text-link"
                onClick={() => {
                  setShowReset(false);
                  setResetToken('');
                  setNewPassword('');
                }}
              >
                Επιστροφή στη σύνδεση
              </button>
            </p>
          ) : (
            <>
              <div className="login-or">
                <span>ή</span>
              </div>
              <button
                type="button"
                className="login-submit login-submit-secondary"
                disabled={saving || demoLoading}
                onClick={() => void handleEnterDemo()}
              >
                {demoLoading ? 'Φόρτωση DEMO…' : 'Είσοδος DEMO παρουσίασης'}
              </button>
              {!useSplitLogin ? (
                <div className="login-demo-block">
                  <p className="login-demo-hint">
                    Σύλλογος DEMO με πλήρη δείγματα · {demoHint.email} / {demoHint.password}
                  </p>
                  <p className="login-demo-hint">
                    Ρόλοι:{' '}
                    {demoRoles.map((r) => `${r.role} ${r.email}`).join(' · ')} (κωδικός{' '}
                    {demoHint.password})
                  </p>
                </div>
              ) : (
                <p className="login-demo-hint login-demo-hint--compact">
                  DEMO: {demoHint.email} / {demoHint.password}
                </p>
              )}
            </>
          )}

          <p className="login-footer-link">
            Δεν έχετε λογαριασμό; <Link to="/register">Εγγραφή συλλόγου</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
