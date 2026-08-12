import { apiClient } from '../apiClient';
import { getClubById, getClubPublicRegistration } from '../../auth/clubs';
import { createId, mutateClubData } from '../../data/repository';
import { localDateIso } from '../../utils/dates';
import type {
  RegistrationApplication,
  RegistrationApplicationKind,
  Student,
} from '../../types';
import { notifyClubNewRegistration } from './registrationApplicationsService';

export type PublicJoinInput = {
  clubId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: '' | 'boy' | 'girl' | 'other';
  guardianName: string;
  guardianPhone: string;
  email: string;
  classId: string | null;
  kind: RegistrationApplicationKind;
  notes?: string;
  acceptedTerms: boolean;
};

function classIsFull(classId: string | null, maxStudents: number, activeCount: number): boolean {
  if (!classId) return false;
  return activeCount >= maxStudents;
}

export async function submitPublicJoin(input: PublicJoinInput) {
  return apiClient(async () => {
    const club = getClubById(input.clubId);
    if (!club) throw new Error('Ο σύλλογος δεν βρέθηκε.');
    const settings = getClubPublicRegistration(club.id);
    if (!settings.enabled) throw new Error('Η δημόσια εγγραφή δεν είναι ενεργή.');
    if (!input.acceptedTerms) {
      throw new Error('Πρέπει να αποδεχτείτε τους όρους χρήσης / GDPR.');
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    if (firstName.length < 2 || lastName.length < 2) {
      throw new Error('Συμπληρώστε όνομα και επώνυμο.');
    }
    if (!input.guardianName.trim() || !input.guardianPhone.trim()) {
      throw new Error('Συμπληρώστε στοιχεία κηδεμόνα.');
    }
    if (input.kind === 'trial' && !settings.allowTrial) {
      throw new Error('Η δοκιμαστική προπόνηση δεν επιτρέπεται.');
    }
    if (input.kind === 'waitlist' && !settings.allowWaitlist) {
      throw new Error('Η λίστα αναμονής δεν επιτρέπεται.');
    }

    let resultKind = input.kind;
    let createdAthleteId: string | null = null;

    mutateClubData(input.clubId, (data) => {
      const cls = input.classId
        ? data.classes.find((c) => c.id === input.classId) ?? null
        : null;
      const activeInClass = input.classId
        ? data.students.filter((s) => s.classId === input.classId && s.status !== 'inactive')
            .length
        : 0;
      const full = classIsFull(input.classId, cls?.maxStudents ?? 0, activeInClass);

      if (full && settings.allowWaitlist) {
        resultKind = 'waitlist';
      }

      const shouldCreateAthlete =
        settings.autoApprove &&
        resultKind !== 'waitlist' &&
        (resultKind === 'full' || resultKind === 'trial');

      if (shouldCreateAthlete) {
        const athlete: Student = {
          id: createId('stu'),
          firstName,
          lastName,
          email: input.email.trim(),
          phone: '',
          birthDate: input.birthDate,
          guardianName: input.guardianName.trim(),
          guardianPhone: input.guardianPhone.trim(),
          classId: input.classId,
          status: resultKind === 'trial' ? 'trial' : 'active',
          monthlyFee: cls?.monthlyFee ?? 0,
          enrolledAt: localDateIso(),
          gender: input.gender,
          clubName: club.name,
          sport: cls?.sport ?? '',
          healthCard: false,
          comments: input.notes?.trim() || 'Δημόσια εγγραφή',
          gdprConsent: 'full',
        };
        data.students = [athlete, ...data.students];
        createdAthleteId = athlete.id;
      }

      const application: RegistrationApplication = {
        id: createId('rapp'),
        firstName,
        lastName,
        birthDate: input.birthDate,
        gender: input.gender,
        guardianName: input.guardianName.trim(),
        guardianPhone: input.guardianPhone.trim(),
        email: input.email.trim(),
        classId: input.classId,
        kind: resultKind,
        status: shouldCreateAthlete ? 'approved' : 'pending',
        notes: input.notes?.trim() || '',
        createdAt: localDateIso(),
        athleteId: createdAthleteId,
      };
      data.registrationApplications = [application, ...(data.registrationApplications ?? [])];
    });

    const resolvedMode: 'athlete' | 'application' = createdAthleteId
      ? 'athlete'
      : 'application';

    // Best-effort notify — μην αποτύχει η υποβολή αν λείπει SMTP.
    let emailSent = false;
    try {
      const notify = await notifyClubNewRegistration({
        clubId: input.clubId,
        firstName,
        lastName,
        kind: resultKind,
        guardianPhone: input.guardianPhone.trim(),
      });
      emailSent = notify.sent;
    } catch {
      emailSent = false;
    }

    return {
      mode: resolvedMode,
      kind: resultKind,
      athleteId: createdAthleteId,
      emailSent,
      message:
        resolvedMode === 'athlete'
          ? 'Η εγγραφή ολοκληρώθηκε.'
          : resultKind === 'waitlist'
            ? 'Η αίτηση μπήκε στη λίστα αναμονής.'
            : 'Η αίτηση υποβλήθηκε και εκκρεμεί έγκριση.',
    };
  });
}
