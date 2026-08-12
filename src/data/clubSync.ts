import * as backendSyncService from '../api/services/backendSyncService';
import { resolveActiveClubId } from './store';

const AUTO_SYNC_KEY = 'academyhub-auto-sync-v1';
const LAST_SYNC_KEY = 'academyhub-last-sync-v1';

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

/** Debounced push of active club AppData to cloud mirror. */
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
  pushing = false;
  if (result.success) {
    setLastSyncAt(id, result.data?.updatedAt ?? new Date().toISOString());
  }
  return result;
}

/**
 * Pull cloud mirror into local store after login (when auto-sync is on).
 * Missing mirror is OK (first device) — returns success without changes.
 */
export async function syncClubOnLogin(clubId: string | null | undefined) {
  if (!clubId || !isAutoSyncEnabled(clubId)) {
    return { success: true as const, data: { pulled: false }, error: null };
  }

  const result = await backendSyncService.pullClubMirror(clubId);
  if (!result.success) {
    const msg = result.error ?? '';
    if (msg.includes('Δεν υπάρχει αποθηκευμένο mirror') || msg.includes('No mirror')) {
      return { success: true as const, data: { pulled: false }, error: null };
    }
    return { success: false as const, data: null, error: result.error ?? 'Αποτυχία sync' };
  }

  if (result.data?.payload) {
    const { replaceData } = await import('./repository');
    replaceData(result.data.payload);
    setLastSyncAt(clubId, result.data.updatedAt ?? new Date().toISOString());
  }
  return { success: true as const, data: { pulled: true }, error: null };
}
