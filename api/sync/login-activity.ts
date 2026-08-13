import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  appendLoginActivity,
  isDurableStoreEnabled,
  listLoginActivity,
  type LoginActivityEvent,
} from '../lib/serverStore.js';

function parseEvent(body: unknown): LoginActivityEvent | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const at = typeof raw.at === 'string' ? raw.at.trim() : '';
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const fullName = typeof raw.fullName === 'string' ? raw.fullName.trim() : '';
  const role = typeof raw.role === 'string' ? raw.role.trim() : '';
  const source = raw.source === 'impersonate' ? 'impersonate' : raw.source === 'login' ? 'login' : null;
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

/**
 * Platform-wide login / impersonation audit log (durable KV / Blob).
 * GET  — list recent events (?limit=100)
 * POST — append one event
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const event = parseEvent(req.body);
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
