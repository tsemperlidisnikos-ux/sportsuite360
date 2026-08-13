import { useMemo, useState } from 'react';
import { Bell, CalendarDays, ClipboardCheck, Users } from 'lucide-react';
import { upsertAttendance } from '../api/services/attendanceService';
import { getSession } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useAppData } from '../hooks/useAppData';
import { formatDate } from '../utils/labels';
import { localDateIso } from '../utils/dates';

export function CoachPortalPage() {
  const { data, refresh } = useAppData();
  const session = getSession();
  const [date, setDate] = useState(() => localDateIso());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const coach = useMemo(() => {
    if (!session?.coachId) return null;
    return (data.coaches ?? []).find((c) => c.id === session.coachId && c.active) ?? null;
  }, [data.coaches, session?.coachId]);

  const classIds = useMemo(() => {
    if (!coach) return new Set<string>();
    return new Set(
      (data.classes ?? []).filter((c) => c.coachId === coach.id).map((c) => c.id),
    );
  }, [data.classes, coach]);

  const linkMissing = Boolean(session && !session.coachId);
  const linkBroken = Boolean(session?.coachId && !coach);

  const myClasses = useMemo(
    () => (data.classes ?? []).filter((c) => classIds.has(c.id)),
    [data.classes, classIds],
  );

  const [classId, setClassId] = useState('');
  const activeClassId = classId && classIds.has(classId) ? classId : myClasses[0]?.id ?? '';

  const today = localDateIso();
  const upcoming = useMemo(
    () =>
      (data.trainings ?? [])
        .filter((t) => t.date >= today && t.classId && classIds.has(t.classId))
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        .slice(0, 10),
    [data.trainings, classIds, today],
  );

  const roster = useMemo(
    () =>
      (data.students ?? []).filter(
        (s) => s.classId === activeClassId && s.status !== 'inactive',
      ),
    [data.students, activeClassId],
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

  async function togglePresent(studentId: string, present: boolean) {
    if (!activeClassId) return;
    setNotice('');
    setSavingId(studentId);
    const result = await upsertAttendance({
      classId: activeClassId,
      studentId,
      date,
      present,
    });
    setSavingId(null);
    if (!result.success) {
      setNotice(result.error ?? 'Αποτυχία αποθήκευσης παρουσίας');
      return;
    }
    refresh();
  }

  return (
    <div className="stack-lg parent-portal">
      <PageHeader
        title="Περιοχή προπονητή"
        subtitle={`Καλώς ήρθατε, ${session?.fullName ?? 'προπονητή'}.${
          coach ? ` Προφίλ: ${coach.lastName} ${coach.firstName}.` : ''
        }`}
      />

      {linkMissing ? (
        <section className="panel">
          <p className="form-error">
            Ο λογαριασμός δεν είναι συνδεδεμένος με καρτέλα προπονητή. Ζητήστε από τον
            διαχειριστή (Ρυθμίσεις → Χρήστες) να ορίσει «Σύνδεση με προπονητή».
          </p>
        </section>
      ) : null}

      {linkBroken ? (
        <section className="panel">
          <p className="form-error">
            Η σύνδεση προπονητή δεν είναι έγκυρη (η καρτέλα δεν βρέθηκε ή είναι ανενεργή).
          </p>
        </section>
      ) : null}

      {!linkMissing && !linkBroken ? (
        <>
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
              <ClipboardCheck size={18} /> Καταγραφή παρουσίας
            </h2>
            {myClasses.length === 0 ? (
              <p className="muted">Χρειάζεται τουλάχιστον ένα τμήμα για καταγραφή.</p>
            ) : (
              <>
                <div className="toolbar filters" style={{ marginBottom: '0.85rem' }}>
                  <Select
                    label="Τμήμα"
                    value={activeClassId}
                    onChange={(e) => setClassId(e.target.value)}
                    options={myClasses.map((c) => ({ value: c.id, label: c.name }))}
                  />
                  <label className="field">
                    <span className="field-label">Ημερομηνία</span>
                    <input
                      className="field-input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                </div>
                {notice ? <p className="form-error">{notice}</p> : null}
                {roster.length === 0 ? (
                  <p className="muted">Δεν υπάρχουν ενεργοί αθλητές στο τμήμα.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Αθλητής</th>
                          <th>Κατάσταση</th>
                          <th>Ενέργεια</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((student) => {
                          const record = (data.attendance ?? []).find(
                            (a) =>
                              a.classId === activeClassId &&
                              a.studentId === student.id &&
                              a.date === date,
                          );
                          const present = record?.present ?? false;
                          const busy = savingId === student.id;
                          return (
                            <tr key={student.id}>
                              <td>
                                {student.lastName} {student.firstName}
                              </td>
                              <td>{record ? (present ? 'Παρών/ούσα' : 'Απών/ούσα') : '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <Button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void togglePresent(student.id, true)}
                                  >
                                    Παρών
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => void togglePresent(student.id, false)}
                                  >
                                    Απών
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
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
        </>
      ) : null}
    </div>
  );
}
