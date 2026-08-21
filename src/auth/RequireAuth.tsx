import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  getSessionToken,
  serverVerifySession,
  type ServerSessionUser,
} from '../api/services/sessionService';
import {
  getSession,
  isAuthenticated,
  isPlatformAdmin,
  logout,
  setSessionFromVerifiedUser,
} from './auth';
import { ensureSessionClub, isClubUsageActive } from './clubs';

type GateState = 'checking' | 'ok' | 'deny';

export function RequireAuth() {
  const location = useLocation();
  const [gate, setGate] = useState<GateState>('checking');

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!getSession()) {
        if (active) setGate('deny');
        return;
      }

      const token = getSessionToken();
      if (!token) {
        // Local-only sessions are allowed in DEV (first bootstrap / offline).
        if (import.meta.env.DEV) {
          if (active) setGate('ok');
          return;
        }
        logout();
        if (active) setGate('deny');
        return;
      }

      const result = await serverVerifySession();
      if (!active) return;

      if (!result.success || !result.data) {
        logout();
        setGate('deny');
        return;
      }

      setSessionFromVerifiedUser(result.data as ServerSessionUser);
      setGate('ok');
    }

    void verify();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (gate === 'checking') {
    return (
      <div className="access-blocked" aria-busy="true">
        <p>Επαλήθευση συνεδρίας…</p>
      </div>
    );
  }

  if (gate === 'deny' || !isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const session = getSession();
  const club = ensureSessionClub(session);
  if (!isPlatformAdmin() && club && !isClubUsageActive(club)) {
    return (
      <div className="access-blocked">
        <h1>Η περίοδος χρήσης έχει λήξει</h1>
        <p>Επικοινωνήστε με τον Platform Admin για ανανέωση της πρόσβασης του συλλόγου.</p>
        <button type="button" onClick={logout}>
          Έξοδος
        </button>
      </div>
    );
  }

  return <Outlet />;
}
