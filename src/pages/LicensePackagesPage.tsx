import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isPlatformAdmin } from '../auth/auth';
import {
  ATHLETE_LICENSE_OPTIONS,
  getLicensePackages,
  PERIOD_MONTH_OPTIONS,
  periodLabel,
  saveLicensePackages,
  type LicensePackage,
} from '../auth/licensePackages';
import { AdminZone, PlatformAdminShell } from '../components/layout/PlatformAdminShell';
import { Button } from '../components/ui/Button';

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
  const [packages, setPackages] = useState<LicensePackage[]>(() => getLicensePackages());
  const [message, setMessage] = useState('');

  if (!isPlatformAdmin()) {
    return <Navigate to="/login" replace />;
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
    <PlatformAdminShell
      title="Πακέτα αδειών"
      lede="Ορίστε τιμή, διάρκεια και άδειες αθλητών για κάθε πακέτο συνδρομής."
      banner={message}
    >
      <div className="admin-zones">
        {packages.map((pkg) => (
          <AdminZone key={pkg.id} title={pkg.name}>
            <article className="admin-zone-card">
              <header className="admin-zone-card-head">
                <h3>{pkg.popular ? `${pkg.name} · Δημοφιλές` : pkg.name}</h3>
                <p>
                  €{pkg.price || 0} +ΦΠΑ / {periodLabel(pkg.periodMonths)}
                  {pkg.active ? '' : ' · Ανενεργό'}
                </p>
              </header>
              <div className="admin-zone-card-body">
                <div className="entry-form admin-entry">
                  <label className="field">
                    <span>Όνομα πακέτου</span>
                    <input
                      value={pkg.name}
                      onChange={(e) => updatePackage(pkg.id, { name: e.target.value.toUpperCase() })}
                    />
                  </label>
                  <label className="field">
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
                  <label className="field">
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
                  <label className="field">
                    <span>Περιγραφή</span>
                    <textarea
                      rows={2}
                      value={pkg.description}
                      onChange={(e) => updatePackage(pkg.id, { description: e.target.value })}
                    />
                  </label>
                  <label className="field">
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
                  <ul className="admin-package-features">
                    {pkg.features.map((feature) => (
                      <li
                        key={feature.label}
                        className={feature.included ? 'is-included' : 'is-excluded'}
                      >
                        {feature.included ? 'Ναι' : 'Όχι'} · {feature.label}
                      </li>
                    ))}
                  </ul>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={pkg.active}
                      onChange={(e) => updatePackage(pkg.id, { active: e.target.checked })}
                    />
                    <span>Ενεργό πακέτο</span>
                  </label>
                </div>
              </div>
            </article>
          </AdminZone>
        ))}
      </div>
      <div className="admin-entry-actions">
        <Button type="button" onClick={handleSave}>
          Αποθήκευση τιμών
        </Button>
      </div>
    </PlatformAdminShell>
  );
}
