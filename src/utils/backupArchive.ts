import { getUsers } from '../auth/auth';
import { getClubs } from '../auth/clubs';
import { exportAllClubsData, getData } from '../data/repository';
import { loadStore } from '../data/store';
import { loadPlatformConfig } from '../platform/platformConfig';
import type { AppData } from '../types';
import { localDateIso, localDateTimeIso } from './dates';
import { createZip, extractZipAsync } from './zip';

export const BACKUP_JSON_FILENAME = 'academyhub-backup.json';

export type BackupPayload = {
  exportedAt: string;
  appData?: AppData;
  /** Multi-tenant map clubId → AppData (newer backups). */
  appDataByClub?: Record<string, AppData>;
  platformConfig?: ReturnType<typeof loadPlatformConfig>;
  users?: ReturnType<typeof getUsers>;
  clubs?: ReturnType<typeof getClubs>;
};

export function buildBackupPayload(): BackupPayload {
  return {
    exportedAt: localDateTimeIso(),
    appData: loadStore() ?? getData(),
    appDataByClub: exportAllClubsData(),
    platformConfig: loadPlatformConfig(),
    users: getUsers(),
    clubs: getClubs(),
  };
}

export function downloadBackupZip(payload: BackupPayload = buildBackupPayload()): string {
  const json = JSON.stringify(payload, null, 2);
  const zip = createZip([
    {
      name: BACKUP_JSON_FILENAME,
      data: new TextEncoder().encode(json),
    },
  ]);
  const filename = `academyhub-backup-${localDateIso()}.zip`;
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

function parseBackupJson(text: string): BackupPayload {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  let parsed: BackupPayload;
  try {
    parsed = JSON.parse(cleaned) as BackupPayload;
  } catch {
    throw new Error('Το αρχείο JSON του backup δεν είναι έγκυρο.');
  }
  if (!parsed.appData && !parsed.appDataByClub && !parsed.platformConfig && !parsed.users && !parsed.clubs) {
    throw new Error('Το αρχείο δεν είναι έγκυρο backup της εφαρμογής.');
  }
  return parsed;
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(e.message ?? '')
  );
}

export { isQuotaError };

export function formatBackupError(err: unknown): string {
  if (isQuotaError(err)) {
    return (
      'Ο χώρος του browser γέμισε (localStorage). ' +
      'Δοκιμάστε επαναφορά χωρίς φωτογραφίες ή καθαρίστε δεδομένα ιστότοπου και ξαναπροσπαθήστε.'
    );
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Μη έγκυρο αρχείο backup.';
}

/** Remove heavy gallery payloads so restore fits in localStorage. */
export function stripHeavyMedia(data: AppData): AppData {
  return {
    ...data,
    photos: (data.photos ?? []).map((p) => ({
      ...p,
      imageUrl: p.imageUrl?.startsWith('data:') ? '' : p.imageUrl,
    })),
    students: (data.students ?? []).map((s) => ({
      ...s,
      photoUrl: s.photoUrl?.startsWith('data:') ? null : s.photoUrl,
    })),
  };
}

/**
 * Pick AppData for restore into the current club (different clubIds across devices).
 */
export function pickAppDataForRestore(
  payload: BackupPayload,
  targetClubId: string | null,
): AppData | null {
  if (targetClubId && payload.appDataByClub?.[targetClubId]) {
    return payload.appDataByClub[targetClubId];
  }
  if (payload.appData) return payload.appData;

  const map = payload.appDataByClub;
  if (!map) return null;
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  entries.sort(
    (a, b) => (b[1].students?.length ?? 0) - (a[1].students?.length ?? 0),
  );
  return entries[0]![1];
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json') || file.type === 'application/json') {
    const text = await file.text();
    return parseBackupJson(text);
  }

  if (name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    const buffer = await file.arrayBuffer();
    try {
      const entries = await extractZipAsync(buffer);
      const jsonEntry =
        entries.find((entry) => entry.name.toLowerCase().replace(/\\/g, '/').endsWith('.json')) ??
        entries.find((entry) => !entry.name.includes('__MACOSX')) ??
        entries[0];
      if (!jsonEntry) throw new Error('Το ZIP δεν περιέχει αρχείο backup.');
      const text = new TextDecoder().decode(jsonEntry.data);
      return parseBackupJson(text);
    } catch (zipErr) {
      // Some browsers download ZIP with wrong extension / user renames — try raw JSON
      try {
        const text = new TextDecoder().decode(new Uint8Array(buffer));
        if (text.trim().startsWith('{')) return parseBackupJson(text);
      } catch {
        /* ignore */
      }
      throw zipErr instanceof Error
        ? zipErr
        : new Error('Αδυναμία ανάγνωσης ZIP backup.');
    }
  }

  // Fallback: sniff content
  const text = await file.text();
  if (text.trim().startsWith('{')) return parseBackupJson(text);

  throw new Error('Επιλέξτε αρχείο .zip (ή παλιό .json) από «Λήψη backup».');
}
