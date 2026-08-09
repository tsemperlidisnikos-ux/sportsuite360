import { z } from 'zod';
import { fail, ok, type ApiResult } from '../api/apiClient';
import {
  getUsers,
  login,
  saveUsers,
  type AppUser,
} from './auth';

export interface Club {
  id: string;
  name: string;
  city: string;
  phone: string;
  adminUserId: string;
  createdAt: string;
  athleteLicenseLimit: number;
  athleteLicenseUsed: number;
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
    createdAt: new Date().toISOString().slice(0, 10),
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

export function deleteClub(clubId: string): ApiResult<true> {
  const clubs = getClubs().filter((c) => c.id !== clubId);
  saveClubs(clubs);
  return ok(true);
}
