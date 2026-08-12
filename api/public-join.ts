import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import {
  appendPendingApplication,
  isDurableStoreEnabled,
  listPendingApplications,
  loadClubNotifyConfig,
  loadMirror,
  loadPublicClubBySlug,
  saveMirror,
  type RemoteRegistrationApplication,
} from './lib/serverStore.js';

type Body = {
  slug?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
  email?: string;
  classId?: string | null;
  kind?: 'full' | 'trial' | 'waitlist';
  notes?: string;
  acceptedTerms?: boolean;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Staff pull of remote pending applications
    const clubId = String(req.query.clubId ?? '').trim();
    if (!clubId) {
      return res.status(400).json({ ok: false, error: 'clubId required' });
    }
    const applications = await listPendingApplications(clubId);
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      applications,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Body;
  const slug = String(body.slug ?? '').trim().toLowerCase();
  if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
  if (!body.acceptedTerms) {
    return res.status(400).json({ ok: false, error: 'Πρέπει να αποδεχτείτε τους όρους χρήσης / GDPR.' });
  }

  const club = await loadPublicClubBySlug(slug);
  if (!club || !club.enabled) {
    return res.status(404).json({
      ok: false,
      error: 'Ο σύνδεσμος δεν βρέθηκε ή η δημόσια εγγραφή δεν είναι ενεργή.',
    });
  }

  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const guardianName = String(body.guardianName ?? '').trim();
  const guardianPhone = String(body.guardianPhone ?? '').trim();
  const email = String(body.email ?? '').trim();
  const notes = String(body.notes ?? '').trim();
  const birthDate = String(body.birthDate ?? '').trim();
  const gender = String(body.gender ?? '');
  let kind = (body.kind ?? 'full') as 'full' | 'trial' | 'waitlist';
  const classId = body.classId ? String(body.classId) : null;

  if (firstName.length < 2 || lastName.length < 2) {
    return res.status(400).json({ ok: false, error: 'Συμπληρώστε όνομα και επώνυμο.' });
  }
  if (!guardianName || !guardianPhone) {
    return res.status(400).json({ ok: false, error: 'Συμπληρώστε στοιχεία κηδεμόνα.' });
  }
  if (kind === 'trial' && !club.allowTrial) {
    return res.status(400).json({ ok: false, error: 'Η δοκιμαστική προπόνηση δεν επιτρέπεται.' });
  }
  if (kind === 'waitlist' && !club.allowWaitlist) {
    return res.status(400).json({ ok: false, error: 'Η λίστα αναμονής δεν επιτρέπεται.' });
  }

  const mirror = await loadMirror(club.clubId);
  const payload =
    mirror?.payload && typeof mirror.payload === 'object'
      ? (mirror.payload as Record<string, unknown>)
      : null;

  if (classId && payload && Array.isArray(payload.classes) && Array.isArray(payload.students)) {
    const cls = (payload.classes as Array<{ id: string; maxStudents?: number }>).find(
      (c) => c.id === classId,
    );
    const activeCount = (payload.students as Array<{ classId?: string | null; status?: string }>).filter(
      (s) => s.classId === classId && s.status !== 'inactive',
    ).length;
    const max = cls?.maxStudents ?? 0;
    if (max > 0 && activeCount >= max && club.allowWaitlist) {
      kind = 'waitlist';
    }
  }

  const shouldCreateAthlete =
    club.autoApprove && kind !== 'waitlist' && (kind === 'full' || kind === 'trial');

  const createdAt = new Date().toISOString().slice(0, 10);
  const applicationId = `rapp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let athleteId: string | null = null;

  if (shouldCreateAthlete && payload && Array.isArray(payload.students)) {
    athleteId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cls = Array.isArray(payload.classes)
      ? (payload.classes as Array<{ id: string; monthlyFee?: number; sport?: string }>).find(
          (c) => c.id === classId,
        )
      : null;
    const athlete = {
      id: athleteId,
      firstName,
      lastName,
      email,
      phone: '',
      birthDate,
      guardianName,
      guardianPhone,
      classId,
      status: kind === 'trial' ? 'trial' : 'active',
      monthlyFee: cls?.monthlyFee ?? 0,
      enrolledAt: createdAt,
      gender,
      clubName: club.name,
      sport: cls?.sport ?? '',
      healthCard: false,
      comments: notes || 'Δημόσια εγγραφή',
      gdprConsent: 'full',
    };
    payload.students = [athlete, ...(payload.students as unknown[])];
  }

  const application: RemoteRegistrationApplication = {
    id: applicationId,
    firstName,
    lastName,
    birthDate,
    gender,
    guardianName,
    guardianPhone,
    email,
    classId,
    kind,
    status: shouldCreateAthlete ? 'approved' : 'pending',
    notes,
    createdAt,
    athleteId,
  };

  await appendPendingApplication(club.clubId, application);

  if (payload) {
    const apps = Array.isArray(payload.registrationApplications)
      ? (payload.registrationApplications as RemoteRegistrationApplication[])
      : [];
    payload.registrationApplications = [application, ...apps.filter((a) => a.id !== application.id)];
    await saveMirror(club.clubId, payload);
  }

  const notify = await loadClubNotifyConfig(club.clubId);
  let clubEmailSent = false;
  let guardianEmailSent = false;

  if (notify?.smtp?.enabled && notify.smtp.host && notify.smtp.username && notify.smtp.password) {
    const kindLabel =
      kind === 'trial' ? 'Δοκιμαστική' : kind === 'waitlist' ? 'Λίστα αναμονής' : 'Πλήρης εγγραφή';
    const clubTo = (notify.notifyEmail || notify.smtp.username || '').trim();
    if (clubTo.includes('@')) {
      clubEmailSent = await sendMail(notify.smtp, {
        to: clubTo,
        subject: `Νέα αίτηση εγγραφής · ${lastName} ${firstName}`,
        text: [
          `Νέα αίτηση δημόσιας εγγραφής στον σύλλογο ${club.name}.`,
          '',
          `Αθλητής: ${lastName} ${firstName}`,
          `Τύπος: ${kindLabel}`,
          `Τηλ. κηδεμόνα: ${guardianPhone}`,
          email ? `Email: ${email}` : '',
          '',
          'Άνοιξε Αθλητές για έγκριση ή απόρριψη.',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }

    if (email.includes('@')) {
      guardianEmailSent = await sendMail(notify.smtp, {
        to: email,
        subject: `Επιβεβαίωση αίτησης · ${club.name}`,
        text: [
          `Αγαπητέ/ή ${guardianName},`,
          '',
          `Λάβαμε την αίτηση εγγραφής για τον/την ${firstName} ${lastName} στον σύλλογο ${club.name}.`,
          shouldCreateAthlete
            ? 'Η εγγραφή καταχωρήθηκε.'
            : kind === 'waitlist'
              ? 'Η αίτηση μπήκε στη λίστα αναμονής.'
              : 'Η αίτηση εκκρεμεί έγκριση από τον σύλλογο.',
          '',
          'Ευχαριστούμε.',
          club.name,
        ].join('\n'),
      });
    }
  }

  const mode = shouldCreateAthlete ? 'athlete' : 'application';
  return res.status(200).json({
    ok: true,
    durable: isDurableStoreEnabled(),
    mode,
    kind,
    athleteId,
    clubEmailSent,
    guardianEmailSent,
    applicationId,
    message:
      mode === 'athlete'
        ? 'Η εγγραφή ολοκληρώθηκε.'
        : kind === 'waitlist'
          ? 'Η αίτηση μπήκε στη λίστα αναμονής.'
          : 'Η αίτηση υποβλήθηκε και εκκρεμεί έγκριση.',
  });
}

async function sendMail(
  smtp: {
    host: string;
    port: string;
    username: string;
    password: string;
    fromName: string;
  },
  message: { to: string; subject: string; text: string },
): Promise<boolean> {
  try {
    const port = Number(smtp.port) || 587;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port,
      secure: port === 465,
      auth: { user: smtp.username, pass: smtp.password },
    });
    const fromName = (smtp.fromName || 'SPORTSUITE 360').replace(/[\r\n]/g, '');
    await transporter.sendMail({
      from: `"${fromName}" <${smtp.username}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return true;
  } catch {
    return false;
  }
}
