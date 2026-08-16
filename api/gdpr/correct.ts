import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertSyncAuthorized,
  getSyncAuthContext,
  isDurableStoreEnabled,
  loadMirror,
  saveMirror,
} from '../lib/serverStore.js';

const ALLOWED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'address',
  'city',
  'postalCode',
  'fatherEmail',
  'motherEmail',
  'guardianPhone',
  'motherPhone',
] as const;

/**
 * POST /api/gdpr/correct — rectification of personal data on cloud mirror
 * body: { clubId, athleteId, patch }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!assertSyncAuthorized(req, res)) return;

  const body = (req.body ?? {}) as {
    clubId?: string;
    athleteId?: string;
    patch?: Record<string, unknown>;
  };
  const clubId = String(body.clubId ?? '').trim();
  const athleteId = String(body.athleteId ?? '').trim();
  if (!clubId || !athleteId) {
    return res.status(400).json({ ok: false, error: 'clubId and athleteId required' });
  }

  const ctx = getSyncAuthContext(req);
  if (
    ctx.claims?.clubId &&
    ctx.claims.clubId !== clubId &&
    ctx.claims.role !== 'platform_admin' &&
    !ctx.viaSecret
  ) {
    return res.status(403).json({ ok: false, error: 'Forbidden: club mismatch' });
  }

  const mirror = await loadMirror(clubId);
  if (!mirror) return res.status(404).json({ ok: false, error: 'No mirror for club' });
  const payload = (mirror.payload ?? {}) as {
    students?: Array<Record<string, unknown>>;
    gdprAuditLogs?: Array<Record<string, unknown>>;
  };
  const student = (payload.students ?? []).find((s) => String(s.id) === athleteId);
  if (!student) return res.status(404).json({ ok: false, error: 'Athlete not found' });

  const patch = body.patch ?? {};
  const applied: string[] = [];
  for (const key of ALLOWED_FIELDS) {
    if (patch[key] === undefined) continue;
    student[key] = String(patch[key] ?? '');
    applied.push(key);
  }
  if (!applied.length) {
    return res.status(400).json({ ok: false, error: 'No allowed fields in patch' });
  }

  if (!Array.isArray(payload.gdprAuditLogs)) payload.gdprAuditLogs = [];
  payload.gdprAuditLogs.unshift({
    id: `gdpr_${Date.now()}`,
    at: new Date().toISOString(),
    action: 'correct',
    subjectAthleteId: athleteId,
    detail: applied.join(','),
  });

  const result = await saveMirror(clubId, payload, { baseUpdatedAt: mirror.updatedAt });
  if (!result.ok) {
    return res.status(409).json({ ok: false, conflict: true, error: 'Mirror conflict' });
  }
  return res.status(200).json({
    ok: true,
    applied,
    durable: isDurableStoreEnabled(),
    updatedAt: result.updatedAt,
  });
}
