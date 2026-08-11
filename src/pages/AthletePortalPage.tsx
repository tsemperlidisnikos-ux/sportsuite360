import { useMemo, useState } from 'react';
import { Bell, CalendarDays, ClipboardCheck, CreditCard } from 'lucide-react';
import * as vivaService from '../api/services/vivaService';
import { getSession } from '../auth/auth';
import { getClubViva } from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { getPreviewClubId } from '../platform/platformConfig';
import { localDateIso } from '../utils/dates';
import { formatCurrency, formatDate } from '../utils/labels';

function athleteBalance(
  athleteId: string,
  transactions: { athleteId: string; type: string; amount: number }[],
): number {
  return transactions
    .filter((t) => t.athleteId === athleteId)
    .reduce((sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount), 0);
}

export function AthletePortalPage() {
  const { data } = useAppData();
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;
  const viva = clubId ? getClubViva(clubId) : null;
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  const athlete = useMemo(() => {
    if (session?.athleteId) {
      return data.students.find((s) => s.id === session.athleteId) ?? null;
    }
    const email = session?.email?.toLowerCase() ?? '';
    return (
      data.students.find((s) => s.email.toLowerCase() === email && s.status !== 'inactive') ??
      null
    );
  }, [data.students, session]);

  const balance = athlete
    ? athleteBalance(athlete.id, data.transactions ?? [])
    : 0;

  const today = localDateIso();
  const upcoming = useMemo(() => {
    if (!athlete?.classId) return [];
    return (data.trainings ?? [])
      .filter((t) => t.date >= today && t.classId === athlete.classId)
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
      .slice(0, 8);
  }, [data.trainings, athlete, today]);

  const attendance = useMemo(() => {
    if (!athlete) return [];
    return (data.attendance ?? [])
      .filter((a) => a.studentId === athlete.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [data.attendance, athlete]);

  const announcements = useMemo(
    () =>
      (data.announcements ?? [])
        .filter((a) => {
          const roles = a.audienceRoles ?? [];
          if (roles.length === 0) return true;
          return roles.includes('athletes');
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 8),
    [data.announcements],
  );

  const className = athlete?.classId
    ? data.classes.find((c) => c.id === athlete.classId)?.name
    : null;

  async function handlePay() {
    if (!clubId || !athlete || balance <= 0) return;
    setPaying(true);
    setPayError('');
    const result = await vivaService.createVivaCheckout({
      clubId,
      amountEuro: balance,
      athleteId: athlete.id,
      athleteName: `${athlete.lastName} ${athlete.firstName}`,
      customerEmail: athlete.email || session?.email || undefined,
      customerFullName: `${athlete.lastName} ${athlete.firstName}`,
      merchantTrns: `Οφειλή ${athlete.lastName} ${athlete.firstName}`,
    });
    setPaying(false);
    if (!result.success || !result.data?.checkoutUrl) {
      setPayError(result.error ?? 'Αποτυχία Viva');
      return;
    }
    window.location.href = result.data.checkoutUrl;
  }

  return (
    <div className="stack-lg parent-portal">
      <PageHeader
        title="Περιοχή αθλητή"
        subtitle={`Καλώς ήρθατε, ${session?.fullName ?? 'αθλητή'}.`}
      />

      {!athlete ? (
        <section className="panel">
          <p className="muted">
            Δεν βρέθηκε συνδεδεμένο προφίλ αθλητή. Ζητήστε από τη γραμματεία να συνδέσει τον
            λογαριασμό σας με καρτέλα αθλητή.
          </p>
        </section>
      ) : (
        <>
          <section className="panel parent-portal-section">
            <h2>
              <CreditCard size={18} /> Υπόλοιπο συνδρομής
            </h2>
            {payError ? <p className="form-error">{payError}</p> : null}
            <p>
              <strong className={balance > 0 ? 'badge badge-overdue' : 'badge badge-paid'}>
                {formatCurrency(balance)}
              </strong>
              {className ? <span className="muted"> · {className}</span> : null}
            </p>
            {balance > 0 && viva?.enabled ? (
              <Button type="button" disabled={paying} onClick={() => void handlePay()}>
                {paying ? 'Μετάβαση…' : 'Πληρωμή Viva'}
              </Button>
            ) : null}
          </section>

          <section className="panel parent-portal-section">
            <h2>
              <CalendarDays size={18} /> Επόμενες προπονήσεις
            </h2>
            {upcoming.length === 0 ? (
              <p className="muted">Δεν υπάρχουν προγραμματισμένες προπονήσεις.</p>
            ) : (
              <ul className="parent-portal-list">
                {upcoming.map((t) => (
                  <li key={t.id}>
                    <strong>
                      {formatDate(t.date)} · {t.startTime}
                      {t.endTime ? `–${t.endTime}` : ''}
                    </strong>
                    <span className="muted">{t.location || t.notes || 'Προπόνηση'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel parent-portal-section">
            <h2>
              <ClipboardCheck size={18} /> Παρουσίες
            </h2>
            {attendance.length === 0 ? (
              <p className="muted">Δεν υπάρχουν καταχωρήσεις.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ημ/νία</th>
                      <th>Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.date)}</td>
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
      )}
    </div>
  );
}
