import { getUsers } from '../auth/auth';
import { getClubs } from '../auth/clubs';
import { getData } from '../data/repository';
import { loadStore } from '../data/store';
import { loadPlatformConfig } from '../platform/platformConfig';
import { localDateIso, localDateTimeIso } from './dates';
import { createZip, extractZipAsync } from './zip';

export const BACKUP_JSON_FILENAME = 'academyhub-backup.json';

export type BackupPayload = {
  exportedAt: string;
  appData?: ReturnType<typeof getData>;
  platformConfig?: ReturnType<typeof loadPlatformConfig>;
  users?: ReturnType<typeof getUsers>;
  clubs?: ReturnType<typeof getClubs>;
};

export function buildBackupPayload(): BackupPayload {
  return {
    exportedAt: localDateTimeIso(),
    appData: loadStore() ?? getData(),
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
  const parsed = JSON.parse(text) as BackupPayload;
  if (!parsed.appData && !parsed.platformConfig && !parsed.users && !parsed.clubs) {
    throw new Error('Το αρχείο δεν είναι έγκυρο backup της εφαρμογής.');
  }
  return parsed;
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    const text = await file.text();
    return parseBackupJson(text);
  }

  if (name.endsWith('.zip')) {
    const buffer = await file.arrayBuffer();
    const entries = await extractZipAsync(buffer);
    const jsonEntry =
      entries.find((entry) => entry.name.toLowerCase().endsWith('.json')) ?? entries[0];
    if (!jsonEntry) throw new Error('Το ZIP δεν περιέχει αρχείο backup.');
    const text = new TextDecoder().decode(jsonEntry.data);
    return parseBackupJson(text);
  }

  throw new Error('Επιλέξτε αρχείο .zip (ή παλιό .json) από «Λήψη backup».');
}
