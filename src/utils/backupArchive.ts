import { getUsers } from '../auth/auth';
import { getClubs } from '../auth/clubs';
import { appDataWeight, isQuotaError, stripHeavyMedia } from '../data/mediaStrip';
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

export { isQuotaError, stripHeavyMedia };

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

/** Plain JSON backup — often more reliable across browsers. */
export function downloadBackupJson(payload: BackupPayload = buildBackupPayload()): string {
  const json = JSON.stringify(payload, null, 2);
  const filename = `academyhub-backup-${localDateIso()}.json`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
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

export function formatBackupError(err: unknown): string {
  if (isQuotaError(err)) {
    return (
      'Ο χώρος του browser γέμισε (localStorage). ' +
      'Καθαρίστε δεδομένα ιστότοπου για sportsuite360.vercel.app και ξαναδοκιμάστε.'
    );
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Μη έγκυρο αρχείο backup.';
}

/**
 * Pick AppData for restore into the current club (different clubIds across devices).
 * Prefers the richest dataset so empty snapshots are not chosen by mistake.
 */
export function pickAppDataForRestore(
  payload: BackupPayload,
  targetClubId: string | null,
): AppData | null {
  const map = payload.appDataByClub ?? {};
  if (targetClubId && map[targetClubId] && appDataWeight(map[targetClubId]) > 0) {
    return map[targetClubId]!;
  }

  const fromMap = Object.values(map).sort((a, b) => appDataWeight(b) - appDataWeight(a))[0];
  const candidates = [payload.appData, fromMap].filter(Boolean) as AppData[];
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => appDataWeight(b) - appDataWeight(a));
  return candidates[0] ?? null;
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json') || file.type === 'application/json') {
    return parseBackupJson(await file.text());
  }

  if (
    name.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  ) {
    const buffer = await file.arrayBuffer();
    try {
      const entries = await extractZipAsync(buffer);
      const jsonEntry =
        entries.find((entry) =>
          entry.name.toLowerCase().replace(/\\/g, '/').endsWith('.json'),
        ) ??
        entries.find((entry) => !entry.name.includes('__MACOSX')) ??
        entries[0];
      if (!jsonEntry) throw new Error('Το ZIP δεν περιέχει αρχείο backup.');
      return parseBackupJson(new TextDecoder().decode(jsonEntry.data));
    } catch (zipErr) {
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

  const text = await file.text();
  if (text.trim().startsWith('{')) return parseBackupJson(text);
  throw new Error('Επιλέξτε αρχείο .zip ή .json από «Λήψη backup».');
}
