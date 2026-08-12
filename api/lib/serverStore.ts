import { Redis } from '@upstash/redis';

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

type GlobalStore = {
  settlements: VivaSettlement[];
  mirrors: Record<string, MirrorRecord>;
  publicClubs: Record<string, PublicClubConfig>;
  notifyConfigs: Record<string, ClubNotifyConfig>;
  pendingApps: Record<string, RemoteRegistrationApplication[]>;
};

const SETTLEMENTS_KEY = 'ss360:settlements';
const MIRROR_PREFIX = 'ss360:mirror:';
const MIRROR_INDEX_KEY = 'ss360:mirror-keys';
const PUBLIC_CLUB_PREFIX = 'ss360:public-club:';
const NOTIFY_PREFIX = 'ss360:notify:';
const PENDING_APPS_PREFIX = 'ss360:pending-apps:';

function memory(): GlobalStore {
  const g = globalThis as typeof globalThis & { __ss360?: GlobalStore };
  if (!g.__ss360) {
    g.__ss360 = {
      settlements: [],
      mirrors: {},
      publicClubs: {},
      notifyConfigs: {},
      pendingApps: {},
    };
  }
  if (!g.__ss360.publicClubs) g.__ss360.publicClubs = {};
  if (!g.__ss360.notifyConfigs) g.__ss360.notifyConfigs = {};
  if (!g.__ss360.pendingApps) g.__ss360.pendingApps = {};
  return g.__ss360;
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isDurableStoreEnabled(): boolean {
  return Boolean(getRedis());
}

async function readSettlements(): Promise<VivaSettlement[]> {
  const redis = getRedis();
  if (!redis) return memory().settlements;
  const raw = await redis.get<VivaSettlement[]>(SETTLEMENTS_KEY);
  return Array.isArray(raw) ? raw : [];
}

async function writeSettlements(items: VivaSettlement[]): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory().settlements = items;
    return;
  }
  await redis.set(SETTLEMENTS_KEY, items.slice(0, 200));
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
  const redis = getRedis();
  if (!redis) {
    memory().mirrors[clubId] = record;
    return;
  }
  await redis.set(`${MIRROR_PREFIX}${clubId}`, record);
  const keys = (await redis.get<string[]>(MIRROR_INDEX_KEY)) ?? [];
  if (!keys.includes(clubId)) {
    await redis.set(MIRROR_INDEX_KEY, [...keys, clubId]);
  }
}

export async function loadMirror(clubId: string): Promise<MirrorRecord | null> {
  const redis = getRedis();
  if (!redis) return memory().mirrors[clubId] ?? null;
  const raw = await redis.get<MirrorRecord>(`${MIRROR_PREFIX}${clubId}`);
  return raw ?? null;
}

export async function listMirrorKeys(): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return Object.keys(memory().mirrors);
  return (await redis.get<string[]>(MIRROR_INDEX_KEY)) ?? [];
}

const SNAPSHOT_PREFIX = 'ss360:backup-snap:';

/** Αντίγραφο όλων των club mirrors με ημερομηνία (για scheduled cloud backup). */
export async function snapshotAllMirrors(): Promise<{
  dateKey: string;
  clubs: string[];
  durable: boolean;
}> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const keys = await listMirrorKeys();
  const redis = getRedis();
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
    if (!redis) {
      memory().mirrors[`${clubId}__snap__${dateKey}`] = {
        updatedAt: snap.snapshotAt,
        payload: snap,
      };
    } else {
      await redis.set(`${SNAPSHOT_PREFIX}${dateKey}:${clubId}`, snap);
    }
    clubs.push(clubId);
  }

  if (redis) {
    await redis.set(`${SNAPSHOT_PREFIX}${dateKey}:index`, {
      dateKey,
      clubs,
      createdAt: new Date().toISOString(),
    });
  }

  return { dateKey, clubs, durable: Boolean(redis) };
}

export async function savePublicClubConfig(config: PublicClubConfig): Promise<void> {
  const slug = config.slug.trim().toLowerCase();
  const redis = getRedis();
  if (!redis) {
    for (const [key, value] of Object.entries(memory().publicClubs)) {
      if (value.clubId === config.clubId && key !== slug) {
        delete memory().publicClubs[key];
      }
    }
    memory().publicClubs[slug] = { ...config, slug };
    return;
  }
  const indexKey = 'ss360:public-club-index';
  const index = (await redis.get<Record<string, string>>(indexKey)) ?? {};
  const prevSlug = Object.entries(index).find(([, id]) => id === config.clubId)?.[0];
  if (prevSlug && prevSlug !== slug) {
    await redis.del(`${PUBLIC_CLUB_PREFIX}${prevSlug}`);
    delete index[prevSlug];
  }
  index[slug] = config.clubId;
  await redis.set(indexKey, index);
  await redis.set(`${PUBLIC_CLUB_PREFIX}${slug}`, { ...config, slug });
}

export async function loadPublicClubBySlug(slug: string): Promise<PublicClubConfig | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const redis = getRedis();
  if (!redis) return memory().publicClubs[normalized] ?? null;
  return (await redis.get<PublicClubConfig>(`${PUBLIC_CLUB_PREFIX}${normalized}`)) ?? null;
}

export async function saveClubNotifyConfig(config: ClubNotifyConfig): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory().notifyConfigs[config.clubId] = config;
    return;
  }
  await redis.set(`${NOTIFY_PREFIX}${config.clubId}`, config);
}

export async function loadClubNotifyConfig(clubId: string): Promise<ClubNotifyConfig | null> {
  const redis = getRedis();
  if (!redis) return memory().notifyConfigs[clubId] ?? null;
  return (await redis.get<ClubNotifyConfig>(`${NOTIFY_PREFIX}${clubId}`)) ?? null;
}

export async function appendPendingApplication(
  clubId: string,
  application: RemoteRegistrationApplication,
): Promise<RemoteRegistrationApplication[]> {
  const redis = getRedis();
  if (!redis) {
    const prev = memory().pendingApps[clubId] ?? [];
    const next = [application, ...prev.filter((a) => a.id !== application.id)].slice(0, 200);
    memory().pendingApps[clubId] = next;
    return next;
  }
  const key = `${PENDING_APPS_PREFIX}${clubId}`;
  const prev = (await redis.get<RemoteRegistrationApplication[]>(key)) ?? [];
  const next = [application, ...prev.filter((a) => a.id !== application.id)].slice(0, 200);
  await redis.set(key, next);
  return next;
}

export async function listPendingApplications(
  clubId: string,
): Promise<RemoteRegistrationApplication[]> {
  const redis = getRedis();
  if (!redis) return memory().pendingApps[clubId] ?? [];
  return (await redis.get<RemoteRegistrationApplication[]>(`${PENDING_APPS_PREFIX}${clubId}`)) ?? [];
}
