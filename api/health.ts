import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isDurableStoreEnabled } from './lib/serverStore.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    service: 'sportsuite360-api',
    durable: isDurableStoreEnabled(),
    time: new Date().toISOString(),
  });
}
