import { apiClient } from '../apiClient';
import { createId, getData, mutateData } from '../../data/repository';
import { transactionSchema, type TransactionInput } from '../../schemas';
import type { AthleteTransaction } from '../../types';

export async function getTransactions() {
  return apiClient(() => getData().transactions ?? []);
}

export async function createTransaction(input: TransactionInput) {
  return apiClient(() => {
    const parsed = transactionSchema.parse(input);
    const transaction: AthleteTransaction = {
      ...parsed,
      id: createId('txn'),
      createdAt: new Date().toISOString(),
    };
    mutateData((data) => {
      if (!data.transactions) data.transactions = [];
      data.transactions.push(transaction);

      if (parsed.type === 'payment') {
        data.revenues.push({
          id: createId('rev'),
          date: `${parsed.year}-${String(parsed.month).padStart(2, '0')}-01`,
          amount: parsed.amount,
          category: 'tuition',
          subcategory: 'ΣΥΝΔΡΟΜΕΣ ΑΘΛΗΤΩΝ',
          description: `Πληρωμή αθλητή (${parsed.receiptNumber || transaction.id})`,
          studentId: parsed.athleteId,
          paymentStatus: 'paid',
        });
      }
    });
    return transaction;
  });
}

export async function updateTransaction(id: string, input: TransactionInput) {
  return apiClient(() => {
    const parsed = transactionSchema.parse(input);
    let updated: AthleteTransaction | undefined;
    mutateData((data) => {
      if (!data.transactions) data.transactions = [];
      const index = data.transactions.findIndex((t) => t.id === id);
      if (index === -1) throw new Error('Η κίνηση δεν βρέθηκε');
      updated = {
        ...data.transactions[index],
        ...parsed,
      };
      data.transactions[index] = updated;
    });
    return updated!;
  });
}

export async function deleteTransaction(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.transactions = (data.transactions ?? []).filter((t) => t.id !== id);
      // Remove auto-created revenue linked to this athlete payment
      data.revenues = data.revenues.filter(
        (r) => !r.description.includes(`(${id})`),
      );
    });
    return { id };
  });
}
