import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertSyncAuthorized,
  getSyncAuthContext,
  isDurableStoreEnabled,
  loadMirror,
  saveMirror,
} from '../lib/serverStore.js';

type MirrorPayload = {
  students?: Array<Record<string, unknown>>;
  transactions?: Array<Record<string, unknown>>;
  attendance?: Array<Record<string, unknown>>;
  parentLinks?: Array<Record<string, unknown>>;
  progressReports?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  gdprAuditLogs?: Array<Record<string, unknown>>;
};

function clientIp(req: VercelRequest): string {
  const xf = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return xf || String(req.headers['x-real-ip'] ?? '') || '';
}

function assertClubAccess(
  req: VercelRequest,
  res: VercelResponse,
  clubId: string,
): boolean {
  if (!assertSyncAuthorized(req, res)) return false;
  const ctx = getSyncAuthContext(req);
  if (ctx.viaSecret) return true;
  if (ctx.claims?.role === 'platform_admin') return true;
  if (ctx.claims?.clubId && ctx.claims.clubId === clubId) return true;
  if (ctx.claims && !ctx.claims.clubId && ctx.claims.role === 'platform_admin') return true;
  res.status(403).json({ ok: false, error: 'Forbidden: club mismatch' });
  return false;
}

function matchStudent(
  student: Record<string, unknown>,
  athleteId?: string,
  email?: string,
): boolean {
  if (athleteId && String(student.id) === athleteId) return true;
  const want = (email || '').trim().toLowerCase();
  if (!want) return false;
  const fields = [student.email, student.fatherEmail, student.motherEmail];
  return fields.some((v) => String(v ?? '').trim().toLowerCase() === want);
}

/**
 * GDPR DSAR on cloud mirror:
 * GET  /api/gdpr/data?clubId=&athleteId=|&email=
 * DELETE /api/gdpr/data  body { clubId, athleteId?, email? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clubId = String(
    req.method === 'GET' ? req.query.clubId ?? '' : (req.body as { clubId?: string })?.clubId ?? '',
  ).trim();
  if (!clubId) return res.status(400).json({ ok: false, error: 'clubId required' });
  if (!assertClubAccess(req, res, clubId)) return;

  const athleteId = String(
    req.method === 'GET'
      ? req.query.athleteId ?? ''
      : (req.body as { athleteId?: string })?.athleteId ?? '',
  ).trim();
  const email = String(
    req.method === 'GET'
      ? req.query.email ?? ''
      : (req.body as { email?: string })?.email ?? '',
  ).trim();

  if (!athleteId && !email) {
    return res.status(400).json({ ok: false, error: 'athleteId or email required' });
  }

  const mirror = await loadMirror(clubId);
  if (!mirror) return res.status(404).json({ ok: false, error: 'No mirror for club' });
  const payload = (mirror.payload ?? {}) as MirrorPayload;
  const students = Array.isArray(payload.students) ? payload.students : [];
  const matched = students.filter((s) => matchStudent(s, athleteId || undefined, email || undefined));

  if (req.method === 'GET') {
    if (!matched.length) return res.status(404).json({ ok: false, error: 'Subject not found' });
    const ids = new Set(matched.map((s) => String(s.id)));
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      exportedAt: new Date().toISOString(),
      students: matched,
      transactions: (payload.transactions ?? []).filter((t) => ids.has(String(t.athleteId))),
      attendance: (payload.attendance ?? []).filter((a) => ids.has(String(a.studentId))),
      parentLinks: (payload.parentLinks ?? []).filter((l) => ids.has(String(l.athleteId))),
      progressReports: (payload.progressReports ?? []).filter((r) =>
        ids.has(String(r.athleteId)),
      ),
      photos: (payload.photos ?? []).filter((p) => {
        const athleteIds = p.athleteIds;
        return Array.isArray(athleteIds) && athleteIds.some((id) => ids.has(String(id)));
      }),
    });
  }

  if (req.method === 'DELETE') {
    if (!matched.length) return res.status(404).json({ ok: false, error: 'Subject not found' });
    const erasedIds = new Set(matched.map((s) => String(s.id)));
    for (const student of matched) {
      student.firstName = 'Διαγραμμένο';
      student.lastName = 'Υποκείμενο';
      student.email = '';
      student.fatherEmail = '';
      student.motherEmail = '';
      student.phone = '';
      student.guardianPhone = '';
      student.amka = '';
      student.allergies = '';
      student.chronicConditions = '';
      student.medication = '';
      student.bloodType = '';
      student.doctorName = '';
      student.doctorPhone = '';
      student.photoUrl = null;
      student.status = 'inactive';
      student.gdprConsent = 'locked';
      student.gdprItems = {
        personalData: false,
        photoUse: false,
        gallery: false,
        communication: false,
        medical: false,
        amkaHealthCard: false,
      };
    }
    payload.photos = (payload.photos ?? []).filter((p) => {
      const athleteIds = p.athleteIds;
      if (!Array.isArray(athleteIds)) return true;
      return !athleteIds.some((id) => erasedIds.has(String(id)));
    });
    if (!Array.isArray(payload.gdprAuditLogs)) payload.gdprAuditLogs = [];
    payload.gdprAuditLogs.unshift({
      id: `gdpr_${Date.now()}`,
      at: new Date().toISOString(),
      action: 'erase',
      subjectAthleteId: athleteId || undefined,
      subjectEmail: email || undefined,
      ip: clientIp(req),
      detail: `Cloud erase ${erasedIds.size}`,
    });

    const result = await saveMirror(clubId, payload, { baseUpdatedAt: mirror.updatedAt });
    if (!result.ok) {
      return res.status(409).json({ ok: false, conflict: true, error: 'Mirror conflict' });
    }
    return res.status(200).json({
      ok: true,
      erased: erasedIds.size,
      durable: isDurableStoreEnabled(),
      updatedAt: result.updatedAt,
    });
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
