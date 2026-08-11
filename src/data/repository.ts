import { getClubById, getClubs, saveClubs } from '../auth/clubs';
import { notifyAppDataChanged } from './appDataEvents';
import {
  buildDemoShowcaseData,
  isDemoClubName,
  isDemoShowcaseApplied,
  markDemoShowcaseApplied,
} from './demoShowcase';
import { seedData } from './seed';
import {
  createId,
  loadAllClubStores,
  loadStore,
  replaceAllClubStores,
  resolveActiveClubId,
  saveStore,
  writeClubStore,
} from './store';
import type { AppData } from '../types';

let cache: AppData | null = null;
let cacheClubId: string | null = null;

const REMOVED_PAYMENT_TXN_ID = 'txn_8d535cbd';

function ensureCollections(data: AppData): void {
  if (!data.transactions) data.transactions = structuredClone(seedData.transactions);
  if (!data.trainings) data.trainings = structuredClone(seedData.trainings);
  if (!data.staff) data.staff = structuredClone(seedData.staff);
  if (!data.associations) data.associations = structuredClone(seedData.associations);
  if (!data.sports) data.sports = structuredClone(seedData.sports);
  if (!data.announcements) data.announcements = structuredClone(seedData.announcements);
  if (!data.budgets) data.budgets = structuredClone(seedData.budgets);
  if (!data.products) data.products = structuredClone(seedData.products);
  if (!data.stockMovements) data.stockMovements = structuredClone(seedData.stockMovements ?? []);
  for (const product of data.products) {
    if (typeof product.stockQty !== 'number' || Number.isNaN(product.stockQty)) {
      product.stockQty = 0;
    }
  }
  if (!data.partnerBusinesses) data.partnerBusinesses = structuredClone(seedData.partnerBusinesses);
  if (!data.partnerOffers) data.partnerOffers = structuredClone(seedData.partnerOffers);
  if (!data.feeChargeTemplates) data.feeChargeTemplates = structuredClone(seedData.feeChargeTemplates);
  if (!data.feeReminderLogs) data.feeReminderLogs = structuredClone(seedData.feeReminderLogs);
  if (!data.photos) data.photos = structuredClone(seedData.photos);
  if (!data.parentLinks) data.parentLinks = structuredClone(seedData.parentLinks);
  if (!data.progressReports) data.progressReports = structuredClone(seedData.progressReports ?? []);
  if (!data.sizeChart) data.sizeChart = structuredClone(seedData.sizeChart);
  if (data.termsOfUseHtml === undefined) data.termsOfUseHtml = seedData.termsOfUseHtml ?? '';
}

function purgeRemovedAthletePayment(data: AppData): boolean {
  const beforeTxn = data.transactions.length;
  const beforeRev = data.revenues.length;
  data.transactions = data.transactions.filter((t) => t.id !== REMOVED_PAYMENT_TXN_ID);
  data.revenues = data.revenues.filter(
    (r) => !r.description.includes(`(${REMOVED_PAYMENT_TXN_ID})`),
  );
  return data.transactions.length !== beforeTxn || data.revenues.length !== beforeRev;
}

function purgeMirroredAthletePaymentRevenues(data: AppData): boolean {
  const before = data.revenues.length;
  data.revenues = data.revenues.filter(
    (r) => !/^Πληρωμή αθλητή \(/.test(r.description),
  );
  return data.revenues.length !== before;
}

function syncDemoLicenseUsage(clubId: string, data: AppData): void {
  const activeAthletes = data.students.filter((s) => s.status === 'active').length;
  const clubs = getClubs();
  const index = clubs.findIndex((c) => c.id === clubId);
  if (index < 0) return;
  const limit = Math.max(clubs[index].athleteLicenseLimit, Math.max(20, activeAthletes));
  const used = Math.min(limit, activeAthletes);
  if (
    clubs[index].athleteLicenseUsed === used &&
    clubs[index].athleteLicenseLimit === limit
  ) {
    return;
  }
  clubs[index] = {
    ...clubs[index],
    athleteLicenseLimit: limit,
    athleteLicenseUsed: used,
  };
  saveClubs(clubs);
}

/** Fill club named DEMO with full presentation dataset (once per showcase version). */
function maybeApplyDemoShowcase(clubId: string): AppData | null {
  const club = getClubById(clubId);
  if (!club || !isDemoClubName(club.name)) return null;
  if (isDemoShowcaseApplied(clubId)) return null;

  const showcase = buildDemoShowcaseData();
  ensureCollections(showcase);
  saveStore(showcase);
  markDemoShowcaseApplied(clubId);
  syncDemoLicenseUsage(clubId, showcase);
  return showcase;
}

/** Drop in-memory cache so the next getData() loads the active club bucket. */
export function clearDataCache(): void {
  cache = null;
  cacheClubId = null;
}

export function getData(): AppData {
  const clubId = resolveActiveClubId();
  if (!cache || cacheClubId !== clubId) {
    const seeded = maybeApplyDemoShowcase(clubId);
    if (seeded) {
      cache = seeded;
      cacheClubId = clubId;
      return cache;
    }

    const stored = loadStore();
    cache = stored ?? structuredClone(seedData);
    cacheClubId = clubId;
    ensureCollections(cache);
    const cleaned =
      purgeRemovedAthletePayment(cache) || purgeMirroredAthletePaymentRevenues(cache);
    if (!stored || cleaned) saveStore(cache);
    return cache;
  }

  ensureCollections(cache);
  const cleaned =
    purgeRemovedAthletePayment(cache) || purgeMirroredAthletePaymentRevenues(cache);
  if (cleaned) saveStore(cache);
  return cache;
}

export function mutateData(updater: (data: AppData) => void): AppData {
  const data = structuredClone(getData());
  updater(data);
  cache = data;
  cacheClubId = resolveActiveClubId();
  saveStore(data);
  notifyAppDataChanged();
  return data;
}

export function resetData(): AppData {
  cache = structuredClone(seedData);
  cacheClubId = resolveActiveClubId();
  saveStore(cache);
  notifyAppDataChanged();
  return cache;
}

export function replaceData(next: AppData): AppData {
  cache = structuredClone(next);
  ensureCollections(cache);
  cacheClubId = resolveActiveClubId();
  saveStore(cache);
  notifyAppDataChanged();
  return cache;
}

/** Write AppData into a specific club (e.g. restore from another device). */
export function replaceClubData(clubId: string, next: AppData): AppData {
  const data = structuredClone(next);
  ensureCollections(data);
  writeClubStore(clubId, data);
  if (resolveActiveClubId() === clubId) {
    cache = data;
    cacheClubId = clubId;
  } else {
    clearDataCache();
  }
  notifyAppDataChanged();
  return data;
}

/** Restore multi-club map from backup (optional). */
export function replaceAllClubsData(map: Record<string, AppData>): void {
  replaceAllClubStores(map);
  clearDataCache();
  notifyAppDataChanged();
}

export function exportAllClubsData(): Record<string, AppData> {
  return loadAllClubStores();
}

/** Force-reload DEMO presentation data (e.g. after empty reset). */
export function reseedDemoShowcase(clubId: string): AppData | null {
  const club = getClubById(clubId);
  if (!club || !isDemoClubName(club.name)) return null;
  try {
    const raw = localStorage.getItem('academyhub-demo-showcase-applied-v1');
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, number>;
    delete map[clubId];
    localStorage.setItem('academyhub-demo-showcase-applied-v1', JSON.stringify(map));
  } catch {
    /* ignore */
  }
  clearDataCache();
  return getData();
}

export { createId, resolveActiveClubId };
