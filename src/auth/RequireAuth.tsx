import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession, isAuthenticated, isPlatformAdmin, logout } from '../auth/auth';
import { ensureSessionClub, isClubUsageActive } from '../auth/clubs';

export function RequireAuth() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  const session = getSession();
  const club = ensureSessionClub(session);
  if (!isPlatformAdmin() && club && !isClubUsageActive(club)) {
    return (
      <div className="access-blocked">
        <h1>Η περίοδος χρήσης έχει λήξει</h1>
        <p>Επικοινωνήστε με τον Platform Admin για ανανέωση της πρόσβασης του συλλόγου.</p>
        <button type="button" onClick={logout}>Έξοδος</button>
      </div>
    );
  }
  return <Outlet />;
}
