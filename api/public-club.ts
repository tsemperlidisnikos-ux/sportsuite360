import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isDurableStoreEnabled,
  loadPublicClubBySlug,
  saveClubNotifyConfig,
  savePublicClubConfig,
  type ClubNotifyConfig,
  type PublicClubConfig,
} from './lib/serverStore.js';

/**
 * GET  /api/public-club?slug=...  — public join form bootstrap (no secrets)
 * POST /api/public-club            — publish public + notify config from club admin browser
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const slug = String(req.query.slug ?? '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ ok: false, error: 'slug required' });
    }
    const club = await loadPublicClubBySlug(slug);
    if (!club || !club.enabled) {
      return res.status(404).json({
        ok: false,
        error: 'Ο σύνδεσμος δεν βρέθηκε ή η δημόσια εγγραφή δεν είναι ενεργή.',
        durable: isDurableStoreEnabled(),
      });
    }
    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      club,
    });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as {
      publicClub?: PublicClubConfig;
      notify?: ClubNotifyConfig;
    };

    if (!body.publicClub?.clubId || !body.publicClub?.slug) {
      return res.status(400).json({ ok: false, error: 'publicClub.clubId και slug απαιτούνται' });
    }

    const now = new Date().toISOString();
    const publicClub: PublicClubConfig = {
      ...body.publicClub,
      slug: body.publicClub.slug.trim().toLowerCase(),
      logoUrl: trimMedia(body.publicClub.logoUrl),
      heroImageUrl: trimMedia(body.publicClub.heroImageUrl),
      classes: Array.isArray(body.publicClub.classes) ? body.publicClub.classes : [],
      termsHtml: String(body.publicClub.termsHtml ?? ''),
      updatedAt: now,
    };
    await savePublicClubConfig(publicClub);

    if (body.notify?.clubId) {
      const notify: ClubNotifyConfig = {
        ...body.notify,
        clubId: body.notify.clubId,
        updatedAt: now,
      };
      await saveClubNotifyConfig(notify);
    }

    return res.status(200).json({
      ok: true,
      durable: isDurableStoreEnabled(),
      slug: publicClub.slug,
      updatedAt: now,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

function trimMedia(value: string | null | undefined): string | null {
  if (!value) return null;
  // Keep Redis payloads small — large base64 logos/heroes stay local-only.
  if (value.length > 120_000) return null;
  return value;
}
