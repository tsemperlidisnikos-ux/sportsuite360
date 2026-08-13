import { apiClient } from '../apiClient';
import { syncAuthHeaders } from '../syncAuth';
import { getClubData } from '../../data/repository';
import type { AppData } from '../../types';

function isAppDataPayload(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.students) && Array.isArray(data.classes);
}

export async function pushClubMirror(
  clubId: string,
  opts?: { baseUpdatedAt?: string | null },
) {
  return apiClient(async () => {
    const payload = getClubData(clubId);
    const response = await fetch('/api/sync/mirror', {
      method: 'POST',
      headers: syncAuthHeaders(),
      body: JSON.stringify({
        clubId,
        payload,
        baseUpdatedAt: opts?.baseUpdatedAt ?? null,
      }),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      updatedAt?: string;
      conflict?: boolean;
      payload?: unknown;
    };

    if (response.status === 409 || json.conflict) {
      const err = new Error(json.error || 'Mirror conflict') as Error & {
        conflict?: boolean;
        remoteUpdatedAt?: string;
        remotePayload?: AppData;
      };
      err.conflict = true;
      err.remoteUpdatedAt = json.updatedAt;
      err.remotePayload = isAppDataPayload(json.payload) ? json.payload : undefined;
      throw err;
    }

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
    const response = await fetch(`/api/sync/mirror?clubId=${encodeURIComponent(clubId)}`, {
      headers: syncAuthHeaders(false),
    });
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
