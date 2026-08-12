import { apiClient } from '../apiClient';
import { getSession } from '../../auth/auth';
import { getClubById } from '../../auth/clubs';
import { createId, getData, mutateData } from '../../data/repository';
import type { RegistrationApplication, Student } from '../../types';
import { localDateIso } from '../../utils/dates';

function clubNameForSession(): string {
  const session = getSession();
  const club = getClubById(session?.clubId);
  return club?.name ?? '';
}

export async function getRegistrationApplications() {
  return apiClient(() => getData().registrationApplications ?? []);
}

export async function approveRegistrationApplication(id: string) {
  return apiClient(() => {
    let athleteId: string | null = null;
    let application: RegistrationApplication | null = null;

    mutateData((data) => {
      const apps = data.registrationApplications ?? [];
      const index = apps.findIndex((a) => a.id === id);
      if (index < 0) throw new Error('Η αίτηση δεν βρέθηκε.');
      const app = apps[index];
      if (app.status === 'approved' && app.athleteId) {
        application = app;
        athleteId = app.athleteId;
        return;
      }
      if (app.status === 'rejected') {
        throw new Error('Η αίτηση έχει απορριφθεί.');
      }

      const cls = app.classId
        ? data.classes.find((c) => c.id === app.classId) ?? null
        : null;

      const athlete: Student = {
        id: createId('stu'),
        firstName: app.firstName,
        lastName: app.lastName,
        email: app.email || '',
        phone: '',
        birthDate: app.birthDate || '',
        guardianName: app.guardianName,
        guardianPhone: app.guardianPhone,
        classId: app.classId,
        status: app.kind === 'trial' ? 'trial' : 'active',
        monthlyFee: cls?.monthlyFee ?? 0,
        enrolledAt: localDateIso(),
        gender: app.gender || '',
        clubName: clubNameForSession(),
        sport: cls?.sport ?? '',
        healthCard: false,
        comments: app.notes?.trim() || 'Δημόσια εγγραφή (έγκριση)',
        gdprConsent: 'pending',
      };
      data.students = [athlete, ...data.students];
      athleteId = athlete.id;

      application = {
        ...app,
        status: 'approved',
        athleteId: athlete.id,
      };
      data.registrationApplications = apps.map((a, i) => (i === index ? application! : a));
    });

    return {
      application: application!,
      athleteId,
    };
  });
}

export async function rejectRegistrationApplication(id: string) {
  return apiClient(() => {
    let application: RegistrationApplication | null = null;
    mutateData((data) => {
      const apps = data.registrationApplications ?? [];
      const index = apps.findIndex((a) => a.id === id);
      if (index < 0) throw new Error('Η αίτηση δεν βρέθηκε.');
      const app = apps[index];
      if (app.status === 'approved') {
        throw new Error('Η αίτηση έχει ήδη εγκριθεί.');
      }
      application = { ...app, status: 'rejected' };
      data.registrationApplications = apps.map((a, i) => (i === index ? application! : a));
    });
    return application!;
  });
}
