import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import {
  appendClubWaitlist,
  appendLoginActivity,
  assertSyncAuthorized,
  consumePasswordResetToken,
  createPasswordResetToken,
  hashPassword,
  isDurableStoreEnabled,
  listClubWaitlist,
  listLoginActivity,
  loadAccountBundle,
  saveAccountBundle,
  signSession,
  deleteClubWaitlist,
  updateClubWaitlist,
  uploadClubMedia,
  verifyPassword,
  verifySessionToken,
  type ClubWaitlistEntry,
  type LoginActivityEvent,
} from '../lib/serverStore.js';

type BundleUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  active?: boolean;
  clubId?: string | null;
};

type BundleClub = {
  id: string;
  name?: string;
  smtp?: {
    enabled?: boolean;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    fromName?: string;
  };
};

type SmtpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
};

function parseLoginEvent(body: unknown): LoginActivityEvent | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const at = typeof raw.at === 'string' ? raw.at.trim() : '';
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const fullName = typeof raw.fullName === 'string' ? raw.fullName.trim() : '';
  const role = typeof raw.role === 'string' ? raw.role.trim() : '';
  const source =
    raw.source === 'impersonate' ? 'impersonate' : raw.source === 'login' ? 'login' : null;
  if (!id || !at || !userId || !email || !fullName || !role || !source) return null;

  const clubId =
    raw.clubId == null || raw.clubId === ''
      ? null
      : typeof raw.clubId === 'string'
        ? raw.clubId
        : null;
  const clubName =
    raw.clubName == null || raw.clubName === ''
      ? null
      : typeof raw.clubName === 'string'
        ? raw.clubName
        : null;
  const userAgent =
    raw.userAgent == null || raw.userAgent === ''
      ? null
      : typeof raw.userAgent === 'string'
        ? raw.userAgent.slice(0, 400)
        : null;

  return {
    id,
    at,
    userId,
    email,
    fullName,
    role,
    clubId,
    clubName,
    source,
    userAgent,
  };
}

function kindOf(req: VercelRequest): string {
  return String(req.query.kind ?? req.query.view ?? '').trim();
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function assertWaitlistAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (!assertSyncAuthorized(req, res)) return false;
  const auth = String(req.headers['authorization'] ?? '').trim();
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : auth;
  if (!token.includes('.')) return true;
  const claims = verifySessionToken(token);
  if (claims && claims.role !== 'platform_admin') {
    res.status(403).json({ ok: false, error: 'Μόνο Platform Admin' });
    return false;
  }
  return true;
}

function parseWaitlistSubmit(body: unknown): ClubWaitlistEntry | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  const clubName = clip(raw.clubName, 120);
  const adminFullName = clip(raw.adminFullName, 120);
  const email = clip(raw.email, 160).toLowerCase();
  const phone = clip(raw.phone, 40);
  const sport = clip(raw.sport, 80);
  const dpaAcceptedAt = clip(raw.dpaAcceptedAt, 40);
  if (clubName.length < 2 || adminFullName.length < 2) return null;
  if (!email.includes('@') || phone.length < 6 || sport.length < 2) return null;
  if (!dpaAcceptedAt) return null;

  const levels = Array.isArray(raw.levels)
    ? raw.levels
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const rawId = clip(raw.id, 80);
  const id = /^wl_[a-zA-Z0-9_-]+$/.test(rawId)
    ? rawId
    : `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    clubName,
    adminFullName,
    email,
    phone,
    sport,
    levels,
    createdAt: clip(raw.createdAt, 40) || new Date().toISOString(),
    dpaAcceptedAt,
    status: 'pending',
  };
}

async function handleClubWaitlist(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action =
      (typeof body.action === 'string' ? body.action.trim() : '') ||
      (typeof req.query.action === 'string' ? req.query.action.trim() : '');

    if (action === 'approve' || action === 'reject') {
      if (!assertWaitlistAdmin(req, res)) return;
      const id = clip(body.id, 80);
      if (!id) {
        return res.status(400).json({ ok: false, error: 'Missing waitlist id' });
      }
      if (action === 'reject') {
        const deleted = await deleteClubWaitlist(id);
        if (!deleted) {
          return res.status(404).json({ ok: false, error: 'Waitlist entry not found' });
        }
        return res.status(200).json({
          ok: true,
          durable: isDurableStoreEnabled(),
          deleted: true,
          id,
        });
      }
      const now = new Date().toISOString();
      const clubId = clip(body.clubId, 80) || null;
      const updated = await updateClubWaitlist(id, {
        status: 'approved',
        approvedAt: now,
        rejectedAt: null,
        clubId,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: 'Waitlist entry not found' });
      }
      return res.status(200).json({
        ok: true,
        durable: isDurableStoreEnabled(),
        entry: updated,
      });
    }

    const entry = parseWaitlistSubmit(body);
    if (!entry) {
      return res.status(400).json({ ok: false, error: 'Invalid waitlist payload' });
    }
    const existing = await listClubWaitlist();
    const duplicate = existing.find(
      (item) =>
        item.email === entry.email &&
        (item.status === 'pending' || item.status === 'approved'),
    );
    if (duplicate) {
      return res.status(409).json({
        ok: false,
        error:
          duplicate.status === 'approved'
            ? 'Υπάρχει ήδη εγκεκριμένος λογαριασμός με αυτό το email'
            : 'Υπάρχει ήδη αίτηση σε αναμονή με αυτό το email',
        id: duplicate.id,
      });
    }
    const entries = await appendClubWaitlist(entry);
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      id: entry.id,
      total: entries.length,
    });
  }

  if (req.method === 'GET') {
    if (!assertWaitlistAdmin(req, res)) return;
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 200;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
    const entries = (await listClubWaitlist(limit)).filter((e) => e.status !== 'rejected');
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      entries,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

function publicUser(user: BundleUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    clubId: user.clubId ?? null,
    active: user.active !== false,
  };
}

function resolvePlatformSmtp(): SmtpConfig | null {
  const host = (process.env.SMTP_HOST || process.env.PLATFORM_SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || process.env.PLATFORM_SMTP_PORT || 587);
  const username = (process.env.SMTP_USER || process.env.PLATFORM_SMTP_USER || '').trim();
  const password = (process.env.SMTP_PASS || process.env.PLATFORM_SMTP_PASS || '').trim();
  const fromName = (
    process.env.SMTP_FROM_NAME ||
    process.env.PLATFORM_SMTP_FROM_NAME ||
    'SPORTSUITE 360'
  ).trim();
  if (!host || !username || !password) return null;
  return { host, port: Number.isFinite(port) ? port : 587, username, password, fromName };
}

function resolveClubSmtp(clubs: BundleClub[], clubId: string | null | undefined): SmtpConfig | null {
  if (!clubId) return null;
  const club = clubs.find((c) => c.id === clubId);
  const smtp = club?.smtp;
  if (!smtp?.enabled) return null;
  const host = String(smtp.host ?? '').trim();
  const username = String(smtp.username ?? '').trim();
  const password = String(smtp.password ?? '').trim();
  const port = Number(smtp.port || 587);
  if (!host || !username || !password) return null;
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    username,
    password,
    fromName: String(smtp.fromName || club?.name || 'SPORTSUITE 360').trim(),
  };
}

async function sendSmtpMail(
  smtp: SmtpConfig,
  input: { to: string; subject: string; text: string; html: string },
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
  });
  const fromName = smtp.fromName.replace(/[\r\n]/g, '');
  await transporter.sendMail({
    from: `"${fromName}" <${smtp.username}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

async function handleSession(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? 'login').trim();

  if (action === 'verify') {
    const token = String(body.token ?? '').trim();
    const claims = verifySessionToken(token);
    if (!claims) return res.status(401).json({ ok: false, error: 'Invalid session' });
    return res.status(200).json({ ok: true, user: claims });
  }

  if (action === 'login') {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body.password ?? '').trim();
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }
    const bundle = await loadAccountBundle();
    const users = Array.isArray(bundle?.users) ? (bundle!.users as BundleUser[]) : [];
    const user = users.find((u) => u.email?.toLowerCase() === email && u.active !== false);
    if (!user || !(await verifyPassword(password, user.password ?? ''))) {
      return res.status(401).json({ ok: false, error: 'Λάθος email ή κωδικός' });
    }
    let nextPassword = user.password;
    if (user.password && !user.password.startsWith('pbkdf2$')) {
      nextPassword = await hashPassword(password);
      const nextUsers = users.map((u) =>
        u.id === user.id ? { ...u, password: nextPassword } : u,
      );
      await saveAccountBundle({
        users: nextUsers,
        clubs: bundle!.clubs,
        platformConfig: bundle!.platformConfig,
      });
    }
    const token = signSession({
      sub: user.id,
      email: user.email,
      role: user.role,
      clubId: user.clubId ?? null,
    });
    if (!token) {
      return res.status(503).json({
        ok: false,
        error: 'Session signing unavailable (configure SS360_SYNC_SECRET)',
      });
    }
    return res.status(200).json({
      ok: true,
      token,
      user: publicUser({ ...user, password: nextPassword }),
    });
  }

  if (action === 'forgot') {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const origin = String(body.origin ?? '')
      .trim()
      .replace(/\/$/, '');
    if (!email) return res.status(400).json({ ok: false, error: 'email required' });

    const generic = {
      ok: true as const,
      emailed: false,
      message:
        'Αν υπάρχει λογαριασμός με αυτό το email, στάλθηκαν οδηγίες επαναφοράς στο inbox σας.',
    };

    const bundle = await loadAccountBundle();
    const users = Array.isArray(bundle?.users) ? (bundle!.users as BundleUser[]) : [];
    const clubs = Array.isArray(bundle?.clubs) ? (bundle!.clubs as BundleClub[]) : [];
    const user = users.find((u) => u.email?.toLowerCase() === email && u.active !== false);
    if (!user) {
      return res.status(200).json(generic);
    }

    const resetToken = await createPasswordResetToken(user.id, user.email);
    const appUrl =
      origin ||
      (process.env.APP_URL || '').replace(/\/$/, '') ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : '');
    const resetUrl = appUrl
      ? `${appUrl}/login?reset=${encodeURIComponent(resetToken)}`
      : '';

    const smtp = resolvePlatformSmtp() || resolveClubSmtp(clubs, user.clubId ?? null);
    if (!smtp) {
      return res.status(200).json({
        ...generic,
        message:
          'Δεν υπάρχει ρυθμισμένο SMTP. Ορίστε SMTP_HOST/USER/PASS στο Vercel ή ενεργοποιήστε SMTP συλλόγου + Push λογαριασμών.',
      });
    }

    const subject = 'SPORTSUITE 360 — Επαναφορά κωδικού';
    const text = [
      'Λάβαμε αίτημα επαναφοράς κωδικού για τον λογαριασμό σας.',
      '',
      resetUrl
        ? `Ανοίξτε τον σύνδεσμο (ισχύει 1 ώρα):\n${resetUrl}`
        : `Κωδικός επαναφοράς (ισχύει 1 ώρα):\n${resetToken}`,
      '',
      'Αν δεν ζητήσατε εσείς επαναφορά, αγνοήστε αυτό το μήνυμα.',
    ].join('\n');
    const html = `
      <p>Λάβαμε αίτημα επαναφοράς κωδικού για τον λογαριασμό σας στο <strong>SPORTSUITE 360</strong>.</p>
      ${
        resetUrl
          ? `<p><a href="${resetUrl}">Πατήστε εδώ για νέο κωδικό</a> (ισχύει 1 ώρα).</p>
             <p style="word-break:break-all;font-size:12px;color:#666">${resetUrl}</p>`
          : `<p>Κωδικός επαναφοράς (ισχύει 1 ώρα):</p><p><code>${resetToken}</code></p>`
      }
      <p>Αν δεν ζητήσατε εσείς επαναφορά, αγνοήστε αυτό το μήνυμα.</p>
    `;

    try {
      await sendSmtpMail(smtp, { to: user.email, subject, text, html });
      return res.status(200).json({
        ok: true,
        emailed: true,
        message: 'Στείλαμε οδηγίες επαναφοράς στο email σας. Ελέγξτε inbox/spam.',
      });
    } catch (err) {
      return res.status(200).json({
        ok: true,
        emailed: false,
        message:
          'Αποτυχία αποστολής email. Ελέγξτε τις ρυθμίσεις SMTP. ' +
          (err instanceof Error ? err.message : ''),
      });
    }
  }

  if (action === 'reset') {
    const resetToken = String(body.resetToken ?? body.token ?? '').trim();
    const newPassword = String(body.newPassword ?? '').trim();
    if (!resetToken || newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: 'resetToken and newPassword (min 6) required' });
    }
    const record = await consumePasswordResetToken(resetToken);
    if (!record) return res.status(400).json({ ok: false, error: 'Μη έγκυρο ή ληγμένο token' });
    const bundle = await loadAccountBundle();
    if (!bundle || !Array.isArray(bundle.users)) {
      return res.status(404).json({ ok: false, error: 'No account bundle' });
    }
    const users = bundle.users as BundleUser[];
    const idx = users.findIndex((u) => u.id === record.userId);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'User not found' });
    const hashed = await hashPassword(newPassword);
    const nextUsers = users.map((u, i) => (i === idx ? { ...u, password: hashed } : u));
    await saveAccountBundle({
      users: nextUsers,
      clubs: bundle.clubs,
      platformConfig: bundle.platformConfig,
    });
    return res.status(200).json({ ok: true, email: record.email });
  }

  return res.status(400).json({ ok: false, error: 'Unknown session action' });
}

async function handleMedia(req: VercelRequest, res: VercelResponse) {
  if (!assertSyncAuthorized(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const clubId = String(body.clubId ?? '').trim();
  const fileName = String(body.fileName ?? 'photo.jpg').trim();
  const contentType = String(body.contentType ?? 'image/jpeg').trim();
  const dataBase64 = String(body.dataBase64 ?? '').trim();
  if (!clubId || !dataBase64) {
    return res.status(400).json({ ok: false, error: 'clubId and dataBase64 required' });
  }
  try {
    const uploaded = await uploadClubMedia({ clubId, fileName, contentType, dataBase64 });
    return res.status(200).json({ ok: true, ...uploaded });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    });
  }
}

/**
 * Cloud accounts + login-activity + session + media (Hobby-friendly single function).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const kind = kindOf(req);

  if (kind === 'session') {
    return handleSession(req, res);
  }

  if (kind === 'media') {
    return handleMedia(req, res);
  }

  if (kind === 'club-waitlist') {
    return handleClubWaitlist(req, res);
  }

  if (!assertSyncAuthorized(req, res)) return;

  if (kind === 'login-activity') {
    if (req.method === 'GET') {
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) ? limitRaw : 100;
      const events = await listLoginActivity(limit);
      return res.status(200).json({
        ok: true,
        durable: isDurableStoreEnabled(),
        events,
      });
    }

    if (req.method === 'POST') {
      const event = parseLoginEvent(req.body);
      if (!event) {
        return res.status(400).json({ ok: false, error: 'Invalid login activity payload' });
      }
      const events = await appendLoginActivity(event);
      return res.status(200).json({
        ok: true,
        durable: isDurableStoreEnabled(),
        id: event.id,
        total: events.length,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (req.method === 'GET') {
    const bundle = await loadAccountBundle();
    if (!bundle) {
      return res.status(404).json({
        ok: false,
        durable: isDurableStoreEnabled(),
        error: 'No account bundle',
      });
    }
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      ...bundle,
    });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as {
      users?: unknown;
      clubs?: unknown;
      platformConfig?: unknown;
    };
    if (body.users == null || body.clubs == null) {
      return res.status(400).json({ ok: false, error: 'users and clubs required' });
    }
    const saved = await saveAccountBundle({
      users: body.users,
      clubs: body.clubs,
      platformConfig: body.platformConfig,
    });
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      updatedAt: saved.updatedAt,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
