import type { VercelRequest, VercelResponse } from '@vercel/node';

type Body = {
  clientId?: string;
  clientSecret?: string;
  sourceCode?: string;
  environment?: 'demo' | 'live';
  amount?: number;
  customer?: { email?: string; fullName?: string };
  merchantTrns?: string;
};

function vivaHosts(env: 'demo' | 'live') {
  if (env === 'live') {
    return {
      accounts: 'https://accounts.vivapayments.com',
      api: 'https://api.vivapayments.com',
      checkout: 'https://www.vivapayments.com/web/checkout',
    };
  }
  return {
    accounts: 'https://demo-accounts.vivapayments.com',
    api: 'https://demo-api.vivapayments.com',
    checkout: 'https://demo.vivapayments.com/web/checkout',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Body;
  const clientId = String(body.clientId ?? '').trim();
  const clientSecret = String(body.clientSecret ?? '').trim();
  const sourceCode = String(body.sourceCode ?? '').trim();
  const environment = body.environment === 'live' ? 'live' : 'demo';
  const amount = Number(body.amount);

  if (!clientId || !clientSecret || !sourceCode) {
    return res.status(400).json({ ok: false, error: 'Ελλιπή Viva credentials' });
  }
  if (!Number.isFinite(amount) || amount < 30) {
    return res.status(400).json({ ok: false, error: 'Μη έγκυρο ποσό (ελάχιστο 30 λεπτά)' });
  }

  const hosts = vivaHosts(environment);

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${hosts.accounts}/connect/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(502).json({
        ok: false,
        error:
          tokenJson.error_description ||
          tokenJson.error ||
          'Αποτυχία αυθεντικοποίησης Viva',
      });
    }

    const orderRes = await fetch(`${hosts.api}/checkout/v2/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        customerTrns: body.merchantTrns || 'SportSuite360 payment',
        merchantTrns: body.merchantTrns || 'SportSuite360 payment',
        sourceCode,
        customer: {
          email: body.customer?.email || undefined,
          fullName: body.customer?.fullName || undefined,
        },
      }),
    });

    const orderJson = (await orderRes.json()) as {
      orderCode?: number | string;
      message?: string;
      ErrorCode?: number;
      ErrorText?: string;
    };

    if (!orderRes.ok || orderJson.orderCode == null) {
      return res.status(502).json({
        ok: false,
        error: orderJson.ErrorText || orderJson.message || 'Αποτυχία δημιουργίας Viva order',
      });
    }

    const orderCode = orderJson.orderCode;
    const checkoutUrl = `${hosts.checkout}?ref=${encodeURIComponent(String(orderCode))}`;
    return res.status(200).json({ ok: true, orderCode, checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Σφάλμα Viva';
    return res.status(502).json({ ok: false, error: message });
  }
}
