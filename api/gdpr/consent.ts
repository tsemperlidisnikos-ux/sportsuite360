import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertSyncAuthorized,
  getSyncAuthContext,
  isDurableStoreEnabled,
  loadMirror,
  saveMirror,
  appendGdprConsentLog,
} from '../lib/serverStore.js';

function clientIp(req: VercelRequest): string {
  const xf = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return xf || String(req.headers['x-real-ip'] ?? '') || '';
}

/**
 * POST /api/gdpr/consent — record cookie or athlete consent
 * POST /api/gdpr/consent?revoke=1 — revoke athlete consent categories
 * Cookie consent logs are accepted without sync auth (public CMP).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const kind = String(body.kind ?? 'athlete');
  const revoke =
    String(req.query.revoke ?? '') === '1' ||
    body.revoke === true ||
    kind === 'revoke';

  if (kind === 'cookie') {
    await appendGdprConsentLog({
      at: new Date().toISOString(),
      kind: 'cookie',
      clubId: body.clubId ? String(body.clubId) : null,
      userId: body.userId ? String(body.userId) : null,
      email: body.email ? String(body.email) : null,
      consent: body.consent ?? null,
      ip: clientIp(req),
    });
    return res.status(200).json({ ok: true, logged: true, durable: isDurableStoreEnabled() });
  }

  if (!assertSyncAuthorized(req, res)) return;

  const clubId = String(body.clubId ?? '').trim();
  const ctx = getSyncAuthContext(req);
  if (
    clubId &&
    ctx.claims?.clubId &&
    ctx.claims.clubId !== clubId &&
    ctx.claims.role !== 'platform_admin' &&
    !ctx.viaSecret
  ) {
    return res.status(403).json({ ok: false, error: 'Forbidden: club mismatch' });
  }
  if (!clubId) return res.status(400).json({ ok: false, error: 'clubId required' });

  const athleteId = String(body.athleteId ?? '').trim();
  if (!athleteId) return res.status(400).json({ ok: false, error: 'athleteId required' });

  const mirror = await loadMirror(clubId);
  if (!mirror) return res.status(404).json({ ok: false, error: 'No mirror for club' });
  const payload = (mirror.payload ?? {}) as {
    students?: Array<Record<string, unknown>>;
    gdprAuditLogs?: Array<Record<string, unknown>>;
  };
  const student = (payload.students ?? []).find((s) => String(s.id) === athleteId);
  if (!student) return res.status(404).json({ ok: false, error: 'Athlete not found' });

  if (revoke) {
    student.gdprItems = {
      personalData: false,
      photoUse: false,
      gallery: false,
      communication: false,
      medical: false,
      amkaHealthCard: false,
    };
    student.gdprConsent = 'locked';
  } else {
    const items = (body.items ?? {}) as Record<string, unknown>;
    student.gdprItems = {
      personalData: Boolean(items.personalData),
      photoUse: Boolean(items.photoUse),
      gallery: Boolean(items.gallery),
      communication: Boolean(items.communication),
      medical: Boolean(items.medical),
      amkaHealthCard: Boolean(items.amkaHealthCard),
    };
    student.gdprConsent = 'pending';
  }

  if (!Array.isArray(payload.gdprAuditLogs)) payload.gdprAuditLogs = [];
  payload.gdprAuditLogs.unshift({
    id: `gdpr_${Date.now()}`,
    at: new Date().toISOString(),
    action: revoke ? 'consent_revoke' : 'consent',
    subjectAthleteId: athleteId,
    ip: clientIp(req),
  });

  const result = await saveMirror(clubId, payload, { baseUpdatedAt: mirror.updatedAt });
  if (!result.ok) {
    return res.status(409).json({ ok: false, conflict: true, error: 'Mirror conflict' });
  }

  await appendGdprConsentLog({
    at: new Date().toISOString(),
    kind: revoke ? 'revoke' : 'athlete',
    clubId,
    athleteId,
    ip: clientIp(req),
    consent: student.gdprItems ?? null,
  });

  return res.status(200).json({
    ok: true,
    revoked: revoke,
    durable: isDurableStoreEnabled(),
    updatedAt: result.updatedAt,
  });
}
