import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isDurableStoreEnabled, snapshotAllMirrors } from '../lib/serverStore.js';

/**
 * Scheduled cloud snapshot of all club mirrors (Vercel Cron).
 * Protect with CRON_SECRET (Authorization: Bearer …) when set.
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
      error: 'Backup cron locked: configure CRON_SECRET',
    });
  }
  if (secret) {
    const auth = String(req.headers.authorization ?? '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.secret ?? '');
    if (token !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  const result = await snapshotAllMirrors();
  return res.status(200).json({
    ok: true,
    durable: isDurableStoreEnabled(),
    ...result,
  });
}
