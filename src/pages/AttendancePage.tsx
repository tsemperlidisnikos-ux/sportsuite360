import { useMemo, useState } from 'react';
import { upsertAttendance } from '../api/services/attendanceService';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useAppData } from '../hooks/useAppData';

export function AttendancePage() {
  const { data, refresh } = useAppData();
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const students = useMemo(
    () => data.students.filter((s) => s.classId === classId && s.status !== 'inactive'),
    [data.students, classId],
  );

  async function togglePresent(studentId: string, present: boolean) {
    await upsertAttendance({ classId, studentId, date, present });
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Παρουσίες"
        subtitle="Καταγραφή παρουσίας ανά τμήμα και ημερομηνία."
      />

      <div className="toolbar filters">
        <Select
          label="Τμήμα"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          options={data.classes.map((c) => ({ value: c.id, label: c.name }))}
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

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αθλητής</th>
              <th>Κατάσταση</th>
              <th>Παρουσία</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const record = data.attendance.find(
                (a) =>
                  a.classId === classId &&
                  a.studentId === student.id &&
                  a.date === date,
              );
              const present = record?.present ?? false;
              return (
                <tr key={student.id}>
                  <td>
                    <strong>
                      {student.firstName} {student.lastName}
                    </strong>
                  </td>
                  <td>{record ? (present ? 'Παρών' : 'Απών') : 'Μη καταχωρημένο'}</td>
                  <td>
                    <div className="toggle-group">
                      <button
                        type="button"
                        className={`chip ${present && record ? 'chip-on' : ''}`}
                        onClick={() => void togglePresent(student.id, true)}
                      >
                        Παρών
                      </button>
                      <button
                        type="button"
                        className={`chip ${record && !present ? 'chip-off' : ''}`}
                        onClick={() => void togglePresent(student.id, false)}
                      >
                        Απών
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Δεν υπάρχουν αθλητές σε αυτό το τμήμα.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
