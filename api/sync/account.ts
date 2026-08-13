import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  appendLoginActivity,
  isDurableStoreEnabled,
  listLoginActivity,
  loadAccountBundle,
  saveAccountBundle,
  type LoginActivityEvent,
} from '../lib/serverStore.js';

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

function wantsLoginActivity(req: VercelRequest): boolean {
  const q = req.query.kind ?? req.query.view;
  return String(q ?? '') === 'login-activity';
}

/**
 * Cloud source-of-truth for users + clubs (+ optional platformConfig).
 * Also hosts login-activity audit (kind=login-activity) to stay within Hobby function limits.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (wantsLoginActivity(req)) {
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
