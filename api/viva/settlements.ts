import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  consumeSettlement,
  isDurableStoreEnabled,
  listOpenSettlements,
} from '../lib/serverStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const settlements = await listOpenSettlements();
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      settlements: settlements.map((s) => ({
        orderCode: s.orderCode,
        transactionId: s.transactionId,
        amountCents: s.amountCents,
        createdAt: s.createdAt,
        clubHint: s.clubHint,
      })),
    });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { orderCode?: string };
    const orderCode = String(body.orderCode ?? '').trim();
    if (!orderCode) {
      return res.status(400).json({ ok: false, error: 'orderCode required' });
    }
    const consumed = await consumeSettlement(orderCode);
    return res.status(200).json({ ok: true, consumed: Boolean(consumed) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
