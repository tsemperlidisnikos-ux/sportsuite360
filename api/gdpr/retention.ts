import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isDurableStoreEnabled,
  listMirrorKeys,
  loadMirror,
  saveMirror,
} from '../lib/serverStore.js';

type MirrorPayload = {
  students?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  amkaAccessLogs?: Array<{ at?: string }>;
  gdprAuditLogs?: Array<{ at?: string }>;
  dataRetentionMonths?: number;
};

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

/**
 * Scheduled GDPR retention across all club mirrors.
 * Auth: CRON_SECRET (same as backup cron).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET?.trim();
  const isVercelProd = process.env.VERCEL_ENV === 'production';
  if (isVercelProd && !secret) {
    return res.status(503).json({
      ok: false,
      error: 'Retention cron locked: configure CRON_SECRET',
    });
  }
  if (secret) {
    const auth = String(req.headers.authorization ?? '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.secret ?? '');
    if (token !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  const clubs = await listMirrorKeys();
  let cleanedAthletes = 0;
  let removedPhotos = 0;
  let prunedLogs = 0;
  let clubsProcessed = 0;

  for (const clubId of clubs) {
    const mirror = await loadMirror(clubId);
    if (!mirror) continue;
    const payload = (mirror.payload ?? {}) as MirrorPayload;
    const months = Number(payload.dataRetentionMonths) || 36;
    const athleteCutoff = monthsAgoIso(months).slice(0, 10);
    const photoCutoff = monthsAgoIso(24);
    const logCutoff = monthsAgoIso(12);

    let changed = false;
    for (const student of payload.students ?? []) {
      if (String(student.status) !== 'inactive') continue;
      const ref = String(student.enrolledAt ?? '').slice(0, 10);
      if (!ref || ref > athleteCutoff) continue;
      for (const field of [
        'amka',
        'doctorName',
        'doctorPhone',
        'bloodType',
        'allergies',
        'chronicConditions',
        'medication',
      ]) {
        if (String(student[field] ?? '').trim()) {
          student[field] = '';
          changed = true;
        }
      }
      cleanedAthletes += 1;
    }

    const beforePhotos = payload.photos?.length ?? 0;
    payload.photos = (payload.photos ?? []).filter(
      (p) => String(p.createdAt ?? '') >= photoCutoff,
    );
    const photoDiff = beforePhotos - (payload.photos.length ?? 0);
    if (photoDiff > 0) {
      removedPhotos += photoDiff;
      changed = true;
    }

    const beforeAmka = payload.amkaAccessLogs?.length ?? 0;
    payload.amkaAccessLogs = (payload.amkaAccessLogs ?? []).filter(
      (l) => String(l.at ?? '') >= logCutoff,
    );
    const beforeGdpr = payload.gdprAuditLogs?.length ?? 0;
    payload.gdprAuditLogs = (payload.gdprAuditLogs ?? []).filter(
      (l) => String(l.at ?? '') >= logCutoff,
    );
    const logDiff =
      beforeAmka +
      beforeGdpr -
      ((payload.amkaAccessLogs?.length ?? 0) + (payload.gdprAuditLogs?.length ?? 0));
    if (logDiff > 0) {
      prunedLogs += logDiff;
      changed = true;
    }

    if (!changed) continue;
    const saved = await saveMirror(clubId, payload, { baseUpdatedAt: null });
    if (saved.ok) clubsProcessed += 1;
  }

  return res.status(200).json({
    ok: true,
    durable: isDurableStoreEnabled(),
    clubs: clubs.length,
    clubsProcessed,
    cleanedAthletes,
    removedPhotos,
    prunedLogs,
  });
}
