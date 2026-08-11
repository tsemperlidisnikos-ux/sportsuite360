import { apiClient } from '../apiClient';
import { getData } from '../../data/repository';
import type { AppData } from '../../types';

function isAppDataPayload(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.students) && Array.isArray(data.classes);
}

export async function pushClubMirror(clubId: string) {
  return apiClient(async () => {
    const response = await fetch('/api/sync/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId,
        payload: getData(),
      }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; updatedAt?: string };
    if (!response.ok || !json.ok) {
      throw new Error(
        json.error ||
          (response.status === 404
            ? 'Το sync API είναι διαθέσιμο μόνο στο production (Vercel).'
            : `Sync HTTP ${response.status}`),
      );
    }
    return { updatedAt: json.updatedAt ?? null };
  });
}

export async function pullClubMirror(clubId: string) {
  return apiClient(async () => {
    const response = await fetch(`/api/sync/mirror?clubId=${encodeURIComponent(clubId)}`);
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      updatedAt?: string;
      payload?: unknown;
      durable?: boolean;
    };
    if (response.status === 404) {
      throw new Error(
        json.error === 'No mirror for club'
          ? 'Δεν υπάρχει αποθηκευμένο mirror για αυτόν τον σύλλογο. Κάντε πρώτα Push.'
          : 'Το sync API είναι διαθέσιμο μόνο στο production (Vercel).',
      );
    }
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Pull HTTP ${response.status}`);
    }
    if (!isAppDataPayload(json.payload)) {
      throw new Error('Το mirror δεν περιέχει έγκυρα δεδομένα συλλόγου.');
    }
    return {
      updatedAt: json.updatedAt ?? null,
      durable: Boolean(json.durable),
      payload: json.payload,
    };
  });
}
