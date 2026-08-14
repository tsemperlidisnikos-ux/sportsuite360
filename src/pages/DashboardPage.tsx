import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Layers, Banknote, UserCog } from 'lucide-react';
import { getSession } from '../auth/auth';
import { AthletesIcon } from '../components/icons/AthletesIcon';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { getAccountBalances } from '../api/services/cashAccountsService';
import { useAppData } from '../hooks/useAppData';
import type { Coach, Student } from '../types';
import { formatAmkaForViewer } from '../utils/amkaAccess';
import { localDateIso } from '../utils/dates';
import { openAthleteHealthCardPreview } from '../utils/healthCardPreview';
import { formatCurrency, studentStatusLabels } from '../utils/labels';
import { normalizeSportKey } from '../utils/sport';

type SportBucket = { key: string; label: string };

function createdOnLocalDay(iso: string, day: string): boolean {
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    return localDateIso(parsed) === day;
  }
  return iso.slice(0, 10) === day;
}

function resolveStudentSport(
  student: Student,
  classSportById: Map<string, string>,
): string {
  const own = student.sport?.trim();
  if (own) return own;
  if (student.classId) {
    return classSportById.get(student.classId)?.trim() || '';
  }
  return '';
}

function matchesSport(value: string | undefined | null, sportKey: string): boolean {
  return normalizeSportKey(value) === sportKey;
}

function DoctorDashboard() {
  const { data } = useAppData();
  const [busyId, setBusyId] = useState<string | null>(null);

  const athletes = useMemo(
    () =>
      [...data.students]
        .filter((s) => s.status !== 'inactive')
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'el'),
        ),
    [data.students],
  );

  const withAmka = athletes.filter((s) => Boolean((s.amka ?? '').trim())).length;
  const withHealthCard = athletes.filter((s) => Boolean(s.healthCard)).length;

  async function handleHealthCard(student: Student) {
    setBusyId(student.id);
    const result = await openAthleteHealthCardPreview(student);
    setBusyId(null);
    if (!result.success) {
      window.alert(result.error ?? 'Αποτυχία προεπισκόπησης κάρτας υγείας');
    }
  }

  return (
    <div className="stack-lg doctor-dashboard">
      <PageHeader
        title="Επισκόπηση ιατρού"
        subtitle="Αθλητές και κάρτα υγείας — χωρίς οικονομικά ή διαχείριση συλλόγου."
        actions={
          <Link className="btn btn-primary" to="/athletes">
            Όλοι οι αθλητές
          </Link>
        }
      />

      <div className="stats-grid cols-3">
        <StatCard
          label="Ενεργοί αθλητές"
          value={String(athletes.length)}
          hint="Διαθέσιμοι για κάρτα υγείας"
          icon={AthletesIcon}
        />
        <StatCard
          label="Με ΑΜΚΑ"
          value={String(withAmka)}
          hint={`${athletes.length - withAmka} χωρίς ΑΜΚΑ`}
          icon={HeartPulse}
        />
        <StatCard
          label="Κάρτα υγείας"
          value={String(withHealthCard)}
          hint="Σημειωμένη ως έγκυρη"
          icon={HeartPulse}
        />
      </div>

      <article className="panel">
        <div className="panel-head">
          <h2>Αθλητές</h2>
          <Link to="/athletes" className="text-link">
            Πλήρης λίστα →
          </Link>
        </div>
        {athletes.length === 0 ? (
          <p className="muted">Δεν υπάρχουν ενεργοί αθλητές.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Αθλητής</th>
                  <th>ΑΜΚΑ</th>
                  <th>Γονέας</th>
                  <th>Κατάσταση</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {athletes.slice(0, 12).map((student) => (
                  <tr key={student.id}>
                    <td>
                      <strong>
                        {student.lastName} {student.firstName}
                      </strong>
                    </td>
                    <td>{formatAmkaForViewer(student.amka, true)}</td>
                    <td>{student.guardianName || '—'}</td>
                    <td>
                      <span className={`badge badge-${student.status}`}>
                        {studentStatusLabels[student.status]}
                      </span>
                    </td>
                    <td className="row-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        title="Προεπισκόπηση / εκτύπωση κάρτας υγείας"
                        disabled={busyId === student.id}
                        onClick={() => void handleHealthCard(student)}
                      >
                        <HeartPulse size={16} />
                        <span className="btn-label-inline">
                          {busyId === student.id ? '…' : 'Κάρτα υγείας'}
                        </span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {athletes.length > 12 ? (
          <p className="lede" style={{ marginTop: '0.75rem' }}>
            Εμφανίζονται οι πρώτοι 12. Δες όλους από{' '}
            <Link to="/athletes">Αθλητές</Link>.
          </p>
        ) : null}
      </article>
    </div>
  );
}

export function DashboardPage() {
  const { data } = useAppData();
  const isDoctor = getSession()?.role === 'doctor';
  const today = localDateIso();

  const classSportById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of data.classes) {
      map.set(cls.id, cls.sport ?? '');
    }
    return map;
  }, [data.classes]);

  const sports = useMemo(() => {
    const map = new Map<string, string>();
    const add = (label: string | undefined | null) => {
      const trimmed = String(label || '').trim();
      const key = normalizeSportKey(trimmed);
      if (!key || map.has(key)) return;
      map.set(key, trimmed);
    };

    for (const item of data.sports ?? []) {
      if (item.active === false) continue;
      add(item.name);
    }
    for (const cls of data.classes) add(cls.sport);
    for (const student of data.students) {
      add(resolveStudentSport(student, classSportById));
    }
    for (const coach of data.coaches) add(coach.sport);

    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'el')) as SportBucket[];
  }, [data.sports, data.classes, data.students, data.coaches, classSportById]);

  function statsForSport(sportKey: string | null) {
    const students = data.students.filter((student) => {
      if (!sportKey) return true;
      return matchesSport(resolveStudentSport(student, classSportById), sportKey);
    });
    const coaches = data.coaches.filter((coach: Coach) => {
      if (!sportKey) return true;
      return matchesSport(coach.sport, sportKey);
    });
    const classes = data.classes.filter((cls) => {
      if (!sportKey) return true;
      return matchesSport(cls.sport, sportKey);
    });

    const studentIds = new Set(students.map((s) => s.id));
    const activeStudents = students.filter((s) => s.status === 'active').length;
    const activeCoaches = coaches.filter((c) => c.active !== false).length;

    const fromTransactions = (data.transactions ?? [])
      .filter(
        (t) =>
          t.type === 'payment' &&
          createdOnLocalDay(t.createdAt, today) &&
          (!sportKey || studentIds.has(t.athleteId)),
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const fromAthleteRevenues = data.revenues
      .filter((r) => {
        if (r.linkedTransactionId) return false;
        if (r.date !== today || r.paymentStatus !== 'paid') return false;
        if (!r.studentId && !r.surname && !r.firstName) return false;
        if (!sportKey) return true;
        if (r.sport && matchesSport(r.sport, sportKey)) return true;
        if (r.studentId && studentIds.has(r.studentId)) return true;
        return false;
      })
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      activeStudents,
      totalStudents: students.length,
      activeCoaches,
      totalCoaches: coaches.length,
      classCount: classes.length,
      dailyAthletePayments: fromTransactions + fromAthleteRevenues,
    };
  }

  const showBySport = sports.length > 1;
  const sportRows: Array<{ key: string; label: string | null; sportKey: string | null }> =
    showBySport
      ? sports.map((sport) => ({
          key: sport.key,
          label: sport.label,
          sportKey: sport.key,
        }))
      : [
          {
            key: 'all',
            label: sports[0]?.label ?? null,
            sportKey: sports[0]?.key ?? null,
          },
        ];

  const moneyStrip = useMemo(() => {
    const monthPrefix = today.slice(0, 7);
    const payments = (data.transactions ?? []).filter((t) => t.type === 'payment');
    const monthCollections = payments
      .filter((t) => String(t.createdAt || '').slice(0, 7) === monthPrefix)
      .reduce((sum, t) => sum + t.amount, 0);
    const charges = (data.transactions ?? []).filter((t) => t.type === 'charge');
    const charged = charges.reduce((sum, t) => sum + t.amount, 0);
    const paid = payments.reduce((sum, t) => sum + t.amount, 0);
    const outstanding = Math.max(0, charged - paid);
    const cashBalance = getAccountBalances().reduce((sum, account) => sum + account.balance, 0);
    return { monthCollections, outstanding, cashBalance };
  }, [data.transactions, data.revenues, data.expenses, data.cashAccounts, today]);

  if (isDoctor) {
    return <DoctorDashboard />;
  }

  return (
    <div className="stack-lg">
      <PageHeader title="Επισκόπηση" subtitle="Διαχείριση ακαδημίας σε μία οθόνη." />

      <div className="money-strip" aria-label="Οικονομική σύνοψη">
        <div className="money-strip-item">
          <span>Ταμείο</span>
          <strong>{formatCurrency(moneyStrip.cashBalance)}</strong>
        </div>
        <div className="money-strip-item is-warn">
          <span>Οφειλές</span>
          <strong>{formatCurrency(moneyStrip.outstanding)}</strong>
        </div>
        <div className="money-strip-item is-accent">
          <span>Εισπράξεις μήνα</span>
          <strong>{formatCurrency(moneyStrip.monthCollections)}</strong>
        </div>
      </div>

      {sportRows.map((row) => {
        const stats = statsForSport(row.sportKey);
        const classes = data.classes.filter((cls) => {
          if (!row.sportKey) return true;
          return matchesSport(cls.sport, row.sportKey);
        });
        const athletes = data.students
          .filter((s) => s.status !== 'inactive')
          .filter((s) => {
            if (!row.sportKey) return true;
            return matchesSport(resolveStudentSport(s, classSportById), row.sportKey);
          })
          .slice(0, 6);

        return (
          <section key={row.key} className="dashboard-sport-block">
            {row.label ? <h2 className="dashboard-sport-title">{row.label}</h2> : null}
            <div className="stats-grid cols-4">
              <StatCard
                label="Ενεργοί αθλητές"
                value={String(stats.activeStudents)}
                hint={`${stats.totalStudents} συνολικά`}
                icon={AthletesIcon}
              />
              <StatCard
                label="Προπονητές"
                value={String(stats.activeCoaches)}
                hint={`${stats.totalCoaches} συνολικά`}
                icon={UserCog}
              />
              <StatCard
                label="Τμήματα"
                value={String(stats.classCount)}
                hint={`${stats.activeStudents} ενεργοί αθλητές`}
                icon={Layers}
              />
              <StatCard
                label="Ημερίσια Έσοδα"
                value={formatCurrency(stats.dailyAthletePayments)}
                hint="Πληρωμές αθλητών σήμερα"
                icon={Banknote}
                tone="positive"
              />
            </div>

            <div className="grid-2">
              <article className="panel">
                <div className="panel-head">
                  <h2>Τμήματα{row.label ? ` · ${row.label}` : ''}</h2>
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
                      {classes.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="muted">
                            Δεν υπάρχουν τμήματα.
                          </td>
                        </tr>
                      ) : (
                        classes.map((cls) => {
                          const count = data.students.filter(
                            (s) => s.classId === cls.id && s.status !== 'inactive',
                          ).length;
                          return (
                            <tr key={cls.id}>
                              <td>
                                <strong>{cls.name}</strong>
                                {!showBySport && cls.sport ? (
                                  <div className="muted">{cls.sport}</div>
                                ) : null}
                              </td>
                              <td>{cls.ageGroup || '—'}</td>
                              <td>{count}</td>
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
                  <h2>Κατάσταση αθλητών{row.label ? ` · ${row.label}` : ''}</h2>
                  <Link to="/athletes" className="text-link">
                    Όλοι →
                  </Link>
                </div>
                {athletes.length === 0 ? (
                  <p className="muted">Δεν υπάρχουν ενεργοί αθλητές.</p>
                ) : (
                  <ul className="feed-list">
                    {athletes.map((student) => {
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
                )}
                <div className="quick-links">
                  <Link to="/schedule">Πρόγραμμα</Link>
                  <Link to="/attendance">Παρουσίες</Link>
                  <Link to="/classes">Τμήματα</Link>
                </div>
              </article>
            </div>
          </section>
        );
      })}
    </div>
  );
}
