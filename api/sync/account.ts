import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isDurableStoreEnabled,
  loadAccountBundle,
  saveAccountBundle,
} from '../lib/serverStore.js';

/**
 * Cloud source-of-truth for users + clubs (+ optional platformConfig).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
