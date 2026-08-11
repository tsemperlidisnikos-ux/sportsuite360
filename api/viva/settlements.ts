import type { VercelRequest, VercelResponse } from '@vercel/node';
import { consumeSettlement, listOpenSettlements } from '../lib/serverStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      settlements: listOpenSettlements().map((s) => ({
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
    const consumed = consumeSettlement(orderCode);
    return res.status(200).json({ ok: true, consumed: Boolean(consumed) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
