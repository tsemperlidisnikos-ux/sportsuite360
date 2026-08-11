import { fail, ok, type ApiResult } from '../api/apiClient';
import { clearDataCache, reseedDemoShowcase } from '../data/repository';
import { isDemoClubName } from '../data/demoShowcase';
import { endPreview } from '../platform/platformConfig';
import { localDateIso } from '../utils/dates';
import {
  getUsers,
  login,
  prepareStoredPassword,
  saveUsers,
  type AppUser,
} from './auth';
import { getClubs, saveClubs } from './clubs';

/** Stable IDs so DEMO is the same club on every visit to this browser. */
export const DEMO_CLUB_ID = 'club_demo_showcase';
export const DEMO_USER_ID = 'user_demo_admin';
export const DEMO_EMAIL = 'demo@sportsuite360.app';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_CLUB_NAME = 'DEMO';

/**
 * Ensures DEMO club + admin exist, loads presentation data, and logs in.
 * Works on production (Vercel) because all data lives in the browser localStorage.
 */
export async function enterDemoPresentation(): Promise<ApiResult<AppUser>> {
  endPreview();

  const clubs = getClubs();
  let club =
    clubs.find((c) => c.id === DEMO_CLUB_ID) ??
    clubs.find((c) => isDemoClubName(c.name));

  if (!club) {
    club = {
      id: DEMO_CLUB_ID,
      name: DEMO_CLUB_NAME,
      city: 'Αθήνα',
      phone: '2100000000',
      adminUserId: DEMO_USER_ID,
      createdAt: localDateIso(),
      athleteLicenseLimit: 50,
      athleteLicenseUsed: 0,
    };
    saveClubs([...clubs, club]);
  } else if (club.name.trim().toUpperCase() !== DEMO_CLUB_NAME) {
    const next = clubs.map((c) =>
      c.id === club!.id ? { ...c, name: DEMO_CLUB_NAME } : c,
    );
    saveClubs(next);
    club = next.find((c) => c.id === club!.id)!;
  }

  const clubId = club.id;
  const users = getUsers();
  let user =
    users.find((u) => u.id === DEMO_USER_ID) ??
    users.find((u) => u.email.toLowerCase() === DEMO_EMAIL);

  const hashedPassword = await prepareStoredPassword(DEMO_PASSWORD);

  if (!user) {
    user = {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      password: hashedPassword,
      fullName: 'Διαχειριστής DEMO',
      role: 'admin',
      active: true,
      clubId,
    };
    saveUsers([...users, user]);
  } else {
    const nextUsers = users.map((u) =>
      u.id === user!.id
        ? {
            ...u,
            email: DEMO_EMAIL,
            password: hashedPassword,
            fullName: u.fullName || 'Διαχειριστής DEMO',
            role: 'admin' as const,
            active: true,
            clubId,
          }
        : u,
    );
    saveUsers(nextUsers);
    user = nextUsers.find((u) => u.id === user!.id)!;
  }

  // Keep club adminUserId in sync
  const refreshedClubs = getClubs().map((c) =>
    c.id === clubId
      ? {
          ...c,
          adminUserId: user!.id,
          athleteLicenseLimit: Math.max(c.athleteLicenseLimit, 50),
        }
      : c,
  );
  saveClubs(refreshedClubs);

  const sessionResult = await login(DEMO_EMAIL, DEMO_PASSWORD);
  if (!sessionResult.success || !sessionResult.data) {
    return fail(sessionResult.error ?? 'Αποτυχία σύνδεσης DEMO');
  }

  clearDataCache();
  const seeded = reseedDemoShowcase(clubId);
  if (!seeded) {
    return fail('Αποτυχία φόρτωσης DEMO δεδομένων.');
  }

  window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));
  return ok(sessionResult.data);
}

export function getDemoLoginHint(): { email: string; password: string } {
  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
}
