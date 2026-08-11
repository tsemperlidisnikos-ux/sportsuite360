import { z } from 'zod';
import { fail, ok, type ApiResult } from '../api/apiClient';
import { localDateIso } from '../utils/dates';
import {
  getUsers,
  login,
  saveUsers,
  type AppUser,
} from './auth';

export interface ClubSmtpSettings {
  enabled: boolean;
  provider: 'gmail' | 'custom';
  host: string;
  port: string;
  username: string;
  password: string;
  fromName: string;
}

export interface ClubSmtpSendLog {
  id: string;
  at: string;
  to: string;
  status: 'ok' | 'error';
  message: string;
}

export interface ClubVivaSettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  merchantId: string;
  sourceCode: string;
  environment: 'demo' | 'live';
}

export interface Club {
  id: string;
  name: string;
  city: string;
  phone: string;
  adminUserId: string;
  createdAt: string;
  athleteLicenseLimit: number;
  athleteLicenseUsed: number;
  logoUrl?: string | null;
  smtp?: ClubSmtpSettings;
  smtpSendLog?: ClubSmtpSendLog[];
  viva?: ClubVivaSettings;
}

const CLUBS_KEY = 'academyhub-clubs-v1';

export const clubRegistrationSchema = z
  .object({
    clubName: z.string().min(2, 'Το όνομα συλλόγου είναι υποχρεωτικό'),
    city: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    adminFullName: z.string().min(2, 'Το ονοματεπώνυμο είναι υποχρεωτικό'),
    email: z.string().email('Μη έγκυρο email'),
    password: z.string().min(6, 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες'),
    confirmPassword: z.string().min(1, 'Επιβεβαιώστε τον κωδικό'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Οι κωδικοί δεν ταιριάζουν',
    path: ['confirmPassword'],
  });

export type ClubRegistrationInput = z.infer<typeof clubRegistrationSchema>;

export function getClubs(): Club[] {
  try {
    const raw = localStorage.getItem(CLUBS_KEY);
    if (!raw) return [];
    const clubs = JSON.parse(raw) as Club[];
    return clubs.map((c) => ({
      ...c,
      athleteLicenseLimit: c.athleteLicenseLimit ?? 10,
      athleteLicenseUsed: c.athleteLicenseUsed ?? 0,
    }));
  } catch {
    return [];
  }
}

function saveClubs(clubs: Club[]): void {
  localStorage.setItem(CLUBS_KEY, JSON.stringify(clubs));
}

export { saveClubs };

export function getClubById(clubId: string | null | undefined): Club | null {
  if (!clubId) return null;
  return getClubs().find((c) => c.id === clubId) ?? null;
}

export function registerClub(
  input: ClubRegistrationInput,
): ApiResult<{ club: Club; user: AppUser }> {
  const parsed = clubRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Μη έγκυρα στοιχεία');
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const users = getUsers();

  if (users.some((u) => u.email.toLowerCase() === email)) {
    return fail('Υπάρχει ήδη λογαριασμός με αυτό το email');
  }

  const clubs = getClubs();
  if (clubs.some((c) => c.name.trim().toLowerCase() === data.clubName.trim().toLowerCase())) {
    return fail('Υπάρχει ήδη σύλλογος με αυτό το όνομα');
  }

  const userId = `user_${Date.now()}`;
  const clubId = `club_${Date.now()}`;

  const user: AppUser = {
    id: userId,
    email,
    password: data.password,
    fullName: data.adminFullName.trim(),
    role: 'admin',
    active: true,
    clubId,
  };

  const club: Club = {
    id: clubId,
    name: data.clubName.trim(),
    city: data.city?.trim() ?? '',
    phone: data.phone?.trim() ?? '',
    adminUserId: userId,
    createdAt: localDateIso(),
    athleteLicenseLimit: 10,
    athleteLicenseUsed: 0,
  };

  saveUsers([...users, user]);
  saveClubs([...clubs, club]);

  const sessionResult = login(email, data.password);
  if (!sessionResult.success) {
    return fail(sessionResult.error ?? 'Η εγγραφή ολοκληρώθηκε, αλλά απέτυχε η σύνδεση');
  }

  return ok({ club, user });
}

export function updateClubLicenses(
  clubId: string,
  input: { athleteLicenseLimit: number; athleteLicenseUsed: number },
): ApiResult<Club> {
  const clubs = getClubs();
  const index = clubs.findIndex((c) => c.id === clubId);
  if (index < 0) return fail('Ο σύλλογος δεν βρέθηκε');
  const limit = Math.max(0, Math.floor(input.athleteLicenseLimit));
  const used = Math.max(0, Math.min(limit, Math.floor(input.athleteLicenseUsed)));
  clubs[index] = {
    ...clubs[index],
    athleteLicenseLimit: limit,
    athleteLicenseUsed: used,
  };
  saveClubs(clubs);
  return ok(clubs[index]);
}

export function updateClubLogo(
  clubId: string,
  logoUrl: string | null,
): ApiResult<Club> {
  const clubs = getClubs();
  const index = clubs.findIndex((c) => c.id === clubId);
  if (index < 0) return fail('Ο σύλλογος δεν βρέθηκε');
  clubs[index] = {
    ...clubs[index],
    logoUrl,
  };
  saveClubs(clubs);
  window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));
  return ok(clubs[index]);
}

export const clubSmtpSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['gmail', 'custom']),
  host: z.string().optional().default(''),
  port: z.string().optional().default('587'),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  fromName: z.string().optional().default(''),
});

export type ClubSmtpInput = z.infer<typeof clubSmtpSchema>;

export function getDefaultClubSmtp(): ClubSmtpSettings {
  return {
    enabled: false,
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: '587',
    username: '',
    password: '',
    fromName: '',
  };
}

export function getClubSmtp(clubId: string | null | undefined): ClubSmtpSettings {
  const club = getClubById(clubId);
  return { ...getDefaultClubSmtp(), ...(club?.smtp ?? {}) };
}

export function updateClubSmtp(
  clubId: string,
  input: ClubSmtpInput,
): ApiResult<Club> {
  const parsed = clubSmtpSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Μη έγκυρες ρυθμίσεις SMTP');
  }

  const data = parsed.data;
  if (data.enabled) {
    if (!data.host.trim()) return fail('Συμπληρώστε SMTP host');
    if (!data.port.trim()) return fail('Συμπληρώστε port');
    if (!data.username.trim()) return fail('Συμπληρώστε Email / username');
    if (!data.password.trim()) return fail('Συμπληρώστε App Password / κωδικό SMTP');
  }

  const clubs = getClubs();
  const index = clubs.findIndex((c) => c.id === clubId);
  if (index < 0) return fail('Ο σύλλογος δεν βρέθηκε');

  const smtp: ClubSmtpSettings = {
    enabled: data.enabled,
    provider: data.provider,
    host: data.host.trim(),
    port: data.port.trim(),
    username: data.username.trim(),
    password: data.password,
    fromName: data.fromName.trim(),
  };

  clubs[index] = { ...clubs[index], smtp };
  saveClubs(clubs);
  window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));
  return ok(clubs[index]);
}

export function appendClubSmtpSendLog(
  clubId: string,
  entry: Omit<ClubSmtpSendLog, 'id' | 'at'> & { at?: string },
): ApiResult<ClubSmtpSendLog[]> {
  const clubs = getClubs();
  const index = clubs.findIndex((c) => c.id === clubId);
  if (index < 0) return fail('Ο σύλλογος δεν βρέθηκε');

  const logEntry: ClubSmtpSendLog = {
    id: `smtp_${Date.now()}`,
    at: entry.at ?? new Date().toISOString(),
    to: entry.to,
    status: entry.status,
    message: entry.message,
  };

  const prev = clubs[index].smtpSendLog ?? [];
  const next = [logEntry, ...prev].slice(0, 30);
  clubs[index] = { ...clubs[index], smtpSendLog: next };
  saveClubs(clubs);
  window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));
  return ok(next);
}

export function getClubSmtpSendLog(clubId: string | null | undefined): ClubSmtpSendLog[] {
  return getClubById(clubId)?.smtpSendLog ?? [];
}

export const VIVA_WEBHOOK_URL =
  'https://backend-three-kappa-56.vercel.app/billing/viva-webhook';

export const clubVivaSchema = z.object({
  enabled: z.boolean(),
  clientId: z.string().optional().default(''),
  clientSecret: z.string().optional().default(''),
  merchantId: z.string().optional().default(''),
  sourceCode: z.string().optional().default(''),
  environment: z.enum(['demo', 'live']),
});

export type ClubVivaInput = z.infer<typeof clubVivaSchema>;

export function getDefaultClubViva(): ClubVivaSettings {
  return {
    enabled: false,
    clientId: '',
    clientSecret: '',
    merchantId: '',
    sourceCode: '',
    environment: 'demo',
  };
}

export function getClubViva(clubId: string | null | undefined): ClubVivaSettings {
  const club = getClubById(clubId);
  return { ...getDefaultClubViva(), ...(club?.viva ?? {}) };
}

export function updateClubViva(
  clubId: string,
  input: ClubVivaInput,
): ApiResult<Club> {
  const parsed = clubVivaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Μη έγκυρες ρυθμίσεις Viva');
  }

  const data = parsed.data;
  if (data.enabled) {
    if (!data.clientId.trim()) return fail('Συμπληρώστε Client ID');
    if (!data.clientSecret.trim()) return fail('Συμπληρώστε Client Secret');
    if (!data.sourceCode.trim()) return fail('Συμπληρώστε Source Code');
    if (!/^\d{4}$/.test(data.sourceCode.trim())) {
      return fail('Το Source Code πρέπει να έχει 4 ψηφία');
    }
  } else if (data.sourceCode.trim() && !/^\d{4}$/.test(data.sourceCode.trim())) {
    return fail('Το Source Code πρέπει να έχει 4 ψηφία');
  }

  const clubs = getClubs();
  const index = clubs.findIndex((c) => c.id === clubId);
  if (index < 0) return fail('Ο σύλλογος δεν βρέθηκε');

  const viva: ClubVivaSettings = {
    enabled: data.enabled,
    clientId: data.clientId.trim(),
    clientSecret: data.clientSecret,
    merchantId: data.merchantId.trim(),
    sourceCode: data.sourceCode.trim(),
    environment: data.environment,
  };

  clubs[index] = { ...clubs[index], viva };
  saveClubs(clubs);
  window.dispatchEvent(new CustomEvent('academyhub-clubs-updated'));
  return ok(clubs[index]);
}

export function deleteClub(clubId: string): ApiResult<true> {
  const clubs = getClubs().filter((c) => c.id !== clubId);
  saveClubs(clubs);
  return ok(true);
}
