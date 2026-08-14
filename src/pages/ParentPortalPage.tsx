import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CalendarDays, CreditCard, Users } from 'lucide-react';
import * as vivaService from '../api/services/vivaService';
import { getSession } from '../auth/auth';
import { getClubViva } from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { getPreviewClubId } from '../platform/platformConfig';
import { settleVivaReturn } from '../utils/vivaSettle';
import { formatCurrency, formatDate } from '../utils/labels';
import { localDateIso } from '../utils/dates';
import { announcementVisibleToParent } from '../utils/announcementAudience';

function athleteBalance(
  athleteId: string,
  transactions: { athleteId: string; type: string; amount: number }[],
): number {
  return transactions
    .filter((t) => t.athleteId === athleteId)
    .reduce((sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount), 0);
}

export function ParentPortalPage() {
  const { data, refresh } = useAppData();
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;
  const viva = clubId ? getClubViva(clubId) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [payError, setPayError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const txnId = searchParams.get('t');
    const orderCode = searchParams.get('s');
    if ((!txnId && !orderCode) || !clubId) return;
    let cancelled = false;
    void (async () => {
      const result = await settleVivaReturn({
        clubId,
        orderCode,
        transactionId: txnId,
      });
      if (cancelled) return;
      setMessage(result.message);
      if (result.settled) refresh();
      setSearchParams({}, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, clubId, refresh]);

  const linkedAthletes = useMemo(() => {
    if (!session) return [];
    const athleteIds = new Set(
      (data.parentLinks ?? [])
        .filter((link) => link.parentUserId === session.id)
        .map((link) => link.athleteId),
    );
    return (data.students ?? []).filter(
      (s) => athleteIds.has(s.id) && s.status !== 'inactive',
    );
  }, [data.parentLinks, data.students, session]);

  const athleteIds = useMemo(
    () => new Set(linkedAthletes.map((a) => a.id)),
    [linkedAthletes],
  );

  const balances = useMemo(
    () =>
      linkedAthletes.map((athlete) => ({
        athlete,
        balance: athleteBalance(athlete.id, data.transactions ?? []),
      })),
    [linkedAthletes, data.transactions],
  );

  const today = localDateIso();
  const upcomingTrainings = useMemo(() => {
    const classIds = new Set(
      linkedAthletes.map((a) => a.classId).filter(Boolean) as string[],
    );
    return (data.trainings ?? [])
      .filter((t) => {
        if (t.date < today) return false;
        if (t.classId && classIds.has(t.classId)) return true;
        return false;
      })
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
      .slice(0, 8);
  }, [data.trainings, linkedAthletes, today]);

  const recentAttendance = useMemo(() => {
    return (data.attendance ?? [])
      .filter((row) => athleteIds.has(row.studentId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [data.attendance, athleteIds]);

  const announcements = useMemo(() => {
    if (!session) return [];
    const linkedIds = linkedAthletes.map((a) => a.id);
    const linkedClasses = linkedAthletes
      .map((a) => a.classId)
      .filter(Boolean) as string[];
    const linkedMeta = linkedAthletes.map((a) => ({
      id: a.id,
      sport: a.sport,
      clubName: a.clubName,
      classSport: a.classId
        ? data.classes.find((c) => c.id === a.classId)?.sport
        : null,
    }));
    return (data.announcements ?? [])
      .filter((a) =>
        announcementVisibleToParent(a, session.id, linkedIds, linkedClasses, linkedMeta),
      )
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 8);
  }, [data.announcements, data.classes, linkedAthletes, session]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of data.classes ?? []) map.set(cls.id, cls.name);
    return map;
  }, [data.classes]);

  const athleteNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of linkedAthletes) {
      map.set(s.id, `${s.lastName} ${s.firstName}`.trim());
    }
    return map;
  }, [linkedAthletes]);

  async function handlePay(athleteId: string, amount: number, athleteName: string) {
    if (!clubId) return;
    setPayError('');
    setPayingId(athleteId);
    const email =
      linkedAthletes.find((a) => a.id === athleteId)?.motherEmail ||
      linkedAthletes.find((a) => a.id === athleteId)?.email ||
      session?.email ||
      '';
    const result = await vivaService.createVivaCheckout({
      clubId,
      amountEuro: amount,
      athleteId,
      athleteName,
      customerEmail: email,
      customerFullName: session?.fullName ?? athleteName,
      merchantTrns: `Οφειλή ${athleteName}`,
    });
    setPayingId(null);
    if (!result.success || !result.data?.checkoutUrl) {
      setPayError(result.error ?? 'Αποτυχία έναρξης πληρωμής Viva');
      return;
    }
    window.location.href = result.data.checkoutUrl;
  }

  return (
    <div className="stack-lg parent-portal">
      <PageHeader
        title="Περιοχή γονέα"
        subtitle={`Καλώς ήρθατε, ${session?.fullName ?? 'γονέα'}. Δείτε τα στοιχεία των συνδεδεμένων αθλητών.`}
      />

      {message ? <p className="settings-success">{message}</p> : null}

      {linkedAthletes.length === 0 ? (
        <section className="panel">
          <p className="muted">
            Δεν υπάρχουν συνδεδεμένοι αθλητές. Ζητήστε από τη γραμματεία να σας συνδέσει μέσω
            «Γονείς → Σύνδεση γονέα».
          </p>
        </section>
      ) : null}

      {linkedAthletes.length > 0 ? (
        <>
          <section className="panel parent-portal-section">
            <h2>
              <Users size={18} /> Αθλητές
            </h2>
            <ul className="parent-portal-list">
              {linkedAthletes.map((athlete) => (
                <li key={athlete.id}>
                  <strong>
                    {athlete.lastName} {athlete.firstName}
                  </strong>
                  <span className="muted">
                    {athlete.classId
                      ? classNameById.get(athlete.classId) || 'Τμήμα'
                      : 'Χωρίς τμήμα'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel parent-portal-section">
            <h2>
              <CreditCard size={18} /> Οφειλές συνδρομών
            </h2>
            {payError ? <p className="form-error">{payError}</p> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Αθλητής</th>
                    <th>Υπόλοιπο</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map(({ athlete, balance }) => (
                    <tr key={athlete.id}>
                      <td>
                        {athlete.lastName} {athlete.firstName}
                      </td>
                      <td>
                        <strong className={balance > 0 ? 'badge badge-overdue' : 'badge badge-paid'}>
                          {formatCurrency(balance)}
                        </strong>
                      </td>
                      <td className="row-actions">
                        {balance > 0 && viva?.enabled ? (
                          <Button
                            type="button"
                            disabled={payingId === athlete.id}
                            onClick={() =>
                              void handlePay(
                                athlete.id,
                                balance,
                                `${athlete.lastName} ${athlete.firstName}`,
                              )
                            }
                          >
                            {payingId === athlete.id ? 'Μετάβαση…' : 'Πληρωμή Viva'}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!viva?.enabled ? (
              <p className="muted settings-hint">
                Η online πληρωμή θα εμφανιστεί όταν ο σύλλογος ενεργοποιήσει το Viva Wallet.
              </p>
            ) : null}
          </section>

          <section className="panel parent-portal-section">
            <h2>
              <CalendarDays size={18} /> Επόμενες προπονήσεις
            </h2>
            {upcomingTrainings.length === 0 ? (
              <p className="muted">Δεν υπάρχουν προγραμματισμένες προπονήσεις.</p>
            ) : (
              <ul className="parent-portal-list">
                {upcomingTrainings.map((t) => (
                  <li key={t.id}>
                    <strong>
                      {formatDate(t.date)} · {t.startTime}
                      {t.endTime ? `–${t.endTime}` : ''}
                    </strong>
                    <span className="muted">
                      {(t.classId ? classNameById.get(t.classId) : null) ||
                        t.notes ||
                        'Προπόνηση'}
                      {t.location ? ` · ${t.location}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel parent-portal-section">
            <h2>
              <Users size={18} /> Πρόσφατες παρουσίες
            </h2>
            {recentAttendance.length === 0 ? (
              <p className="muted">Δεν υπάρχουν καταχωρήσεις παρουσίας.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ημ/νία</th>
                      <th>Αθλητής</th>
                      <th>Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.date)}</td>
                        <td>{athleteNameById.get(row.studentId) ?? '—'}</td>
                        <td>{row.present ? 'Παρών/ούσα' : 'Απών/ούσα'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel parent-portal-section">
            <h2>
              <Bell size={18} /> Ανακοινώσεις
            </h2>
            {announcements.length === 0 ? (
              <p className="muted">Δεν υπάρχουν ανακοινώσεις.</p>
            ) : (
              <ul className="parent-portal-list">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    <span className="muted">
                      {a.createdAt ? formatDate(a.createdAt.slice(0, 10)) : ''}
                      {a.message
                        ? ` · ${a.message.slice(0, 120)}${a.message.length > 120 ? '…' : ''}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
