import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

type Body = {
  smtp?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    fromName?: string;
  };
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  listUnsubscribe?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Body;
  const smtp = body.smtp;
  const to = String(body.to ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const text = String(body.text ?? '').trim();
  const html = body.html ? String(body.html) : undefined;

  if (!smtp?.host || !smtp.port || !smtp.username || !smtp.password) {
    return res.status(400).json({ ok: false, error: 'Ελλιπείς ρυθμίσεις SMTP' });
  }
  if (!to.includes('@') || !subject || !text) {
    return res.status(400).json({ ok: false, error: 'Ελλιπή στοιχεία μηνύματος' });
  }

  const port = Number(smtp.port) || 587;
  const secure = port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port,
      secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    const fromName = (smtp.fromName || 'SPORTSUITE 360').replace(/[\r\n]/g, '');
    const listUnsubscribe = body.listUnsubscribe
      ? String(body.listUnsubscribe).replace(/[\r\n]/g, '')
      : '';
    const info = await transporter.sendMail({
      from: `"${fromName}" <${smtp.username}>`,
      to,
      subject,
      text,
      html: html || undefined,
      headers: listUnsubscribe
        ? {
            'List-Unsubscribe': listUnsubscribe,
          }
        : undefined,
    });

    return res.status(200).json({ ok: true, messageId: info.messageId ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Σφάλμα SMTP';
    return res.status(502).json({ ok: false, error: message });
  }
}
