import { apiClient } from '../apiClient';
import { getData } from '../../data/repository';

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
    };
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Pull HTTP ${response.status}`);
    }
    return { updatedAt: json.updatedAt ?? null, payload: json.payload };
  });
}
