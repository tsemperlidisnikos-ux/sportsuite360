import { apiClient } from '../apiClient';
import { getData, mutateData } from '../../data/repository';
import type { AthleteTransaction } from '../../types';

function chargeRemaining(charge: AthleteTransaction, payments: AthleteTransaction[]): number {
  const allocated = payments
    .filter((p) => p.type === 'payment' && p.allocatesChargeId === charge.id)
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, charge.amount - allocated);
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

/** Αντιστοιχεί πληρωμή σε ανοιχτή χρέωση (FIFO αν δεν δοθεί chargeId). */
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
          : open[0]) ?? null;
      if (!target) throw new Error('Δεν υπάρχει ανοιχτή χρέωση για αντιστοίχιση');
      payment.allocatesChargeId = target.charge.id;
      result = {
        paymentId: payment.id,
        chargeId: target.charge.id,
        remaining: Math.max(0, target.remaining - payment.amount),
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
    });
    return { paymentId };
  });
}
