import { useMemo } from 'react';
import { Bell, CalendarDays, ClipboardCheck, Users } from 'lucide-react';
import { getSession } from '../auth/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { formatDate } from '../utils/labels';
import { localDateIso } from '../utils/dates';

export function CoachPortalPage() {
  const { data } = useAppData();
  const session = getSession();

  const coach = useMemo(() => {
    const email = session?.email?.toLowerCase() ?? '';
    return (data.coaches ?? []).find((c) => c.email.toLowerCase() === email && c.active) ?? null;
  }, [data.coaches, session?.email]);

  const classIds = useMemo(() => {
    if (!coach) return new Set<string>();
    return new Set(
      (data.classes ?? []).filter((c) => c.coachId === coach.id).map((c) => c.id),
    );
  }, [data.classes, coach]);

  const myClasses = useMemo(
    () => (data.classes ?? []).filter((c) => classIds.has(c.id)),
    [data.classes, classIds],
  );

  const today = localDateIso();
  const upcoming = useMemo(
    () =>
      (data.trainings ?? [])
        .filter((t) => t.date >= today && t.classId && classIds.has(t.classId))
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        .slice(0, 10),
    [data.trainings, classIds, today],
  );

  const athleteIds = useMemo(() => {
    return new Set(
      (data.students ?? [])
        .filter((s) => s.classId && classIds.has(s.classId) && s.status !== 'inactive')
        .map((s) => s.id),
    );
  }, [data.students, classIds]);

  const recentAttendance = useMemo(
    () =>
      (data.attendance ?? [])
        .filter((a) => athleteIds.has(a.studentId))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12),
    [data.attendance, athleteIds],
  );

  const announcements = useMemo(
    () =>
      (data.announcements ?? [])
        .filter((a) => {
          const roles = a.audienceRoles ?? [];
          if (roles.length === 0) return true;
          return roles.includes('coaches') || roles.includes('staff');
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 6),
    [data.announcements],
  );

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of data.classes ?? []) map.set(cls.id, cls.name);
    return map;
  }, [data.classes]);

  const athleteNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data.students ?? []) {
      map.set(s.id, `${s.lastName} ${s.firstName}`.trim());
    }
    return map;
  }, [data.students]);

  return (
    <div className="stack-lg parent-portal">
      <PageHeader
        title="Περιοχή προπονητή"
        subtitle={`Καλώς ήρθατε, ${session?.fullName ?? 'προπονητή'}.${
          coach ? ` Προφίλ: ${coach.lastName} ${coach.firstName}.` : ''
        }`}
      />

      <section className="panel parent-portal-section">
        <h2>
          <Users size={18} /> Τμήματα
        </h2>
        {myClasses.length === 0 ? (
          <p className="muted">Δεν βρέθηκαν τμήματα συνδεδεμένα με τον λογαριασμό σας.</p>
        ) : (
          <ul className="parent-portal-list">
            {myClasses.map((cls) => (
              <li key={cls.id}>
                <strong>{cls.name}</strong>
                <span className="muted">
                  {cls.sport || '—'} · {cls.ageGroup || '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel parent-portal-section">
        <h2>
          <CalendarDays size={18} /> Επόμενες προπονήσεις
        </h2>
        {upcoming.length === 0 ? (
          <p className="muted">Δεν υπάρχουν προσεχείς προπονήσεις.</p>
        ) : (
          <ul className="parent-portal-list">
            {upcoming.map((t) => (
              <li key={t.id}>
                <strong>
                  {formatDate(t.date)} · {t.startTime}
                  {t.endTime ? `–${t.endTime}` : ''}
                </strong>
                <span className="muted">
                  {(t.classId && classNameById.get(t.classId)) || t.notes || 'Προπόνηση'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel parent-portal-section">
        <h2>
          <ClipboardCheck size={18} /> Πρόσφατες παρουσίες
        </h2>
        {recentAttendance.length === 0 ? (
          <p className="muted">Δεν υπάρχουν καταχωρήσεις.</p>
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
    </div>
  );
}
