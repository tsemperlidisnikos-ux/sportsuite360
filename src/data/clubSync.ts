import * as accountSyncService from '../api/services/accountSyncService';
import * as backendSyncService from '../api/services/backendSyncService';
import { resolveActiveClubId } from './store';

const AUTO_SYNC_KEY = 'academyhub-auto-sync-v1';
const LAST_SYNC_KEY = 'academyhub-last-sync-v1';
const CLOUD_PREFERRED_KEY = 'academyhub-cloud-preferred-v1';

type AutoSyncMap = Record<string, boolean>;
type LastSyncMap = Record<string, string>;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;

function readMap<T extends Record<string, unknown>>(key: string): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {} as T;
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function writeMap(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function isCloudPreferred(): boolean {
  try {
    return localStorage.getItem(CLOUD_PREFERRED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setCloudPreferred(enabled: boolean): void {
  localStorage.setItem(CLOUD_PREFERRED_KEY, enabled ? '1' : '0');
}

export function isAutoSyncEnabled(clubId?: string | null): boolean {
  const id = clubId ?? resolveActiveClubId();
  if (!id) return false;
  return Boolean(readMap<AutoSyncMap>(AUTO_SYNC_KEY)[id]);
}

export function setAutoSyncEnabled(clubId: string, enabled: boolean): void {
  const map = readMap<AutoSyncMap>(AUTO_SYNC_KEY);
  map[clubId] = enabled;
  writeMap(AUTO_SYNC_KEY, map);
}

export function getLastSyncAt(clubId?: string | null): string | null {
  const id = clubId ?? resolveActiveClubId();
  if (!id) return null;
  return readMap<LastSyncMap>(LAST_SYNC_KEY)[id] ?? null;
}

function setLastSyncAt(clubId: string, at: string): void {
  const map = readMap<LastSyncMap>(LAST_SYNC_KEY);
  map[clubId] = at;
  writeMap(LAST_SYNC_KEY, map);
}

/** Debounced push of active club AppData + account bundle to cloud. */
export function scheduleClubMirrorPush(clubId?: string | null): void {
  const id = clubId ?? resolveActiveClubId();
  if (!id || !isAutoSyncEnabled(id)) return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void flushClubMirrorPush(id);
  }, 2500);
}

export async function flushClubMirrorPush(clubId?: string | null) {
  const id = clubId ?? resolveActiveClubId();
  if (!id || !isAutoSyncEnabled(id) || pushing) {
    return { success: true as const, data: null, error: null };
  }
  pushing = true;
  const result = await backendSyncService.pushClubMirror(id);
  await accountSyncService.pushAccountBundle();
  pushing = false;
  if (result.success) {
    setLastSyncAt(id, result.data?.updatedAt ?? new Date().toISOString());
  }
  return result;
}

/**
 * Cloud-first login sync:
 * 1) Pull users/clubs/config if available
 * 2) Pull club AppData mirror if available (source of truth when present)
 * Missing cloud data is OK on first device.
 */
export async function syncClubOnLogin(clubId: string | null | undefined) {
  let pulledAccount = false;
  let pulledClub = false;

  const account = await accountSyncService.pullAccountBundle();
  if (account.success && account.data) {
    accountSyncService.applyAccountBundle(account.data);
    pulledAccount = true;
  }

  if (!clubId) {
    return {
      success: true as const,
      data: { pulled: pulledAccount, pulledAccount, pulledClub },
      error: null,
    };
  }

  // Prefer cloud when available (source of truth), even before auto-sync toggle.
  const result = await backendSyncService.pullClubMirror(clubId);
  if (result.success && result.data?.payload) {
    const { replaceData } = await import('./repository');
    replaceData(result.data.payload);
    setLastSyncAt(clubId, result.data.updatedAt ?? new Date().toISOString());
    setAutoSyncEnabled(clubId, true);
    setCloudPreferred(true);
    pulledClub = true;
  } else {
    const msg = result.error ?? '';
    const missing =
      msg.includes('Δεν υπάρχει αποθηκευμένο mirror') ||
      msg.includes('No mirror') ||
      msg.includes('μόνο στο production');
    if (!missing && !result.success && isAutoSyncEnabled(clubId)) {
      return {
        success: false as const,
        data: null,
        error: result.error ?? 'Αποτυχία sync',
      };
    }
  }

  return {
    success: true as const,
    data: { pulled: pulledAccount || pulledClub, pulledAccount, pulledClub },
    error: null,
  };
}
