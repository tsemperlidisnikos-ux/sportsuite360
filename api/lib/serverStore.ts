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

type GlobalStore = {
  settlements: VivaSettlement[];
  mirrors: Record<string, { updatedAt: string; payload: unknown }>;
};

function store(): GlobalStore {
  const g = globalThis as typeof globalThis & { __ss360?: GlobalStore };
  if (!g.__ss360) {
    g.__ss360 = { settlements: [], mirrors: {} };
  }
  return g.__ss360;
}

export function addSettlement(input: Omit<VivaSettlement, 'id' | 'consumed' | 'createdAt'>): VivaSettlement {
  const item: VivaSettlement = {
    ...input,
    id: `vs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    consumed: false,
  };
  const s = store();
  s.settlements = [item, ...s.settlements.filter((x) => x.orderCode !== item.orderCode)].slice(
    0,
    200,
  );
  return item;
}

export function listOpenSettlements(): VivaSettlement[] {
  return store().settlements.filter((s) => !s.consumed);
}

export function consumeSettlement(orderCode: string): VivaSettlement | null {
  const s = store();
  const found = s.settlements.find((x) => x.orderCode === String(orderCode) && !x.consumed);
  if (!found) return null;
  found.consumed = true;
  return found;
}

export function saveMirror(clubId: string, payload: unknown): void {
  store().mirrors[clubId] = {
    updatedAt: new Date().toISOString(),
    payload,
  };
}

export function loadMirror(clubId: string): { updatedAt: string; payload: unknown } | null {
  return store().mirrors[clubId] ?? null;
}

export function listMirrorKeys(): string[] {
  return Object.keys(store().mirrors);
}
