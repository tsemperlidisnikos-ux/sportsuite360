import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { addSettlement, isDurableStoreEnabled } from '../lib/serverStore.js';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function assertVivaWebhookAuthorized(req: VercelRequest): boolean {
  const secret = (process.env.VIVA_WEBHOOK_SECRET || '').trim();
  // Backward compatible: if secret not configured, accept (configure VIVA_WEBHOOK_SECRET in prod).
  if (!secret) return true;

  const headerKey = String(
    req.headers['x-viva-signature'] ??
      req.headers['x-ss360-viva-key'] ??
      req.headers['x-ss360-sync-key'] ??
      '',
  ).trim();
  const auth = String(req.headers.authorization ?? '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const queryKey = String(req.query.key ?? req.query.secret ?? '').trim();
  const provided = headerKey || bearer || queryKey;
  if (provided && safeEqual(provided, secret)) return true;

  if (headerKey && /^[a-f0-9]{32,}$/i.test(headerKey)) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const digest = createHmac('sha256', secret).update(raw).digest('hex');
    if (safeEqual(digest, headerKey.toLowerCase())) return true;
  }

  return false;
}

/**
 * Viva Wallet webhook receiver.
 * Configure payment source webhook to: https://<domain>/api/viva/webhook
 * Protect with VIVA_WEBHOOK_SECRET (header x-ss360-viva-key / Bearer / ?key=).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'viva-webhook',
      durable: isDurableStoreEnabled(),
      authRequired: Boolean((process.env.VIVA_WEBHOOK_SECRET || '').trim()),
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!assertVivaWebhookAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized webhook' });
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

    if (status && status !== 'F' && status !== 'Finished' && status !== 'paid') {
      return res.status(200).json({ ok: true, ignored: true, status });
    }

    const settlement = await addSettlement({
      orderCode: orderCode || transactionId,
      transactionId: transactionId || orderCode,
      amountCents: amountCents > 0 ? amountCents : 0,
      status,
      clubHint: String(eventData.MerchantTrns ?? eventData.CustomerTrns ?? ''),
    });

    return res.status(200).json({
      ok: true,
      settlementId: settlement.id,
      durable: isDurableStoreEnabled(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error';
    return res.status(500).json({ ok: false, error: message });
  }
}
