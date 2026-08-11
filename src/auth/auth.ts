import { hashPassword, isPasswordHashed, verifyPassword } from './password';

export type UserRole =
  | 'platform_admin'
  | 'admin'
  | 'coach'
  | 'secretariat'
  | 'staff'
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
  coachId?: string | null;
  /** Προσαρμοσμένα δικαιώματα από τον σύλλογο· αν λείπει → defaults ρόλου από Platform Admin. */
  permissions?: string[] | null;
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

function setSessionFromUser(user: AppUser): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clubId: user.clubId ?? null,
      athleteId: user.athleteId ?? null,
      coachId: user.coachId ?? null,
    }),
  );
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

  const existingAdmin = users.find((u) => u.id === PLATFORM_ADMIN.id);
  const others = users.filter(
    (u) => u.id !== PLATFORM_ADMIN.id && u.role !== 'platform_admin',
  );

  const apollonIndex = others.findIndex(
    (u) => u.email.toLowerCase() === APOLLON_ADMIN_EMAIL,
  );
  const clubId = findApollonClubId();
  if (apollonIndex >= 0) {
    const prev = others[apollonIndex];
    others[apollonIndex] = {
      ...prev,
      email: APOLLON_ADMIN_EMAIL,
      password: isPasswordHashed(prev.password)
        ? prev.password
        : prev.password || APOLLON_ADMIN_PASSWORD,
      active: true,
      clubId: prev.clubId ?? clubId,
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

  const admin: AppUser = {
    ...PLATFORM_ADMIN,
    password:
      existingAdmin && isPasswordHashed(existingAdmin.password)
        ? existingAdmin.password
        : existingAdmin?.password || PLATFORM_ADMIN.password,
    fullName: existingAdmin?.fullName || PLATFORM_ADMIN.fullName,
    email: PLATFORM_ADMIN.email,
    active: true,
  };

  const next = [admin, ...others];
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
  window.dispatchEvent(new CustomEvent('academyhub-users-updated'));
}

export async function login(
  email: string,
  password: string,
): Promise<{ success: boolean; data?: AppUser; error?: string }> {
  ensurePlatformAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const users = getUsers();
  const index = users.findIndex(
    (u) => u.email.toLowerCase() === normalizedEmail && u.active,
  );
  if (index < 0) {
    return { success: false, error: 'Λάθος email ή κωδικός' };
  }

  const user = users[index];
  const ok = await verifyPassword(normalizedPassword, user.password);
  if (!ok) {
    return { success: false, error: 'Λάθος email ή κωδικός' };
  }

  if (!isPasswordHashed(user.password)) {
    users[index] = { ...user, password: await hashPassword(normalizedPassword) };
    saveUsers(users);
  }

  setSessionFromUser(users[index]);
  return { success: true, data: users[index] };
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
  athleteId?: string | null;
  coachId?: string | null;
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
  staff: 'Προσωπικό',
  athlete: 'Αθλητής',
  parent: 'Γονέας',
};

export function getUserById(userId: string): AppUser | null {
  return getUsers().find((u) => u.id === userId) ?? null;
}

export function updateUser(
  userId: string,
  patch: Partial<
    Pick<
      AppUser,
      | 'fullName'
      | 'email'
      | 'password'
      | 'role'
      | 'active'
      | 'permissions'
      | 'athleteId'
      | 'coachId'
    >
  >,
): { success: boolean; data?: AppUser; error?: string } {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) return { success: false, error: 'Ο χρήστης δεν βρέθηκε' };

  if (patch.email) {
    const nextEmail = patch.email.trim().toLowerCase();
    if (!nextEmail.includes('@')) {
      return { success: false, error: 'Μη έγκυρο email' };
    }
    if (users.some((u) => u.id !== userId && u.email.toLowerCase() === nextEmail)) {
      return { success: false, error: 'Το email χρησιμοποιείται ήδη' };
    }
    patch = { ...patch, email: nextEmail };
  }

  users[index] = { ...users[index], ...patch };
  saveUsers(users);

  const session = getSession();
  if (session?.id === userId) {
    setSessionFromUser(users[index]);
  }

  return { success: true, data: users[index] };
}

export function updateUserEmail(
  userId: string,
  email: string,
): { success: boolean; data?: AppUser; error?: string } {
  return updateUser(userId, { email });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = getSession();
  if (!session) return { success: false, error: 'Δεν υπάρχει ενεργή σύνδεση' };

  const current = input.currentPassword.trim();
  const next = input.newPassword.trim();
  const confirm = input.confirmPassword.trim();

  if (!current) return { success: false, error: 'Συμπληρώστε τον τρέχοντα κωδικό' };
  if (next.length < 6) {
    return { success: false, error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες' };
  }
  if (next !== confirm) return { success: false, error: 'Η επιβεβαίωση κωδικού δεν ταιριάζει' };

  const user = getUserById(session.id);
  if (!user) return { success: false, error: 'Ο χρήστης δεν βρέθηκε' };
  if (!(await verifyPassword(current, user.password))) {
    return { success: false, error: 'Ο τρέχων κωδικός είναι λάθος' };
  }
  if (current === next) {
    return { success: false, error: 'Ο νέος κωδικός πρέπει να είναι διαφορετικός' };
  }

  const hashed = await hashPassword(next);
  const result = updateUser(user.id, { password: hashed });
  if (!result.success) return { success: false, error: result.error ?? 'Σφάλμα ενημέρωσης' };
  return { success: true };
}

export function deleteUser(userId: string): { success: boolean; error?: string } {
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
  setSessionFromUser(user);
  return { success: true, data: user };
}

/** Hash plaintext password when creating users (club invites / parents). */
export async function prepareStoredPassword(plain: string): Promise<string> {
  return hashPassword(plain.trim());
}
