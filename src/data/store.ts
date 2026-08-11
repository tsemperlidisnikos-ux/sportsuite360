import { getSession } from '../auth/auth';
import { getClubs } from '../auth/clubs';
import { getPreviewClubId } from '../platform/platformConfig';
import type { AppData } from '../types';

const LEGACY_KEY = 'academyhub-data-v12';
const BY_CLUB_KEY = 'academyhub-data-by-club-v1';

export const APP_DATA_STORAGE_KEYS = [LEGACY_KEY, BY_CLUB_KEY] as const;

type ClubDataMap = Record<string, AppData>;

/** Active club for domain data: preview → session → first club → default bucket. */
export function resolveActiveClubId(): string {
  const preview = getPreviewClubId();
  if (preview) return preview;
  const sessionClub = getSession()?.clubId;
  if (sessionClub) return sessionClub;
  const clubs = getClubs();
  if (clubs[0]?.id) return clubs[0].id;
  return '_default';
}

function loadClubMap(): ClubDataMap {
  try {
    const raw = localStorage.getItem(BY_CLUB_KEY);
    if (raw) return JSON.parse(raw) as ClubDataMap;
  } catch {
    /* ignore */
  }
  return {};
}

function saveClubMap(map: ClubDataMap): void {
  localStorage.setItem(BY_CLUB_KEY, JSON.stringify(map));
}

/** Migrate legacy single-blob store into the active club bucket once. */
function migrateLegacyIfNeeded(map: ClubDataMap, clubId: string): ClubDataMap {
  if (map[clubId]) return map;
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return map;
    const parsed = JSON.parse(legacy) as AppData;
    const next = { ...map, [clubId]: parsed };
    saveClubMap(next);
    return next;
  } catch {
    return map;
  }
}

export function loadStore(): AppData | null {
  const clubId = resolveActiveClubId();
  let map = loadClubMap();
  map = migrateLegacyIfNeeded(map, clubId);
  return map[clubId] ?? null;
}

export function saveStore(data: AppData): void {
  const clubId = resolveActiveClubId();
  const map = loadClubMap();
  map[clubId] = data;
  saveClubMap(map);
  // Keep legacy key in sync for older backup tools / same-browser reads.
  localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
}

/** All club datasets (for full platform backup). */
export function loadAllClubStores(): ClubDataMap {
  const map = loadClubMap();
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && Object.keys(map).length === 0) {
      const clubId = resolveActiveClubId();
      return { [clubId]: JSON.parse(legacy) as AppData };
    }
  } catch {
    /* ignore */
  }
  return map;
}

export function replaceAllClubStores(map: ClubDataMap): void {
  saveClubMap(map);
  const clubId = resolveActiveClubId();
  if (map[clubId]) {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(map[clubId]));
  }
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
