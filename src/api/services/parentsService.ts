import { apiClient } from '../apiClient';
import {
  getSession,
  getUsers,
  prepareStoredPassword,
  saveUsers,
  type AppUser,
} from '../../auth/auth';
import { createId, getData, mutateData } from '../../data/repository';
import type { ParentAthleteLink } from '../../types';
import { localDateTimeIso } from '../../utils/dates';

export type ParentLinkRow = {
  linkId: string;
  parentUserId: string;
  parentName: string;
  parentEmail: string;
  athleteId: string;
  athleteName: string;
  createdAt: string;
};

export type ConnectParentInput = {
  clubId: string;
  fullName: string;
  email: string;
  password: string;
  athleteId: string;
};

function canManageParents(clubId: string): boolean {
  const session = getSession();
  if (!session) return false;
  if (session.role === 'platform_admin') return true;
  if (session.role === 'admin' && session.clubId === clubId) return true;
  if (session.role === 'secretariat' && session.clubId === clubId) return true;
  return false;
}

export async function listParentLinks(clubId: string) {
  return apiClient(() => {
    if (!canManageParents(clubId)) {
      throw new Error('Δεν έχετε δικαίωμα διαχείρισης γονέων');
    }
    const data = getData();
    const users = getUsers().filter((u) => u.clubId === clubId && u.role === 'parent');
    const userById = new Map(users.map((u) => [u.id, u]));
    const studentById = new Map(data.students.map((s) => [s.id, s]));

    const rows: ParentLinkRow[] = [];
    for (const link of data.parentLinks ?? []) {
      const parent = userById.get(link.parentUserId);
      if (!parent) continue;
      const athlete = studentById.get(link.athleteId);
      rows.push({
        linkId: link.id,
        parentUserId: parent.id,
        parentName: parent.fullName,
        parentEmail: parent.email,
        athleteId: link.athleteId,
        athleteName: athlete
          ? `${athlete.lastName} ${athlete.firstName}`.trim()
          : '—',
        createdAt: link.createdAt,
      });
    }

    return rows.sort((a, b) => a.parentName.localeCompare(b.parentName, 'el'));
  });
}

export async function connectParent(input: ConnectParentInput) {
  return apiClient(async () => {
    if (!canManageParents(input.clubId)) {
      throw new Error('Δεν έχετε δικαίωμα σύνδεσης γονέα');
    }

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();
    const athleteId = input.athleteId;

    if (fullName.length < 2) throw new Error('Συμπληρώστε ονοματεπώνυμο γονέα');
    if (!email.includes('@')) throw new Error('Μη έγκυρο email');
    if (password.length < 6) throw new Error('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
    if (!athleteId) throw new Error('Επιλέξτε αθλητή');

    const data = getData();
    const athlete = data.students.find((s) => s.id === athleteId);
    if (!athlete || athlete.status === 'inactive') {
      throw new Error('Ο αθλητής δεν βρέθηκε');
    }

    const users = getUsers();
    let parent = users.find(
      (u) => u.email.toLowerCase() === email && u.clubId === input.clubId,
    );

    if (parent && parent.role !== 'parent') {
      throw new Error('Το email ανήκει ήδη σε άλλο ρόλο');
    }

    const hashed = await prepareStoredPassword(password);

    if (!parent) {
      if (users.some((u) => u.email.toLowerCase() === email)) {
        throw new Error('Υπάρχει ήδη λογαριασμός με αυτό το email');
      }
      parent = {
        id: createId('user'),
        email,
        password: hashed,
        fullName,
        role: 'parent',
        active: true,
        clubId: input.clubId,
        permissions: [],
      } satisfies AppUser;
      saveUsers([...users, parent]);
    } else {
      const next = users.map((u) =>
        u.id === parent!.id
          ? {
              ...u,
              fullName,
              password: hashed,
              active: true,
              role: 'parent' as const,
            }
          : u,
      );
      saveUsers(next);
    }

    const parentUserId = parent.id;
    let created: ParentAthleteLink | undefined;
    mutateData((store) => {
      if (!store.parentLinks) store.parentLinks = [];
      const exists = store.parentLinks.some(
        (link) => link.parentUserId === parentUserId && link.athleteId === athleteId,
      );
      if (exists) throw new Error('Ο γονέας είναι ήδη συνδεδεμένος με αυτόν τον αθλητή');
      created = {
        id: createId('plink'),
        parentUserId,
        athleteId,
        createdAt: localDateTimeIso(),
      };
      store.parentLinks.unshift(created);
    });

    return created!;
  });
}

export async function disconnectParentLink(clubId: string, linkId: string) {
  return apiClient(() => {
    if (!canManageParents(clubId)) {
      throw new Error('Δεν έχετε δικαίωμα αποσύνδεσης');
    }
    mutateData((data) => {
      data.parentLinks = (data.parentLinks ?? []).filter((link) => link.id !== linkId);
    });
    return { id: linkId };
  });
}
