import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import * as financeService from '../api/services/financeService';
import { ExpenseEntryPanel } from '../components/ExpenseEntryPanel';
import { BudgetPanel } from '../components/BudgetPanel';
import { CashAccountsPanel } from '../components/CashAccountsPanel';
import { FinanceReportsPanel } from '../components/FinanceReportsPanel';
import { IncomeEntryPanel } from '../components/IncomeEntryPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAppData } from '../hooks/useAppData';
import { getSession } from '../auth/auth';
import {
  getAppearanceTheme,
  getPreviewClubId,
  getScfModulesForClub,
  SCF_MODULES,
  type AppearanceTheme,
  type ScfModuleId,
} from '../platform/platformConfig';
import {
  expenseCategoryLabels,
  formatCurrency,
  formatMonth,
  revenueCategoryLabels,
} from '../utils/labels';

const FinanceAnalysisCharts = lazy(() =>
  import('../components/FinanceAnalysisCharts').then((module) => ({
    default: module.FinanceAnalysisCharts,
  })),
);

type Tab = 'analysis' | 'revenues' | 'expenses' | 'budget' | 'reports' | 'accounts';

function chartColors(theme: AppearanceTheme) {
  if (theme === 'navy-amber') {
    return {
      pie: ['#0b1f3a', '#d4a017', '#c45c26', '#3b82f6', '#64748b', '#067647'],
      revenue: '#0b1f3a',
      expense: '#c45c26',
      grid: 'rgba(11, 31, 58, 0.1)',
    };
  }
  if (theme === 'ocean-slate') {
    return {
      pie: ['#1c2b3a', '#2a9bb5', '#c45c26', '#4a7c9b', '#64748b', '#067647'],
      revenue: '#2a9bb5',
      expense: '#c45c26',
      grid: 'rgba(28, 43, 58, 0.1)',
    };
  }
  if (theme === 'midnight-ice') {
    return {
      pie: ['#5ec8e8', '#3aafd0', '#c45c26', '#8ba8bc', '#38bdf8', '#3dcf8e'],
      revenue: '#5ec8e8',
      expense: '#c45c26',
      grid: 'rgba(232, 244, 252, 0.12)',
    };
  }
  if (theme === 'indigo-steel') {
    return {
      pie: ['#2a3344', '#4f5fd4', '#c45c26', '#6b78e0', '#64748b', '#067647'],
      revenue: '#4f5fd4',
      expense: '#c45c26',
      grid: 'rgba(42, 51, 68, 0.1)',
    };
  }
  return {
    pie: ['#0d7377', '#14919b', '#c45c26', '#e8a838', '#2f4858', '#6b8f71'],
    revenue: '#0d7377',
    expense: '#c45c26',
    grid: 'rgba(26, 36, 33, 0.08)',
  };
}

const TAB_TO_SCF: Record<Exclude<Tab, 'accounts'>, ScfModuleId> = {
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
      ['accounts', 'Ταμεία'],
      ['budget', 'Προϋπολογισμός'],
      ['reports', 'Αναφορές'],
    ] as const
  ).filter(([id]) => {
    if (id === 'accounts') return true;
    const moduleId = TAB_TO_SCF[id];
    // Budget is always available in Finance; other tabs follow club SCF modules.
    return scfModules.has(moduleId) || id === 'analysis' || id === 'budget';
  });

  const [tab, setTab] = useState<Tab>('analysis');
  const [appearance, setAppearance] = useState(() => getAppearanceTheme());
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof financeService.getFinanceSummary>
  >['data']>();
  const colors = useMemo(() => chartColors(appearance), [appearance]);

  useEffect(() => {
    const sync = () => setAppearance(getAppearanceTheme());
    window.addEventListener('academyhub-platform-updated', sync);
    return () => window.removeEventListener('academyhub-platform-updated', sync);
  }, []);

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
    <div className="stack-lg finance-page">
      <PageHeader
        title="Οικονομικά"
        subtitle="Έσοδα, έξοδα, προϋπολογισμός και αναφορές της ακαδημίας."
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

          <Suspense fallback={<section className="panel chart-box tall"><p className="muted">Φόρτωση γραφημάτων…</p></section>}>
            <FinanceAnalysisCharts
              monthlyChart={monthlyChart}
              revenuePie={revenuePie}
              expensePie={expensePie}
              colors={colors}
            />
          </Suspense>
        </>
      ) : null}

      {tab === 'revenues' ? <IncomeEntryPanel onSaved={refresh} /> : null}
      {tab === 'expenses' ? <ExpenseEntryPanel onSaved={refresh} /> : null}
      {tab === 'accounts' ? <CashAccountsPanel onSaved={refresh} /> : null}
      {tab === 'budget' ? <BudgetPanel onSaved={refresh} /> : null}
      {tab === 'reports' ? <FinanceReportsPanel /> : null}
    </div>
  );
}
