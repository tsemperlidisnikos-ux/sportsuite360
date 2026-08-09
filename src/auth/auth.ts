export type UserRole =
  | 'platform_admin'
  | 'admin'
  | 'coach'
  | 'secretariat'
  | 'athlete'
  | 'parent';

export interface AppUser {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  clubId?: string | null;
  athleteId?: string | null;
}

const SESSION_KEY = 'academyhub-session-v1';
const USERS_KEY = 'academyhub-users-v2';

export const PLATFORM_ADMIN: AppUser = {
  id: 'user_platform_admin',
  email: 'tsemperlidis.nikos@gmail.com',
  password: 'ntstgt160813',
  fullName: 'Nikos Tsemperlidis',
  role: 'platform_admin',
  active: true,
};

const APOLLON_ADMIN_EMAIL = 'apollon@patras.gr';
const APOLLON_ADMIN_PASSWORD = '1234567890';

const defaultUsers: AppUser[] = [PLATFORM_ADMIN];

function findApollonClubId(): string | null {
  try {
    const raw = localStorage.getItem('academyhub-clubs-v1');
    if (!raw) return null;
    const clubs = JSON.parse(raw) as Array<{ id: string; name: string }>;
    const club = clubs.find((c) => {
      const name = (c.name ?? '').toLowerCase();
      return name.includes('απολλων') || name.includes('απόλλων') || name.includes('apollon');
    });
    return club?.id ?? null;
  } catch {
    return null;
  }
}

/** Always keep a working platform admin account in localStorage. */
export function ensurePlatformAdmin(): AppUser {
  let users: AppUser[] = [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      users = JSON.parse(raw) as AppUser[];
    } else {
      const legacy = localStorage.getItem('academyhub-users-v1');
      if (legacy) users = JSON.parse(legacy) as AppUser[];
    }
  } catch {
    users = [];
  }

  const others = users.filter(
    (u) => u.id !== PLATFORM_ADMIN.id && u.role !== 'platform_admin',
  );

  const apollonIndex = others.findIndex(
    (u) => u.email.toLowerCase() === APOLLON_ADMIN_EMAIL,
  );
  const clubId = findApollonClubId();
  if (apollonIndex >= 0) {
    others[apollonIndex] = {
      ...others[apollonIndex],
      email: APOLLON_ADMIN_EMAIL,
      password: APOLLON_ADMIN_PASSWORD,
      active: true,
      clubId: others[apollonIndex].clubId ?? clubId,
    };
  } else {
    others.push({
      id: 'user_apollon_patras',
      email: APOLLON_ADMIN_EMAIL,
      password: APOLLON_ADMIN_PASSWORD,
      fullName: 'Α.Σ. Απόλλων Πατρών',
      role: 'admin',
      active: true,
      clubId,
    });
  }

  const next = [{ ...PLATFORM_ADMIN }, ...others];
  localStorage.setItem(USERS_KEY, JSON.stringify(next));
  return next[0];
}

export function getUsers(): AppUser[] {
  ensurePlatformAdmin();
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
      return structuredClone(defaultUsers);
    }
    return JSON.parse(raw) as AppUser[];
  } catch {
    return structuredClone(defaultUsers);
  }
}

export function saveUsers(users: AppUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  ensurePlatformAdmin();
}

export function login(
  email: string,
  password: string,
): { success: boolean; data?: AppUser; error?: string } {
  ensurePlatformAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const user = getUsers().find(
    (u) =>
      u.email.toLowerCase() === normalizedEmail &&
      u.password === normalizedPassword &&
      u.active,
  );
  if (!user) {
    return { success: false, error: 'Λάθος email ή κωδικός' };
  }
  const session = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    clubId: user.clubId ?? null,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, data: user };
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  clubId?: string | null;
} | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getSession());
}

export function isPlatformAdmin(): boolean {
  return getSession()?.role === 'platform_admin';
}

export const roleLabels: Record<UserRole, string> = {
  platform_admin: 'Διαχειριστής πλατφόρμας',
  admin: 'Διαχειριστής συλλόγου',
  coach: 'Προπονητής',
  secretariat: 'Γραμματεία',
  athlete: 'Αθλητής',
  parent: 'Γονέας',
};

export function updateUserEmail(
  userId: string,
  email: string,
): { success: boolean; data?: AppUser; error?: string } {
  const nextEmail = email.trim().toLowerCase();
  if (!nextEmail.includes('@')) {
    return { success: false, error: 'Μη έγκυρο email' };
  }
  const users = getUsers();
  if (users.some((u) => u.id !== userId && u.email.toLowerCase() === nextEmail)) {
    return { success: false, error: 'Το email χρησιμοποιείται ήδη' };
  }
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) return { success: false, error: 'Ο χρήστης δεν βρέθηκε' };
  users[index] = { ...users[index], email: nextEmail };
  saveUsers(users);
  const session = getSession();
  if (session?.id === userId) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...session, email: nextEmail }),
    );
  }
  return { success: true, data: users[index] };
}

export function deleteUser(
  userId: string,
): { success: boolean; error?: string } {
  const session = getSession();
  if (session?.id === userId) {
    return { success: false, error: 'Δεν μπορείτε να διαγράψετε τον ενεργό λογαριασμό' };
  }
  const users = getUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return { success: false, error: 'Ο χρήστης δεν βρέθηκε' };
  if (target.role === 'platform_admin') {
    return { success: false, error: 'Δεν επιτρέπεται διαγραφή διαχειριστή πλατφόρμας' };
  }
  saveUsers(users.filter((u) => u.id !== userId));
  return { success: true };
}

export function impersonateUser(
  userId: string,
): { success: boolean; data?: AppUser; error?: string } {
  const user = getUsers().find((u) => u.id === userId && u.active);
  if (!user) return { success: false, error: 'Ο χρήστης δεν βρέθηκε' };
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clubId: user.clubId ?? null,
    }),
  );
  return { success: true, data: user };
}
