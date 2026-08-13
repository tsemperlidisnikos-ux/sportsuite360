import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isPlatformAdmin, logout } from '../auth/auth';
import {
  ATHLETE_LICENSE_OPTIONS,
  getLicensePackages,
  PERIOD_MONTH_OPTIONS,
  periodLabel,
  saveLicensePackages,
  type LicensePackage,
} from '../auth/licensePackages';

function syncDerivedPrices(pkg: LicensePackage): LicensePackage {
  const periodMonths = Math.max(1, Math.round(pkg.periodMonths || 1));
  const price = Number.isFinite(pkg.price) ? Math.max(0, pkg.price) : 0;
  return {
    ...pkg,
    periodMonths,
    price,
    monthlyPrice: Math.round((price / periodMonths) * 100) / 100,
    yearlyPrice:
      periodMonths === 12
        ? price
        : Math.round((price / periodMonths) * 12 * 100) / 100,
  };
}

export function LicensePackagesPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<LicensePackage[]>(() => getLicensePackages());
  const [message, setMessage] = useState('');

  if (!isPlatformAdmin()) {
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function updatePackage(id: string, patch: Partial<LicensePackage>) {
    setPackages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return syncDerivedPrices({ ...p, ...patch });
      }),
    );
  }

  function handleSave() {
    const next = packages.map(syncDerivedPrices);
    saveLicensePackages(next);
    setPackages(next);
    setMessage('Οι τιμές αποθηκεύτηκαν.');
  }

  return (
    <div className="platform-page">
      <header className="platform-topbar">
        <div className="platform-brand">
          <span className="brand-mark">SS</span>
          <strong>SPORTSUITE 360</strong>
        </div>
        <button type="button" className="platform-logout" onClick={handleLogout}>
          Έξοδος
        </button>
      </header>

      <div className="platform-header">
        <div>
          <h1>Πακέτα &amp; τιμές αδειών</h1>
          <p>Ορίστε τιμή, διάρκεια και άδειες αθλητών για κάθε πακέτο.</p>
          <Link to="/platform" className="platform-packages-btn">
            ← Πίσω στους χρήστες
          </Link>
        </div>
      </div>

      {message ? <p className="platform-flash platform-flash-ok">{message}</p> : null}

      <div className="packages-grid pricing-plans-grid">
        {packages.map((pkg) => (
          <article
            key={pkg.id}
            className={`pricing-plan-card${pkg.popular ? ' is-popular' : ''}${pkg.active ? '' : ' is-inactive'}`}
          >
            {pkg.popular ? <span className="pricing-plan-badge">Δημοφιλές</span> : null}

            <input
              className="pricing-plan-name-input"
              value={pkg.name}
              onChange={(e) => updatePackage(pkg.id, { name: e.target.value.toUpperCase() })}
              aria-label="Όνομα πακέτου"
            />

            <div className="pricing-plan-price-row pricing-plan-price-preview" aria-hidden>
              <span className="pricing-plan-currency">€</span>
              <strong className="pricing-plan-price-display">{pkg.price || 0}</strong>
              <span className="pricing-plan-vat">+ΦΠΑ</span>
              <span className="pricing-plan-period">/ {periodLabel(pkg.periodMonths)}</span>
            </div>

            <div className="pricing-plan-admin-fields">
              <label>
                <span>Τιμή (€)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isFinite(pkg.price) ? pkg.price : 0}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : Number(e.target.value);
                    updatePackage(pkg.id, { price: Number.isFinite(value) ? value : 0 });
                  }}
                />
              </label>
              <label>
                <span>Διάρκεια</span>
                <select
                  value={pkg.periodMonths}
                  onChange={(e) =>
                    updatePackage(pkg.id, { periodMonths: Number(e.target.value) })
                  }
                >
                  {PERIOD_MONTH_OPTIONS.map((months) => (
                    <option key={months} value={months}>
                      {periodLabel(months)}
                    </option>
                  ))}
                  {!PERIOD_MONTH_OPTIONS.includes(
                    pkg.periodMonths as (typeof PERIOD_MONTH_OPTIONS)[number],
                  ) ? (
                    <option value={pkg.periodMonths}>{periodLabel(pkg.periodMonths)}</option>
                  ) : null}
                </select>
              </label>
            </div>

            <textarea
              className="pricing-plan-desc"
              rows={2}
              value={pkg.description}
              onChange={(e) => updatePackage(pkg.id, { description: e.target.value })}
              aria-label="Περιγραφή πακέτου"
            />

            <label className="pricing-plan-athletes">
              <span>Αθλητές</span>
              <select
                value={pkg.athleteLicenses}
                onChange={(e) =>
                  updatePackage(pkg.id, { athleteLicenses: Number(e.target.value) })
                }
              >
                {ATHLETE_LICENSE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} Αθλητές
                  </option>
                ))}
              </select>
            </label>

            <ul className="pricing-plan-features">
              {pkg.features.map((feature) => (
                <li
                  key={feature.label}
                  className={feature.included ? 'is-included' : 'is-excluded'}
                >
                  <span className="pricing-plan-check" aria-hidden>
                    {feature.included ? '✓' : '○'}
                  </span>
                  {feature.label}
                </li>
              ))}
            </ul>

            <label className="pricing-plan-active">
              <input
                type="checkbox"
                checked={pkg.active}
                onChange={(e) => updatePackage(pkg.id, { active: e.target.checked })}
              />
              <span>Ενεργό</span>
            </label>
          </article>
        ))}
      </div>

      <button type="button" className="login-submit packages-save" onClick={handleSave}>
        Αποθήκευση τιμών
      </button>
    </div>
  );
}
