import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDurableStoreBackend, isDurableStoreEnabled } from './lib/serverStore.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    service: 'sportsuite360-api',
    durable: isDurableStoreEnabled(),
    durableBackend: getDurableStoreBackend(),
    time: new Date().toISOString(),
  });
}
