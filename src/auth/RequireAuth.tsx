import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession, isAuthenticated } from '../auth/auth';
import { ensureSessionClub } from '../auth/clubs';

export function RequireAuth() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  ensureSessionClub(getSession());
  return <Outlet />;
}
