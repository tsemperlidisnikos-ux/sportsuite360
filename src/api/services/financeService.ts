import { apiClient } from '../apiClient';
import { createId, getData, mutateData } from '../../data/repository';
import {
  expenseSchema,
  revenueSchema,
  type ExpenseInput,
  type RevenueInput,
} from '../../schemas';
import type { Expense, Revenue } from '../../types';

export async function getRevenues() {
  return apiClient(() => getData().revenues);
}

export async function createRevenue(input: RevenueInput) {
  return apiClient(() => {
    const parsed = revenueSchema.parse(input);
    const revenue: Revenue = {
      ...parsed,
      id: createId('rev'),
    };
    mutateData((data) => {
      data.revenues.push(revenue);
    });
    return revenue;
  });
}

export async function updateRevenue(id: string, input: RevenueInput) {
  return apiClient(() => {
    const parsed = revenueSchema.parse(input);
    let updated: Revenue | undefined;
    mutateData((data) => {
      const index = data.revenues.findIndex((r) => r.id === id);
      if (index === -1) throw new Error('Η είσπραξη δεν βρέθηκε');
      updated = { ...data.revenues[index], ...parsed };
      data.revenues[index] = updated;
    });
    return updated!;
  });
}

export async function deleteRevenue(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.revenues = data.revenues.filter((r) => r.id !== id);
    });
    return { id };
  });
}

export async function getExpenses() {
  return apiClient(() => getData().expenses);
}

export async function createExpense(input: ExpenseInput) {
  return apiClient(() => {
    const parsed = expenseSchema.parse(input);
    const expense: Expense = {
      ...parsed,
      id: createId('exp'),
    };
    mutateData((data) => {
      data.expenses.push(expense);
    });
    return expense;
  });
}

export async function updateExpense(id: string, input: ExpenseInput) {
  return apiClient(() => {
    const parsed = expenseSchema.parse(input);
    let updated: Expense | undefined;
    mutateData((data) => {
      const index = data.expenses.findIndex((e) => e.id === id);
      if (index === -1) throw new Error('Η δαπάνη δεν βρέθηκε');
      updated = { ...data.expenses[index], ...parsed };
      data.expenses[index] = updated;
    });
    return updated!;
  });
}

export async function deleteExpense(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.expenses = data.expenses.filter((e) => e.id !== id);
    });
    return { id };
  });
}

export async function getFinanceSummary() {
  return apiClient(() => {
    const { revenues, expenses, students, coaches, classes } = getData();
    const paidRevenues = revenues.filter((r) => r.paymentStatus === 'paid');
    const totalRevenue = paidRevenues.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const pending = revenues
      .filter((r) => r.paymentStatus === 'pending' || r.paymentStatus === 'overdue')
      .reduce((sum, r) => sum + r.amount, 0);

    const byMonth = new Map<string, { revenue: number; expense: number }>();
    for (const r of paidRevenues) {
      const key = r.date.slice(0, 7);
      const entry = byMonth.get(key) ?? { revenue: 0, expense: 0 };
      entry.revenue += r.amount;
      byMonth.set(key, entry);
    }
    for (const e of expenses) {
      const key = e.date.slice(0, 7);
      const entry = byMonth.get(key) ?? { revenue: 0, expense: 0 };
      entry.expense += e.amount;
      byMonth.set(key, entry);
    }

    const monthly = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        ...values,
        net: values.revenue - values.expense,
      }));

    const revenueByCategory = Object.entries(
      paidRevenues.reduce<Record<string, number>>((acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + r.amount;
        return acc;
      }, {}),
    ).map(([category, amount]) => ({ category, amount }));

    const expenseByCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amount;
        return acc;
      }, {}),
    ).map(([category, amount]) => ({ category, amount }));

    return {
      totalRevenue,
      totalExpenses,
      net: totalRevenue - totalExpenses,
      pending,
      activeStudents: students.filter((s) => s.status === 'active').length,
      activeCoaches: coaches.filter((c) => c.active).length,
      classCount: classes.length,
      monthly,
      revenueByCategory,
      expenseByCategory,
    };
  });
}
