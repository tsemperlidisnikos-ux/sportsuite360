import { apiClient } from '../apiClient';
import { getData, mutateData } from '../../data/repository';
import type { AppData, AthleteTransaction } from '../../types';
import { syncRevenuesForPaymentInData } from './athletePaymentRevenueBridge';

function chargeRemaining(charge: AthleteTransaction, payments: AthleteTransaction[]): number {
  const allocated = payments
    .filter((p) => p.type === 'payment' && p.allocatesChargeId === charge.id)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(charge.amount) || 0) - allocated);
}

function openChargesFor(
  athleteId: string,
  transactions: AthleteTransaction[],
) {
  const charges = transactions.filter(
    (t) => t.athleteId === athleteId && t.type === 'charge',
  );
  const payments = transactions.filter(
    (t) => t.athleteId === athleteId && t.type === 'payment',
  );
  return charges
    .map((charge) => ({
      charge,
      remaining: chargeRemaining(charge, payments),
    }))
    .filter((row) => row.remaining > 0.009)
    .sort((a, b) => a.charge.createdAt.localeCompare(b.charge.createdAt));
}

function pickChargeForPayment(
  payment: AthleteTransaction,
  open: ReturnType<typeof openChargesFor>,
) {
  const samePeriod = open.find(
    (row) =>
      Number(row.charge.month) === Number(payment.month) &&
      Number(row.charge.year) === Number(payment.year),
  );
  return samePeriod ?? open[0] ?? null;
}

export function listOpenCharges(athleteId: string) {
  return openChargesFor(athleteId, getData().transactions ?? []);
}

export function listUnallocatedPayments(athleteId: string) {
  return (getData().transactions ?? []).filter(
    (t) =>
      t.athleteId === athleteId &&
      t.type === 'payment' &&
      !t.allocatesChargeId,
  );
}

/** Αντιστοιχεί πληρωμή σε ανοιχτή χρέωση (ίδια περίοδος, αλλιώς FIFO). */
export async function applyPaymentToCharge(input: {
  paymentId: string;
  chargeId?: string | null;
}) {
  return apiClient(() => {
    let result: { paymentId: string; chargeId: string; remaining: number } | undefined;
    mutateData((data) => {
      const payment = data.transactions.find((t) => t.id === input.paymentId);
      if (!payment || payment.type !== 'payment') {
        throw new Error('Η πληρωμή δεν βρέθηκε');
      }
      const open = openChargesFor(payment.athleteId, data.transactions);
      const target =
        (input.chargeId
          ? open.find((row) => row.charge.id === input.chargeId)
          : pickChargeForPayment(payment, open)) ?? null;
      if (!target) throw new Error('Δεν υπάρχει ανοιχτή χρέωση για αντιστοίχιση');
      payment.allocatesChargeId = target.charge.id;
      syncRevenuesForPaymentInData(data, payment.id);
      result = {
        paymentId: payment.id,
        chargeId: target.charge.id,
        remaining: Math.max(0, target.remaining - (Number(payment.amount) || 0)),
      };
    });
    return result!;
  });
}

export async function autoAllocatePayment(paymentId: string) {
  return applyPaymentToCharge({ paymentId });
}

export async function clearPaymentAllocation(paymentId: string) {
  return apiClient(() => {
    mutateData((data) => {
      const payment = data.transactions.find((t) => t.id === paymentId);
      if (!payment || payment.type !== 'payment') {
        throw new Error('Η πληρωμή δεν βρέθηκε');
      }
      payment.allocatesChargeId = null;
      syncRevenuesForPaymentInData(data, payment.id);
    });
    return { paymentId };
  });
}

/**
 * Αντιστοιχεί παλιές πληρωμές χωρίς allocatesChargeId (ή με χρέωση που δεν υπάρχει πια).
 * Επιστρέφει τα ids πληρωμών που άλλαξαν.
 */
export function backfillPaymentAllocationsInData(data: AppData): string[] {
  if (!data.transactions) data.transactions = [];
  const chargeIds = new Set(
    data.transactions.filter((t) => t.type === 'charge').map((t) => t.id),
  );
  const changed: string[] = [];

  for (const payment of data.transactions) {
    if (payment.type !== 'payment') continue;
    if (payment.allocatesChargeId && !chargeIds.has(payment.allocatesChargeId)) {
      payment.allocatesChargeId = null;
      changed.push(payment.id);
    }
  }

  const unallocated = data.transactions
    .filter((t) => t.type === 'payment' && !t.allocatesChargeId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const payment of unallocated) {
    const open = openChargesFor(payment.athleteId, data.transactions);
    const target = pickChargeForPayment(payment, open);
    if (!target) continue;
    payment.allocatesChargeId = target.charge.id;
    if (!changed.includes(payment.id)) changed.push(payment.id);
  }

  return changed;
}

/** Τρέχει μία φορά όταν ανοίγει Finance/Συναλλαγές — παλιές + νέες. */
export function ensureLegacyPaymentsMatched(): number {
  const data = getData();
  const needs = (data.transactions ?? []).some((t) => {
    if (t.type !== 'payment') return false;
    if (!t.allocatesChargeId) return true;
    return !(data.transactions ?? []).some(
      (c) => c.id === t.allocatesChargeId && c.type === 'charge',
    );
  });
  if (!needs) return 0;

  let count = 0;
  mutateData((draft) => {
    const changed = backfillPaymentAllocationsInData(draft);
    count = changed.length;
    for (const paymentId of changed) {
      syncRevenuesForPaymentInData(draft, paymentId);
    }
  });
  return count;
}
