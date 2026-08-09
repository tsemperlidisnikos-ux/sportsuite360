import { seedData } from './seed';
import { createId, loadStore, saveStore } from './store';
import type { AppData } from '../types';

let cache: AppData | null = null;

const REMOVED_PAYMENT_TXN_ID = 'txn_8d535cbd';

function ensureCollections(data: AppData): void {
  if (!data.transactions) data.transactions = structuredClone(seedData.transactions);
  if (!data.trainings) data.trainings = structuredClone(seedData.trainings);
  if (!data.staff) data.staff = structuredClone(seedData.staff);
  if (!data.associations) data.associations = structuredClone(seedData.associations);
  if (!data.sports) data.sports = structuredClone(seedData.sports);
  if (!data.announcements) data.announcements = structuredClone(seedData.announcements);
  if (!data.budgets) data.budgets = structuredClone(seedData.budgets);
}

/** One-shot cleanup for a payment that should no longer appear in finance. */
function purgeRemovedAthletePayment(data: AppData): boolean {
  const beforeTxn = data.transactions.length;
  const beforeRev = data.revenues.length;
  data.transactions = data.transactions.filter((t) => t.id !== REMOVED_PAYMENT_TXN_ID);
  data.revenues = data.revenues.filter(
    (r) => !r.description.includes(`(${REMOVED_PAYMENT_TXN_ID})`),
  );
  return data.transactions.length !== beforeTxn || data.revenues.length !== beforeRev;
}

export function getData(): AppData {
  if (!cache) {
    const stored = loadStore();
    cache = stored ?? structuredClone(seedData);
    ensureCollections(cache);
    const cleaned = purgeRemovedAthletePayment(cache);
    if (!stored || cleaned) saveStore(cache);
    return cache;
  }

  ensureCollections(cache);
  if (purgeRemovedAthletePayment(cache)) saveStore(cache);
  return cache;
}

export function mutateData(updater: (data: AppData) => void): AppData {
  const data = structuredClone(getData());
  updater(data);
  cache = data;
  saveStore(data);
  return data;
}

export function resetData(): AppData {
  cache = structuredClone(seedData);
  saveStore(cache);
  return cache;
}

export { createId };
