import { Link } from 'react-router-dom';
import { UserCog, Layers, TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';
import { getFinanceSummary } from '../api/services/financeService';
import { AthletesIcon } from '../components/icons/AthletesIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAppData } from '../hooks/useAppData';
import { formatCurrency, formatMonth, paymentStatusLabels, studentStatusLabels } from '../utils/labels';

export function DashboardPage() {
  const { data, version } = useAppData();
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof getFinanceSummary>
  >['data']>();

  useEffect(() => {
    void getFinanceSummary().then((res) => {
      if (res.success) setSummary(res.data);
    });
  }, [version]);

  const recentPayments = [...data.revenues]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const chartData =
    summary?.monthly.map((m) => ({
      ...m,
      label: formatMonth(m.month),
    })) ?? [];

  return (
    <div className="stack-lg">
      <PageHeader
        title="Επισκόπηση"
        subtitle="Διαχείριση ακαδημίας και οικονομική εικόνα σε μία οθόνη."
      />

      <section className="stats-grid">
        <StatCard
          label="Ενεργοί αθλητές"
          value={String(summary?.activeStudents ?? 0)}
          hint={`${data.students.length} συνολικά`}
          icon={AthletesIcon}
        />
        <StatCard
          label="Προπονητές"
          value={String(summary?.activeCoaches ?? 0)}
          hint={`${summary?.classCount ?? 0} τμήματα`}
          icon={UserCog}
        />
        <StatCard
          label="Έσοδα"
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          hint="Πληρωμένα"
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="Έξοδα"
          value={formatCurrency(summary?.totalExpenses ?? 0)}
          hint="Σύνολο περιόδου"
          icon={TrendingDown}
          tone="negative"
        />
        <StatCard
          label="Καθαρό αποτέλεσμα"
          value={formatCurrency(summary?.net ?? 0)}
          hint="Έσοδα − Έξοδα"
          icon={Wallet}
          tone={(summary?.net ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Εκκρεμή"
          value={formatCurrency(summary?.pending ?? 0)}
          hint="Pending / overdue"
          icon={AlertCircle}
          tone="warn"
        />
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2>Ταμειακή ροή</h2>
            <Link to="/finance" className="text-link">
              Αναλυτικά →
            </Link>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d7377" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d7377" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c45c26" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#c45c26" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,36,33,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Έσοδα"
                  stroke="#0d7377"
                  fill="url(#revFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Έξοδα"
                  stroke="#c45c26"
                  fill="url(#expFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Πρόσφατες εισπράξεις</h2>
            <Link to="/finance" className="text-link">
              Όλα →
            </Link>
          </div>
          <ul className="feed-list">
            {recentPayments.map((payment) => (
              <li key={payment.id}>
                <div>
                  <strong>{payment.description}</strong>
                  <span>{payment.date}</span>
                </div>
                <div className="feed-meta">
                  <span className={`badge badge-${payment.paymentStatus}`}>
                    {paymentStatusLabels[payment.paymentStatus]}
                  </span>
                  <strong>{formatCurrency(payment.amount)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2>Τμήματα</h2>
            <Link to="/classes" className="text-link">
              Διαχείριση →
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Όνομα</th>
                  <th>Ηλικίες</th>
                  <th>Αθλητές</th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((cls) => {
                  const count = data.students.filter((s) => s.classId === cls.id).length;
                  return (
                    <tr key={cls.id}>
                      <td>
                        <strong>{cls.name}</strong>
                        <div className="muted">{cls.sport}</div>
                      </td>
                      <td>{cls.ageGroup}</td>
                      <td>
                        {count}/{cls.maxStudents}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Κατάσταση αθλητών</h2>
            <Link to="/athletes" className="text-link">
              Όλοι →
            </Link>
          </div>
          <ul className="feed-list">
            {data.students.slice(0, 6).map((student) => {
              const cls = data.classes.find((c) => c.id === student.classId);
              return (
                <li key={student.id}>
                  <div>
                    <strong>
                      {student.firstName} {student.lastName}
                    </strong>
                    <span>{cls?.name ?? 'Χωρίς τμήμα'}</span>
                  </div>
                  <span className={`badge badge-${student.status}`}>
                    {studentStatusLabels[student.status]}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="quick-links">
            <Link to="/schedule">Πρόγραμμα</Link>
            <Link to="/attendance">Παρουσίες</Link>
            <Link to="/finance">Οικονομική ανάλυση</Link>
          </div>
        </article>
      </section>

      <section className="panel accent-panel">
        <div className="accent-grid">
          <div>
            <Layers size={22} />
            <h2>Δύο εφαρμογές, μία πλατφόρμα</h2>
            <p>
              Η διαχείριση ακαδημίας (αθλητές, τμήματα, πρόγραμμα, παρουσίες) και η
              ανάλυση εσόδων–εξόδων δουλεύουν πάνω στα ίδια δεδομένα — χωρίς διπλή
              καταχώριση.
            </p>
          </div>
          <div className="accent-actions">
            <Link className="btn btn-primary" to="/athletes">
              Διαχείριση ακαδημίας
            </Link>
            <Link className="btn btn-secondary" to="/finance">
              Ανάλυση οικονομικών
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
