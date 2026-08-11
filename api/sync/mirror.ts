import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listMirrorKeys, loadMirror, saveMirror } from '../lib/serverStore';

/**
 * Experimental cloud mirror for club AppData (in-memory on Vercel instances).
 * Foundation for a future durable backend (DB/KV).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const clubId = String(req.query.clubId ?? '').trim();
    if (!clubId) {
      return res.status(200).json({ ok: true, clubs: listMirrorKeys() });
    }
    const mirror = loadMirror(clubId);
    if (!mirror) return res.status(404).json({ ok: false, error: 'No mirror for club' });
    return res.status(200).json({ ok: true, clubId, ...mirror });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { clubId?: string; payload?: unknown };
    const clubId = String(body.clubId ?? '').trim();
    if (!clubId) return res.status(400).json({ ok: false, error: 'clubId required' });
    if (body.payload == null) return res.status(400).json({ ok: false, error: 'payload required' });
    saveMirror(clubId, body.payload);
    return res.status(200).json({ ok: true, clubId, updatedAt: new Date().toISOString() });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
