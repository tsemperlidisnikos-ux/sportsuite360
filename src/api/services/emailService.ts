import { apiClient } from '../apiClient';
import {
  appendClubSmtpSendLog,
  getClubById,
  getClubSmtp,
} from '../../auth/clubs';
import { localDateTimeIso } from '../../utils/dates';

export type SendEmailInput = {
  clubId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendClubEmail(input: SendEmailInput) {
  return apiClient(async () => {
    const smtp = getClubSmtp(input.clubId);
    const club = getClubById(input.clubId);
    if (!smtp.enabled) {
      throw new Error('Το SMTP του συλλόγου δεν είναι ενεργό. Ρυθμίστε το στις Ρυθμίσεις → Email.');
    }
    if (!smtp.host || !smtp.port || !smtp.username || !smtp.password) {
      throw new Error('Οι ρυθμίσεις SMTP είναι ελλιπείς.');
    }
    const to = input.to.trim();
    if (!to.includes('@')) {
      throw new Error('Μη έγκυρο email παραλήπτη.');
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtp: {
          host: smtp.host,
          port: Number(smtp.port) || 587,
          username: smtp.username,
          password: smtp.password,
          fromName: smtp.fromName || club?.name || 'SPORTSUITE 360',
        },
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    let payload: { ok?: boolean; error?: string; messageId?: string } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = {};
    }

    if (!response.ok || !payload.ok) {
      const err =
        payload.error ||
        (response.status === 404
          ? 'Η αποστολή email διαθέσιμη μόνο στο production server (Vercel API).'
          : `Αποτυχία αποστολής (HTTP ${response.status})`);
      appendClubSmtpSendLog(input.clubId, {
        to,
        status: 'error',
        message: err,
        at: localDateTimeIso(),
      });
      throw new Error(err);
    }

    appendClubSmtpSendLog(input.clubId, {
      to,
      status: 'ok',
      message: `Στάλθηκε: ${input.subject}${payload.messageId ? ` (${payload.messageId})` : ''}`,
      at: localDateTimeIso(),
    });

    return { to, messageId: payload.messageId ?? null };
  });
}
