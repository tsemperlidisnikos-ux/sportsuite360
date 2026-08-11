import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addSettlement } from '../lib/serverStore.js';

/**
 * Viva Wallet webhook receiver.
 * Configure payment source webhook to: https://<domain>/api/viva/webhook
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'viva-webhook' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventData = (body.EventData ?? body.eventData ?? body) as Record<string, unknown>;
    const orderCode = String(
      eventData.OrderCode ?? eventData.orderCode ?? body.OrderCode ?? '',
    ).trim();
    const transactionId = String(
      eventData.TransactionId ?? eventData.transactionId ?? body.TransactionId ?? '',
    ).trim();
    const amountRaw = eventData.Amount ?? eventData.amount ?? body.Amount ?? 0;
    const amountCents = Math.round(Number(amountRaw) || 0);
    const status = String(eventData.StatusId ?? eventData.statusId ?? body.StatusId ?? 'F');

    if (!orderCode && !transactionId) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    // Status F = finished/paid in Viva
    if (status && status !== 'F' && status !== 'Finished' && status !== 'paid') {
      return res.status(200).json({ ok: true, ignored: true, status });
    }

    const settlement = addSettlement({
      orderCode: orderCode || transactionId,
      transactionId: transactionId || orderCode,
      amountCents: amountCents > 0 ? amountCents : 0,
      status,
      clubHint: String(eventData.MerchantTrns ?? eventData.CustomerTrns ?? ''),
    });

    return res.status(200).json({ ok: true, settlementId: settlement.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error';
    return res.status(500).json({ ok: false, error: message });
  }
}
