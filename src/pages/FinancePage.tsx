import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as financeService from '../api/services/financeService';
import { ExpenseEntryPanel } from '../components/ExpenseEntryPanel';
import { BudgetPanel } from '../components/BudgetPanel';
import { FinanceReportsPanel } from '../components/FinanceReportsPanel';
import { IncomeEntryPanel } from '../components/IncomeEntryPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAppData } from '../hooks/useAppData';
import { getSession } from '../auth/auth';
import {
  getPreviewClubId,
  getScfModulesForClub,
  SCF_MODULES,
} from '../platform/platformConfig';
import {
  expenseCategoryLabels,
  formatCurrency,
  formatMonth,
  revenueCategoryLabels,
} from '../utils/labels';

type Tab = 'analysis' | 'revenues' | 'expenses' | 'budget' | 'reports';

const pieColors = ['#0d7377', '#14919b', '#c45c26', '#e8a838', '#2f4858', '#6b8f71'];

const TAB_TO_SCF: Record<Tab, string> = {
  analysis: 'dashboard',
  revenues: 'income',
  expenses: 'expense',
  budget: 'budget',
  reports: 'reports',
};

export function FinancePage() {
  const { refresh, version } = useAppData();
  const session = getSession();
  const previewClubId = getPreviewClubId();
  const clubId = previewClubId ?? session?.clubId ?? null;
  const scfModules = useMemo(
    () => new Set(clubId ? getScfModulesForClub(clubId) : SCF_MODULES.map((m) => m.id)),
    [clubId],
  );

  const availableTabs = (
    [
      ['analysis', 'Ανάλυση'],
      ['revenues', 'Έσοδα'],
      ['expenses', 'Έξοδα'],
      ['budget', 'Προϋπολογισμός'],
      ['reports', 'Reports'],
    ] as const
  ).filter(([id]) => {
    const moduleId = TAB_TO_SCF[id];
    // Budget is always available in Finance; other tabs follow club SCF modules.
    return scfModules.has(moduleId) || id === 'analysis' || id === 'budget';
  });

  const [tab, setTab] = useState<Tab>('analysis');
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof financeService.getFinanceSummary>
  >['data']>();

  useEffect(() => {
    if (!availableTabs.some(([id]) => id === tab)) {
      setTab(availableTabs[0]?.[0] ?? 'analysis');
    }
  }, [availableTabs, tab]);

  useEffect(() => {
    void financeService.getFinanceSummary().then((res) => {
      if (res.success) setSummary(res.data);
    });
  }, [version]);

  const monthlyChart = useMemo(
    () =>
      summary?.monthly.map((m) => ({
        ...m,
        label: formatMonth(m.month),
      })) ?? [],
    [summary],
  );

  const revenuePie =
    summary?.revenueByCategory.map((item) => ({
      name: revenueCategoryLabels[item.category as keyof typeof revenueCategoryLabels] ?? item.category,
      value: item.amount,
    })) ?? [];

  const expensePie =
    summary?.expenseByCategory.map((item) => ({
      name: expenseCategoryLabels[item.category as keyof typeof expenseCategoryLabels] ?? item.category,
      value: item.amount,
    })) ?? [];

  return (
    <div className="stack-lg">
      <PageHeader
        title="Οικονομικά"
        subtitle="Έσοδα, έξοδα και ανάλυση ταμείου της ακαδημίας."
      />

      <div className="tabs">
        {availableTabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'analysis' ? (
        <>
          <section className="stats-grid cols-3">
            <StatCard
              label="Συνολικά έσοδα"
              value={formatCurrency(summary?.totalRevenue ?? 0)}
              icon={TrendingUp}
              tone="positive"
            />
            <StatCard
              label="Συνολικά έξοδα"
              value={formatCurrency(summary?.totalExpenses ?? 0)}
              icon={TrendingDown}
              tone="negative"
            />
            <StatCard
              label="Καθαρό αποτέλεσμα"
              value={formatCurrency(summary?.net ?? 0)}
              hint={`Εκκρεμή: ${formatCurrency(summary?.pending ?? 0)}`}
              icon={Wallet}
              tone={(summary?.net ?? 0) >= 0 ? 'positive' : 'negative'}
            />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Μηνιαία σύγκριση εσόδων / εξόδων</h2>
            </div>
            <div className="chart-box tall">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,36,33,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Legend />
                  <Bar dataKey="revenue" name="Έσοδα" fill="#0d7377" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Έξοδα" fill="#c45c26" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid-2">
            <article className="panel">
              <div className="panel-head">
                <h2>Έσοδα ανά κατηγορία</h2>
              </div>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={revenuePie} dataKey="value" nameKey="name" outerRadius={95} label>
                      {revenuePie.map((_, index) => (
                        <Cell key={index} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="panel">
              <div className="panel-head">
                <h2>Έξοδα ανά κατηγορία</h2>
              </div>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={95} label>
                      {expensePie.map((_, index) => (
                        <Cell key={index} fill={pieColors[(index + 2) % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>
        </>
      ) : null}

      {tab === 'revenues' ? <IncomeEntryPanel onSaved={refresh} /> : null}
      {tab === 'expenses' ? <ExpenseEntryPanel onSaved={refresh} /> : null}
      {tab === 'budget' ? <BudgetPanel onSaved={refresh} /> : null}
      {tab === 'reports' ? <FinanceReportsPanel /> : null}
    </div>
  );
}
