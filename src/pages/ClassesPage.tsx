import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import * as classesService from '../api/services/classesService';
import { getSession } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { ClassInput } from '../schemas';
import type { AcademyClass } from '../types';
import {
  resolveCoachRecord,
  visibleClassesForSession,
} from '../utils/coachScope';
import { formatDate } from '../utils/labels';
import { normalizeSportKey } from '../utils/sport';

const emptyForm: ClassInput = {
  name: '',
  sport: '',
  ageGroup: '',
  coachId: null,
  maxStudents: 18,
  scheduleSummary: '',
  monthlyFee: 55,
  startDate: '',
  endDate: '',
};

export function ClassesPage() {
  const { data, refresh } = useAppData();
  const session = getSession();
  const isCoach = session?.role === 'coach';
  const coach = useMemo(
    () => resolveCoachRecord(data.coaches, session?.coachId),
    [data.coaches, session?.coachId],
  );
  const visibleClasses = useMemo(
    () => visibleClassesForSession(data.classes, data.coaches, session),
    [data.classes, data.coaches, session],
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyClass | null>(null);
  const [form, setForm] = useState<ClassInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const sportOptions = useMemo(() => {
    const activeSports = (data.sports ?? []).filter((s) => s.active);
    if (isCoach && coach?.sport) {
      const key = normalizeSportKey(coach.sport);
      const matched = activeSports.filter((s) => normalizeSportKey(s.name) === key);
      const options = matched.length > 0 ? matched : [{ id: 'coach-sport', name: coach.sport, active: true }];
      return options.map((s) => ({ value: s.name, label: s.name }));
    }
    return [
      { value: '', label: '—' },
      ...activeSports.map((s) => ({ value: s.name, label: s.name })),
    ];
  }, [data.sports, isCoach, coach]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      sport: isCoach && coach?.sport ? coach.sport : '',
    });
    setError('');
    setOpen(true);
  }

  function openEdit(cls: AcademyClass) {
    setEditing(cls);
    setForm({
      name: cls.name,
      sport: cls.sport,
      ageGroup: cls.ageGroup,
      coachId: null,
      maxStudents: cls.maxStudents,
      scheduleSummary: cls.scheduleSummary,
      monthlyFee: cls.monthlyFee,
      startDate: cls.startDate ?? '',
      endDate: cls.endDate ?? '',
    });
    setError('');
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const sport =
      isCoach && coach?.sport
        ? coach.sport
        : form.sport;
    const payload: ClassInput = {
      ...form,
      sport,
      coachId: null,
      scheduleSummary:
        form.scheduleSummary ||
        (form.startDate || form.endDate
          ? `${form.startDate || '…'} → ${form.endDate || '…'}`
          : 'Χωρίς πρόγραμμα'),
    };
    const result = editing
      ? await classesService.updateClass(editing.id, payload)
      : await classesService.createClass(payload);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα');
      return;
    }
    closeModal();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή τμήματος;')) return;
    await classesService.deleteClass(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Τμήματα"
        subtitle="Ομάδες προπόνησης, κατηγορίες και περίοδος ενεργοποίησης."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Νέο τμήμα
          </Button>
        }
      />

      <section className="panel table-wrap">
        {visibleClasses.length === 0 ? (
          <div className="empty-state">
            <h3>Δεν υπάρχουν τμήματα</h3>
            <p>Πάτα «Νέο τμήμα» για να προσθέσεις το πρώτο.</p>
            <Button type="button" onClick={openCreate}>
              <Plus size={16} /> Νέο τμήμα
            </Button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Όνομα</th>
                <th>Άθλημα</th>
                <th>Κατηγορία</th>
                <th>Αθλητές</th>
                <th>Ενεργό</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleClasses.map((cls) => {
                const count = data.students.filter((s) => s.classId === cls.id).length;
                return (
                  <tr key={cls.id}>
                    <td>
                      <strong>{cls.name}</strong>
                    </td>
                    <td>{cls.sport || '—'}</td>
                    <td>{cls.ageGroup || '—'}</td>
                    <td>
                      {count}
                    </td>
                    <td>
                      {cls.startDate || cls.endDate
                        ? `${cls.startDate ? formatDate(cls.startDate) : '…'} → ${cls.endDate ? formatDate(cls.endDate) : '…'}`
                        : 'Πάντα ενεργό'}
                    </td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => openEdit(cls)}
                        aria-label="Επεξεργασία"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleDelete(cls.id)}
                        aria-label="Διαγραφή"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {open ? (
        <div className="training-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="training-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="class-modal-title">
              {editing ? 'Επεξεργασία τμήματος' : 'Νέο τμήμα'}
            </h2>

            <div className="training-modal-fields">
              <label>
                <span>Όνομα τμήματος</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                <span>Κατηγορία</span>
                <input
                  type="text"
                  placeholder="Κατηγορία (π.χ. U16)"
                  value={form.ageGroup ?? ''}
                  onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                />
              </label>
              <label>
                <span>Άθλημα</span>
                <select
                  value={form.sport ?? ''}
                  disabled={isCoach}
                  onChange={(e) => setForm({ ...form, sport: e.target.value })}
                >
                  {sportOptions.map((opt) => (
                    <option key={opt.value || 'empty'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ημερομηνία έναρξης</span>
                <input
                  type="date"
                  value={form.startDate ?? ''}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </label>
              <label>
                <span>Ημερομηνία λήξης</span>
                <input
                  type="date"
                  value={form.endDate ?? ''}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </label>

              <p className="class-modal-hint">
                Ορίστε από πότε έως πότε είναι ενεργό το τμήμα. Αν αφήσεις κενές τις ημερομηνίες,
                θεωρείται πάντα ενεργό.
              </p>

              {error ? <p className="form-error">{error}</p> : null}
            </div>

            <div className="training-modal-actions">
              <button
                type="button"
                className="training-btn-save"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
              <button type="button" className="training-btn-cancel" onClick={closeModal}>
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
