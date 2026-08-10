import { Link } from 'react-router-dom';
import { Layers, Banknote, UserCog } from 'lucide-react';
import { AthletesIcon } from '../components/icons/AthletesIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAppData } from '../hooks/useAppData';
import { localDateIso } from '../utils/dates';
import { formatCurrency, studentStatusLabels } from '../utils/labels';

export function DashboardPage() {
  const { data } = useAppData();

  const activeStudents = data.students.filter((s) => s.status === 'active').length;
  const activeCoaches = data.coaches.filter((c) => c.active !== false).length;
  const classCount = data.classes.length;

  const today = localDateIso();
  /** createdAt είναι ISO/UTC — η σύγκριση γίνεται σε τοπική ημερομηνία. */
  function createdOnLocalDay(iso: string, day: string): boolean {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      return localDateIso(parsed) === day;
    }
    return iso.slice(0, 10) === day;
  }

  const fromTransactions = (data.transactions ?? [])
    .filter((t) => t.type === 'payment' && createdOnLocalDay(t.createdAt, today))
    .reduce((sum, t) => sum + t.amount, 0);

  const fromAthleteRevenues = data.revenues
    .filter(
      (r) =>
        r.date === today &&
        r.paymentStatus === 'paid' &&
        Boolean(r.studentId || r.surname || r.firstName),
    )
    .reduce((sum, r) => sum + r.amount, 0);

  const dailyAthletePayments = fromTransactions + fromAthleteRevenues;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Επισκόπηση"
        subtitle="Διαχείριση ακαδημίας σε μία οθόνη."
      />

      <section className="stats-grid cols-4">
        <StatCard
          label="Ενεργοί αθλητές"
          value={String(activeStudents)}
          hint={`${data.students.length} συνολικά`}
          icon={AthletesIcon}
        />
        <StatCard
          label="Προπονητές"
          value={String(activeCoaches)}
          hint={`${data.coaches.length} συνολικά`}
          icon={UserCog}
        />
        <StatCard
          label="Τμήματα"
          value={String(classCount)}
          hint={`${activeStudents} ενεργοί αθλητές`}
          icon={Layers}
        />
        <StatCard
          label="Ημερίσια Έσοδα"
          value={formatCurrency(dailyAthletePayments)}
          hint="Πληρωμές αθλητών σήμερα"
          icon={Banknote}
          tone="positive"
        />
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
                {data.classes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Δεν υπάρχουν τμήματα.
                    </td>
                  </tr>
                ) : (
                  data.classes.map((cls) => {
                    const count = data.students.filter(
                      (s) => s.classId === cls.id && s.status !== 'inactive',
                    ).length;
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
                  })
                )}
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
            {data.students
              .filter((s) => s.status !== 'inactive')
              .slice(0, 6)
              .map((student) => {
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
            <Link to="/classes">Τμήματα</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
