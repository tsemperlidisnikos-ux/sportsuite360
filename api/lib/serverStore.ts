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

type GlobalStore = {
  settlements: VivaSettlement[];
  mirrors: Record<string, MirrorRecord>;
};

const SETTLEMENTS_KEY = 'ss360:settlements';
const MIRROR_PREFIX = 'ss360:mirror:';
const MIRROR_INDEX_KEY = 'ss360:mirror-keys';

function memory(): GlobalStore {
  const g = globalThis as typeof globalThis & { __ss360?: GlobalStore };
  if (!g.__ss360) {
    g.__ss360 = { settlements: [], mirrors: {} };
  }
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
