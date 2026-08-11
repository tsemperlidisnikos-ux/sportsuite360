import { apiClient } from '../apiClient';
import { createId, getData, mutateData } from '../../data/repository';
import { feeChargeTemplateSchema, type FeeChargeTemplateInput } from '../../schemas';
import type {
  AthleteTransaction,
  FeeChargeTemplate,
  FeeReminderLog,
  Student,
} from '../../types';
import { localDateIso, localDateTimeIso } from '../../utils/dates';
import { normalizeSportKey } from '../../utils/sport';

export const FEE_SEASON_MONTHS = [
  { month: 8, label: 'Αύγ' },
  { month: 9, label: 'Σεπ' },
  { month: 10, label: 'Οκτ' },
  { month: 11, label: 'Νοέ' },
  { month: 12, label: 'Δεκ' },
  { month: 1, label: 'Ιαν' },
  { month: 2, label: 'Φεβ' },
  { month: 3, label: 'Μάρ' },
  { month: 4, label: 'Απρ' },
  { month: 5, label: 'Μάι' },
  { month: 6, label: 'Ιούν' },
  { month: 7, label: 'Ιούλ' },
] as const;

export const DEFAULT_FEE_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

function seasonStartYear(season: string): number {
  const match = season.match(/(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

export function yearForSeasonMonth(season: string, month: number): number {
  const start = seasonStartYear(season);
  return month >= 7 ? start : start + 1;
}

function studentSport(
  student: Student,
  classSportById: Map<string, string>,
): string {
  if (student.sport?.trim()) return student.sport.trim();
  if (student.classId) return classSportById.get(student.classId)?.trim() || '';
  return '';
}

export const FEE_APPLIES_TO_OPTIONS = [
  { value: 'all', label: 'Όλοι οι αθλητές' },
  { value: 'monthly', label: 'Αθλητές με χρέωση μήνα' },
  { value: 'registration', label: 'Αθλητές με χρέωση εγγραφής' },
  { value: 'seasonTicket', label: 'Αθλητές με εισιτήριο διαρκείας' },
  { value: 'class', label: 'Συγκεκριμένο τμήμα' },
] as const;

export type FeeAppliesTo = (typeof FEE_APPLIES_TO_OPTIONS)[number]['value'];

export const FEE_APPLIES_TO_LABELS: Record<FeeAppliesTo, string> = {
  all: 'Όλοι οι αθλητές',
  monthly: 'Αθλητές με χρέωση μήνα',
  registration: 'Αθλητές με χρέωση εγγραφής',
  seasonTicket: 'Αθλητές με εισιτήριο διαρκείας',
  class: 'Συγκεκριμένο τμήμα',
};

function athleteMatchesAppliesTo(
  student: Student,
  appliesTo: FeeChargeTemplate['appliesTo'],
  classId: string | null | undefined,
): boolean {
  switch (appliesTo) {
    case 'monthly':
      return student.monthlyCharge !== false;
    case 'registration':
      return Boolean(student.registrationCharge ?? (student.registrationFee ?? 0) > 0);
    case 'seasonTicket':
      return Boolean(student.seasonTicket);
    case 'class':
      return Boolean(classId) && student.classId === classId;
    case 'all':
    default:
      return true;
  }
}

function athleteMatchesSport(
  student: Student,
  sport: string,
  classSportById: Map<string, string>,
): boolean {
  if (!sport.trim()) return true;
  return normalizeSportKey(studentSport(student, classSportById)) === normalizeSportKey(sport);
}

function hasCharge(
  transactions: AthleteTransaction[],
  athleteId: string,
  month: number,
  year: number,
  commentIncludes: string,
): boolean {
  return transactions.some(
    (t) =>
      t.athleteId === athleteId &&
      t.type === 'charge' &&
      t.month === month &&
      t.year === year &&
      t.comments.includes(commentIncludes),
  );
}

export async function createFeeChargeTemplate(input: FeeChargeTemplateInput) {
  return apiClient(() => {
    const parsed = feeChargeTemplateSchema.parse(input);
    if (parsed.monthlyAmount <= 0 && parsed.seasonTicketAmount <= 0 && parsed.registrationFee <= 0) {
      throw new Error('Συμπληρώστε τουλάχιστον ένα ποσό χρέωσης');
    }
    if (parsed.monthlyAmount > 0 && parsed.months.length === 0) {
      throw new Error('Επιλέξτε μήνες μηνιαίας συνδρομής');
    }
    if (parsed.seasonTicketAmount > 0 && parsed.seasonTicketMonths.length === 0) {
      throw new Error('Επιλέξτε μήνες εισιτηρίου διαρκείας');
    }
    if (parsed.appliesTo === 'class' && !parsed.classId) {
      throw new Error('Επιλέξτε τμήμα για «Συγκεκριμένο τμήμα»');
    }

    const template: FeeChargeTemplate = {
      ...parsed,
      classId: parsed.appliesTo === 'class' ? parsed.classId : null,
      id: createId('feeTpl'),
      createdAt: localDateTimeIso(),
    };
    mutateData((data) => {
      if (!data.feeChargeTemplates) data.feeChargeTemplates = [];
      data.feeChargeTemplates.unshift(template);
    });
    return template;
  });
}

export async function deleteFeeChargeTemplate(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.feeChargeTemplates = (data.feeChargeTemplates ?? []).filter((t) => t.id !== id);
    });
    return { id };
  });
}

export async function generateChargesFromTemplate(templateId: string) {
  return apiClient(() => {
    const data = getData();
    const template = (data.feeChargeTemplates ?? []).find((t) => t.id === templateId);
    if (!template) throw new Error('Το πρότυπο χρέωσης δεν βρέθηκε');

    const classSportById = new Map(data.classes.map((c) => [c.id, c.sport ?? '']));
    const athletes = data.students.filter(
      (s) =>
        s.status === 'active' &&
        athleteMatchesSport(s, template.sport, classSportById) &&
        athleteMatchesAppliesTo(s, template.appliesTo ?? 'all', template.classId),
    );

    let created = 0;
    mutateData((store) => {
      if (!store.transactions) store.transactions = [];
      const existing = store.transactions;

      for (const athlete of athletes) {
        const monthlyBase =
          athlete.monthlyFee > 0 ? athlete.monthlyFee : template.monthlyAmount;
        const amount = template.monthlyAmount > 0 ? template.monthlyAmount : monthlyBase;

        let firstMonthly = true;
        for (const month of template.months) {
          if (amount <= 0) break;
          const year = yearForSeasonMonth(template.season, month);
          const tag = `[fee:${template.id}:sub]`;
          if (hasCharge(existing, athlete.id, month, year, tag)) continue;

          let chargeAmount = amount;
          let comments = `${template.typeLabel} ${template.season} ${tag}`;
          if (firstMonthly && template.registrationFee > 0) {
            const regTag = `[fee:${template.id}:reg]`;
            if (!hasCharge(existing, athlete.id, month, year, regTag)) {
              chargeAmount += template.registrationFee;
              comments = `${template.typeLabel} + Εγγραφή ${template.season} ${tag} ${regTag}`;
            }
          }
          firstMonthly = false;

          existing.push({
            id: createId('txn'),
            athleteId: athlete.id,
            amount: chargeAmount,
            receiptNumber: '',
            type: 'charge',
            month,
            year,
            paymentMethod: '',
            comments,
            createdAt: localDateTimeIso(),
          });
          created += 1;
        }

        if (template.seasonTicketAmount > 0 && template.seasonTicketMonths.length > 0) {
          const perMonth =
            Math.round((template.seasonTicketAmount / template.seasonTicketMonths.length) * 100) /
            100;
          for (const month of template.seasonTicketMonths) {
            const year = yearForSeasonMonth(template.season, month);
            const tag = `[fee:${template.id}:ticket]`;
            if (hasCharge(existing, athlete.id, month, year, tag)) continue;
            existing.push({
              id: createId('txn'),
              athleteId: athlete.id,
              amount: perMonth,
              receiptNumber: '',
              type: 'charge',
              month,
              year,
              paymentMethod: '',
              comments: `Εισιτήριο διαρκείας ${template.season} ${tag}`,
              createdAt: localDateTimeIso(),
            });
            created += 1;
          }
        }
      }
    });

    return { created, athletes: athletes.length };
  });
}

export function athleteBalance(
  athleteId: string,
  transactions: AthleteTransaction[],
): number {
  return transactions
    .filter((t) => t.athleteId === athleteId)
    .reduce((sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount), 0);
}

export type DebtReminderRow = {
  athleteId: string;
  athleteName: string;
  balance: number;
  oldestChargeDate: string;
  daysOverdue: number;
  reminderDays: number;
  email: string;
};

export function listDebtReminders(): DebtReminderRow[] {
  const data = getData();
  const today = localDateIso();
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const templates = data.feeChargeTemplates ?? [];
  const defaultReminder = templates[0]?.reminderDays ?? 7;

  const rows: DebtReminderRow[] = [];
  for (const student of data.students) {
    if (student.status === 'inactive') continue;
    const txns = (data.transactions ?? []).filter((t) => t.athleteId === student.id);
    const balance = athleteBalance(student.id, txns);
    if (balance <= 0) continue;

    const charges = txns
      .filter((t) => t.type === 'charge')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const oldest = charges[0];
    if (!oldest) continue;

    const chargeDay = oldest.createdAt.slice(0, 10);
    const daysOverdue = Math.max(
      0,
      Math.floor((todayMs - new Date(`${chargeDay}T12:00:00`).getTime()) / 86_400_000),
    );
    if (daysOverdue < defaultReminder) continue;

    rows.push({
      athleteId: student.id,
      athleteName: `${student.lastName} ${student.firstName}`.trim(),
      balance,
      oldestChargeDate: chargeDay,
      daysOverdue,
      reminderDays: defaultReminder,
      email: student.email || student.guardianPhone || '',
    });
  }

  return rows.sort((a, b) => b.balance - a.balance);
}

export async function logDebtReminder(input: {
  athleteId: string;
  amount: number;
  note?: string;
  templateId?: string;
}) {
  return apiClient(() => {
    const entry: FeeReminderLog = {
      id: createId('feeRem'),
      athleteId: input.athleteId,
      templateId: input.templateId,
      amount: input.amount,
      note: input.note ?? 'Υπενθύμιση οφειλής',
      createdAt: localDateTimeIso(),
    };
    mutateData((data) => {
      if (!data.feeReminderLogs) data.feeReminderLogs = [];
      data.feeReminderLogs.unshift(entry);
    });
    return entry;
  });
}
