import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isPlatformAdmin, logout } from '../auth/auth';
import {
  getLicensePackages,
  saveLicensePackages,
  type LicensePackage,
} from '../auth/licensePackages';

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
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function handleSave() {
    saveLicensePackages(packages);
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
          <p>Ορίστε τα διαθέσιμα πακέτα αδειών αθλητών για τους συλλόγους.</p>
          <Link to="/platform" className="platform-packages-btn">
            ← Πίσω στους χρήστες
          </Link>
        </div>
      </div>

      {message ? <p className="platform-flash platform-flash-ok">{message}</p> : null}

      <div className="packages-grid">
        {packages.map((pkg) => (
          <article key={pkg.id} className="package-card">
            <label>
              <span>Όνομα πακέτου</span>
              <input
                value={pkg.name}
                onChange={(e) => updatePackage(pkg.id, { name: e.target.value })}
              />
            </label>
            <label>
              <span>Άδειες αθλητών</span>
              <input
                type="number"
                min={0}
                value={pkg.athleteLicenses}
                onChange={(e) =>
                  updatePackage(pkg.id, { athleteLicenses: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>Μηνιαία τιμή (€)</span>
              <input
                type="number"
                min={0}
                value={pkg.monthlyPrice}
                onChange={(e) =>
                  updatePackage(pkg.id, { monthlyPrice: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>Ετήσια τιμή (€)</span>
              <input
                type="number"
                min={0}
                value={pkg.yearlyPrice}
                onChange={(e) =>
                  updatePackage(pkg.id, { yearlyPrice: Number(e.target.value) })
                }
              />
            </label>
            <label className="package-active">
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
