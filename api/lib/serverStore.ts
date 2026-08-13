import {
  durableKvBackend,
  isDurableKvEnabled,
  kvDel,
  kvGet,
  kvSet,
} from './durableKv.js';

export type VivaSettlement = {
  id: string;
  orderCode: string;
  transactionId: string;
  amountCents: number;
  status: string;
  clubHint?: string;
  createdAt: string;
  consumed: boolean;
};

type MirrorRecord = { updatedAt: string; payload: unknown };

export type PublicClubClass = {
  id: string;
  name: string;
  sport?: string;
  maxStudents?: number;
};

export type PublicClubConfig = {
  clubId: string;
  slug: string;
  name: string;
  city: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  enabled: boolean;
  autoApprove: boolean;
  allowTrial: boolean;
  allowWaitlist: boolean;
  classes: PublicClubClass[];
  termsHtml: string;
  updatedAt: string;
};

export type ClubNotifySmtp = {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
  fromName: string;
};

export type ClubNotifyConfig = {
  clubId: string;
  clubName: string;
  notifyEmail: string;
  smtp: ClubNotifySmtp;
  updatedAt: string;
};

export type RemoteRegistrationApplication = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  guardianName: string;
  guardianPhone: string;
  email: string;
  classId: string | null;
  kind: 'full' | 'trial' | 'waitlist';
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  createdAt: string;
  athleteId?: string | null;
};

export type LoginActivityEvent = {
  id: string;
  at: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  clubId: string | null;
  clubName: string | null;
  source: 'login' | 'impersonate';
  userAgent?: string | null;
};

type GlobalStore = {
  settlements: VivaSettlement[];
  mirrors: Record<string, MirrorRecord>;
  publicClubs: Record<string, PublicClubConfig>;
  notifyConfigs: Record<string, ClubNotifyConfig>;
  pendingApps: Record<string, RemoteRegistrationApplication[]>;
  accountBundle?: AccountBundle;
  loginActivity?: LoginActivityEvent[];
};

const SETTLEMENTS_KEY = 'ss360:settlements';
const MIRROR_PREFIX = 'ss360:mirror:';
const MIRROR_INDEX_KEY = 'ss360:mirror-keys';
const PUBLIC_CLUB_PREFIX = 'ss360:public-club:';
const NOTIFY_PREFIX = 'ss360:notify:';
const PENDING_APPS_PREFIX = 'ss360:pending-apps:';
const SNAPSHOT_PREFIX = 'ss360:backup-snap:';
const ACCOUNT_BUNDLE_KEY = 'ss360:account-bundle';
const LOGIN_ACTIVITY_KEY = 'ss360:login-activity';
const LOGIN_ACTIVITY_MAX = 500;

function memory(): GlobalStore {
  const g = globalThis as typeof globalThis & { __ss360?: GlobalStore };
  if (!g.__ss360) {
    g.__ss360 = {
      settlements: [],
      mirrors: {},
      publicClubs: {},
      notifyConfigs: {},
      pendingApps: {},
      loginActivity: [],
    };
  }
  if (!g.__ss360.publicClubs) g.__ss360.publicClubs = {};
  if (!g.__ss360.notifyConfigs) g.__ss360.notifyConfigs = {};
  if (!g.__ss360.pendingApps) g.__ss360.pendingApps = {};
  if (!g.__ss360.loginActivity) g.__ss360.loginActivity = [];
  return g.__ss360;
}

export function isDurableStoreEnabled(): boolean {
  return isDurableKvEnabled();
}

export function getDurableStoreBackend(): 'redis' | 'blob' | 'memory' {
  return durableKvBackend();
}

async function readSettlements(): Promise<VivaSettlement[]> {
  if (!isDurableKvEnabled()) return memory().settlements;
  const raw = await kvGet<VivaSettlement[]>(SETTLEMENTS_KEY);
  return Array.isArray(raw) ? raw : [];
}

async function writeSettlements(items: VivaSettlement[]): Promise<void> {
  if (!isDurableKvEnabled()) {
    memory().settlements = items;
    return;
  }
  await kvSet(SETTLEMENTS_KEY, items.slice(0, 200));
}

export async function addSettlement(
  input: Omit<VivaSettlement, 'id' | 'consumed' | 'createdAt'>,
): Promise<VivaSettlement> {
  const item: VivaSettlement = {
    ...input,
    id: `vs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    consumed: false,
  };
  const all = await readSettlements();
  const next = [item, ...all.filter((x) => x.orderCode !== item.orderCode)].slice(0, 200);
  await writeSettlements(next);
  return item;
}

export async function listOpenSettlements(): Promise<VivaSettlement[]> {
  const all = await readSettlements();
  return all.filter((s) => !s.consumed);
}

export async function consumeSettlement(orderCode: string): Promise<VivaSettlement | null> {
  const all = await readSettlements();
  const found = all.find((x) => x.orderCode === String(orderCode) && !x.consumed);
  if (!found) return null;
  found.consumed = true;
  await writeSettlements(all);
  return found;
}

export async function saveMirror(clubId: string, payload: unknown): Promise<void> {
  const record: MirrorRecord = {
    updatedAt: new Date().toISOString(),
    payload,
  };
  if (!isDurableKvEnabled()) {
    memory().mirrors[clubId] = record;
    return;
  }
  await kvSet(`${MIRROR_PREFIX}${clubId}`, record);
  const keys = (await kvGet<string[]>(MIRROR_INDEX_KEY)) ?? [];
  if (!keys.includes(clubId)) {
    await kvSet(MIRROR_INDEX_KEY, [...keys, clubId]);
  }
}

export async function loadMirror(clubId: string): Promise<MirrorRecord | null> {
  if (!isDurableKvEnabled()) return memory().mirrors[clubId] ?? null;
  return (await kvGet<MirrorRecord>(`${MIRROR_PREFIX}${clubId}`)) ?? null;
}

export async function listMirrorKeys(): Promise<string[]> {
  if (!isDurableKvEnabled()) return Object.keys(memory().mirrors);
  return (await kvGet<string[]>(MIRROR_INDEX_KEY)) ?? [];
}

export type AccountBundle = {
  users: unknown;
  clubs: unknown;
  platformConfig?: unknown;
  updatedAt: string;
};

export async function saveAccountBundle(
  bundle: Omit<AccountBundle, 'updatedAt'>,
): Promise<AccountBundle> {
  const record: AccountBundle = {
    ...bundle,
    updatedAt: new Date().toISOString(),
  };
  if (!isDurableKvEnabled()) {
    memory().accountBundle = record;
    return record;
  }
  await kvSet(ACCOUNT_BUNDLE_KEY, record);
  return record;
}

export async function loadAccountBundle(): Promise<AccountBundle | null> {
  if (!isDurableKvEnabled()) {
    return memory().accountBundle ?? null;
  }
  return (await kvGet<AccountBundle>(ACCOUNT_BUNDLE_KEY)) ?? null;
}

/** Αντίγραφο όλων των club mirrors με ημερομηνία (για scheduled cloud backup). */
export async function snapshotAllMirrors(): Promise<{
  dateKey: string;
  clubs: string[];
  durable: boolean;
}> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const keys = await listMirrorKeys();
  const durable = isDurableKvEnabled();
  const clubs: string[] = [];

  for (const clubId of keys) {
    const mirror = await loadMirror(clubId);
    if (!mirror) continue;
    const snap = {
      clubId,
      snapshotAt: new Date().toISOString(),
      sourceUpdatedAt: mirror.updatedAt,
      payload: mirror.payload,
    };
    if (!durable) {
      memory().mirrors[`${clubId}__snap__${dateKey}`] = {
        updatedAt: snap.snapshotAt,
        payload: snap,
      };
    } else {
      await kvSet(`${SNAPSHOT_PREFIX}${dateKey}:${clubId}`, snap);
    }
    clubs.push(clubId);
  }

  if (durable) {
    await kvSet(`${SNAPSHOT_PREFIX}${dateKey}:index`, {
      dateKey,
      clubs,
      createdAt: new Date().toISOString(),
    });
  }

  return { dateKey, clubs, durable };
}

export async function savePublicClubConfig(config: PublicClubConfig): Promise<void> {
  const slug = config.slug.trim().toLowerCase();
  if (!isDurableKvEnabled()) {
    for (const [key, value] of Object.entries(memory().publicClubs)) {
      if (value.clubId === config.clubId && key !== slug) {
        delete memory().publicClubs[key];
      }
    }
    memory().publicClubs[slug] = { ...config, slug };
    return;
  }
  const indexKey = 'ss360:public-club-index';
  const index = (await kvGet<Record<string, string>>(indexKey)) ?? {};
  const prevSlug = Object.entries(index).find(([, id]) => id === config.clubId)?.[0];
  if (prevSlug && prevSlug !== slug) {
    await kvDel(`${PUBLIC_CLUB_PREFIX}${prevSlug}`);
    delete index[prevSlug];
  }
  index[slug] = config.clubId;
  await kvSet(indexKey, index);
  await kvSet(`${PUBLIC_CLUB_PREFIX}${slug}`, { ...config, slug });
}

export async function loadPublicClubBySlug(slug: string): Promise<PublicClubConfig | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  if (!isDurableKvEnabled()) return memory().publicClubs[normalized] ?? null;
  return (await kvGet<PublicClubConfig>(`${PUBLIC_CLUB_PREFIX}${normalized}`)) ?? null;
}

export async function saveClubNotifyConfig(config: ClubNotifyConfig): Promise<void> {
  if (!isDurableKvEnabled()) {
    memory().notifyConfigs[config.clubId] = config;
    return;
  }
  await kvSet(`${NOTIFY_PREFIX}${config.clubId}`, config);
}

export async function loadClubNotifyConfig(clubId: string): Promise<ClubNotifyConfig | null> {
  if (!isDurableKvEnabled()) return memory().notifyConfigs[clubId] ?? null;
  return (await kvGet<ClubNotifyConfig>(`${NOTIFY_PREFIX}${clubId}`)) ?? null;
}

export async function appendPendingApplication(
  clubId: string,
  application: RemoteRegistrationApplication,
): Promise<RemoteRegistrationApplication[]> {
  if (!isDurableKvEnabled()) {
    const prev = memory().pendingApps[clubId] ?? [];
    const next = [application, ...prev.filter((a) => a.id !== application.id)].slice(0, 200);
    memory().pendingApps[clubId] = next;
    return next;
  }
  const key = `${PENDING_APPS_PREFIX}${clubId}`;
  const prev = (await kvGet<RemoteRegistrationApplication[]>(key)) ?? [];
  const next = [application, ...prev.filter((a) => a.id !== application.id)].slice(0, 200);
  await kvSet(key, next);
  return next;
}

export async function listPendingApplications(
  clubId: string,
): Promise<RemoteRegistrationApplication[]> {
  if (!isDurableKvEnabled()) return memory().pendingApps[clubId] ?? [];
  return (await kvGet<RemoteRegistrationApplication[]>(`${PENDING_APPS_PREFIX}${clubId}`)) ?? [];
}

async function readLoginActivity(): Promise<LoginActivityEvent[]> {
  if (!isDurableKvEnabled()) return memory().loginActivity ?? [];
  const raw = await kvGet<LoginActivityEvent[]>(LOGIN_ACTIVITY_KEY);
  return Array.isArray(raw) ? raw : [];
}

async function writeLoginActivity(events: LoginActivityEvent[]): Promise<void> {
  const next = events.slice(0, LOGIN_ACTIVITY_MAX);
  if (!isDurableKvEnabled()) {
    memory().loginActivity = next;
    return;
  }
  await kvSet(LOGIN_ACTIVITY_KEY, next);
}

export async function appendLoginActivity(
  event: LoginActivityEvent,
): Promise<LoginActivityEvent[]> {
  const prev = await readLoginActivity();
  const next = [event, ...prev.filter((e) => e.id !== event.id)].slice(0, LOGIN_ACTIVITY_MAX);
  await writeLoginActivity(next);
  return next;
}

export async function listLoginActivity(limit = 100): Promise<LoginActivityEvent[]> {
  const all = await readLoginActivity();
  const capped = Math.min(Math.max(1, limit), LOGIN_ACTIVITY_MAX);
  return all.slice(0, capped);
}
