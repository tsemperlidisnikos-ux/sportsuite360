import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isDurableStoreEnabled,
  listMirrorKeys,
  loadMirror,
  saveMirror,
} from '../lib/serverStore.js';

/**
 * Cloud mirror for club AppData.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_* or KV_REST_API_* env vars are set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const clubId = String(req.query.clubId ?? '').trim();
    if (!clubId) {
      return res.status(200).json({
        ok: true,
        durable: isDurableStoreEnabled(),
        clubs: await listMirrorKeys(),
      });
    }
    const mirror = await loadMirror(clubId);
    if (!mirror) return res.status(404).json({ ok: false, error: 'No mirror for club' });
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      clubId,
      ...mirror,
    });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { clubId?: string; payload?: unknown };
    const clubId = String(body.clubId ?? '').trim();
    if (!clubId) return res.status(400).json({ ok: false, error: 'clubId required' });
    if (body.payload == null) return res.status(400).json({ ok: false, error: 'payload required' });
    await saveMirror(clubId, body.payload);
    return res.status(200).json({
      ok: true,
      clubId,
      durable: isDurableStoreEnabled(),
      updatedAt: new Date().toISOString(),
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
