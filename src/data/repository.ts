import { notifyAppDataChanged } from './appDataEvents';
import { seedData } from './seed';
import {
  createId,
  loadAllClubStores,
  loadStore,
  replaceAllClubStores,
  resolveActiveClubId,
  saveStore,
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

/** Drop in-memory cache so the next getData() loads the active club bucket. */
export function clearDataCache(): void {
  cache = null;
  cacheClubId = null;
}

export function getData(): AppData {
  const clubId = resolveActiveClubId();
  if (!cache || cacheClubId !== clubId) {
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

/** Restore multi-club map from backup (optional). */
export function replaceAllClubsData(map: Record<string, AppData>): void {
  replaceAllClubStores(map);
  clearDataCache();
  notifyAppDataChanged();
}

export function exportAllClubsData(): Record<string, AppData> {
  return loadAllClubStores();
}

export { createId, resolveActiveClubId };
