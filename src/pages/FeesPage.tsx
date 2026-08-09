import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { AthleteTransaction } from '../types';
import { formatCurrency, formatDate } from '../utils/labels';

function athleteBalance(athleteId: string, transactions: AthleteTransaction[]) {
  return transactions
    .filter((t) => t.athleteId === athleteId)
    .reduce((sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount), 0);
}

export function FeesPage() {
  const { data } = useAppData();
  const [query, setQuery] = useState('');
  const transactions = data.transactions ?? [];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students
      .filter((s) => s.status !== 'inactive')
      .filter((s) => {
        if (!q) return true;
        return `${s.lastName} ${s.firstName} ${s.amka ?? ''}`.toLowerCase().includes(q);
      })
      .map((athlete) => {
        const balance = athleteBalance(athlete.id, transactions);
        const lastPayment = [...transactions]
          .filter((t) => t.athleteId === athlete.id && t.type === 'payment')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return {
          athlete,
          balance,
          lastPayment,
          cls: data.classes.find((c) => c.id === athlete.classId),
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [data.students, data.classes, transactions, query]);

  const totals = useMemo(
    () => ({
      owed: rows.filter((r) => r.balance > 0).reduce((sum, r) => sum + r.balance, 0),
      credit: rows.filter((r) => r.balance < 0).reduce((sum, r) => sum + Math.abs(r.balance), 0),
      athletesWithDebt: rows.filter((r) => r.balance > 0).length,
    }),
    [rows],
  );

  return (
    <div className="stack-lg">
      <PageHeader
        title="Συνδρομές / Πληρωμές"
        subtitle="Υπόλοιπα συνδρομών αθλητών και πρόσφατες πληρωμές."
      />

      <section className="stats-grid cols-3">
        <article className="stat-card tone-warn">
          <span className="stat-label">Οφειλές</span>
          <strong className="stat-value">{formatCurrency(totals.owed)}</strong>
          <span className="stat-hint">{totals.athletesWithDebt} αθλητές</span>
        </article>
        <article className="stat-card tone-positive">
          <span className="stat-label">Πιστωτικά</span>
          <strong className="stat-value">{formatCurrency(totals.credit)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Ενεργοί αθλητές</span>
          <strong className="stat-value">{String(rows.length)}</strong>
        </article>
      </section>

      <div className="toolbar">
        <input
          className="tx-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση αθλητή..."
        />
        <Link className="btn btn-secondary" to="/transactions">
          Μετάβαση σε Συναλλαγές
        </Link>
      </div>

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αθλητής</th>
              <th>Τμήμα</th>
              <th>Μηνιαία συνδρομή</th>
              <th>Υπόλοιπο</th>
              <th>Τελευταία πληρωμή</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ athlete, balance, lastPayment, cls }) => (
              <tr key={athlete.id}>
                <td>
                  <strong>
                    {athlete.lastName} {athlete.firstName}
                  </strong>
                  <div className="muted">{athlete.amka || '—'}</div>
                </td>
                <td>{cls?.name ?? '—'}</td>
                <td>{formatCurrency(athlete.monthlyFee)}</td>
                <td>
                  <span className={balance > 0 ? 'badge badge-overdue' : 'badge badge-paid'}>
                    {formatCurrency(balance)}
                  </span>
                </td>
                <td>
                  {lastPayment
                    ? `${formatCurrency(lastPayment.amount)} · ${formatDate(lastPayment.createdAt.slice(0, 10))}`
                    : '—'}
                </td>
                <td className="row-actions">
                  <Link className="btn btn-secondary" to={`/athletes/${athlete.id}`}>
                    Προφίλ
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
