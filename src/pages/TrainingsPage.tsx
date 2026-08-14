import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import * as trainingsService from '../api/services/trainingsService';
import { getSession } from '../auth/auth';
import { TrainingsIcon } from '../components/icons/TrainingsIcon';
import { useAppData } from '../hooks/useAppData';
import type { TrainingInput } from '../schemas';
import type { Training } from '../types';
import {
  classIdsOf,
  isClassInCoachScope,
  visibleClassesForSession,
} from '../utils/coachScope';
import { formatDate } from '../utils/labels';

const emptyForm: TrainingInput = {
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
  classId: null,
};

const emptyRecurring = {
  weekday: 1,
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
  classId: null as string | null,
};

const weekdays = [
  { value: 1, label: 'Δευτέρα' },
  { value: 2, label: 'Τρίτη' },
  { value: 3, label: 'Τετάρτη' },
  { value: 4, label: 'Πέμπτη' },
  { value: 5, label: 'Παρασκευή' },
  { value: 6, label: 'Σάββατο' },
  { value: 0, label: 'Κυριακή' },
];

export function TrainingsPage() {
  const { data, refresh } = useAppData();
  const session = getSession();
  const isCoach = session?.role === 'coach';
  const visibleClasses = useMemo(
    () => visibleClassesForSession(data.classes, data.coaches, session),
    [data.classes, data.coaches, session],
  );
  const allowedClassIds = useMemo(() => classIdsOf(visibleClasses), [visibleClasses]);
  const [showAdd, setShowAdd] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);
  const [form, setForm] = useState<TrainingInput>(emptyForm);
  const [recForm, setRecForm] = useState(emptyRecurring);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState('');

  const trainings = useMemo(
    () =>
      [...(data.trainings ?? [])]
        .filter((t) => isClassInCoachScope(t.classId, allowedClassIds, isCoach))
        .sort((a, b) => {
          const byDate = b.date.localeCompare(a.date);
          if (byDate !== 0) return byDate;
          return b.startTime.localeCompare(a.startTime);
        }),
    [data.trainings, allowedClassIds, isCoach],
  );

  const allSelected =
    trainings.length > 0 && trainings.every((t) => selectedIds.has(t.id));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowAdd(true);
  }

  function openEdit(training: Training) {
    setEditing(training);
    setForm({
      date: training.date,
      startTime: training.startTime,
      endTime: training.endTime,
      location: training.location,
      notes: training.notes,
      classId: training.classId,
    });
    setError('');
    setShowAdd(true);
  }

  function openRecurring() {
    setRecForm(emptyRecurring);
    setError('');
    setShowRecurring(true);
  }

  function closeModals() {
    setShowAdd(false);
    setShowRecurring(false);
    setEditing(null);
    setError('');
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(trainings.map((t) => t.id)));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = editing
      ? await trainingsService.updateTraining(editing.id, form)
      : await trainingsService.createTraining(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    closeModals();
    refresh();
  }

  async function handleSaveRecurring() {
    setSaving(true);
    setError('');
    const result = await trainingsService.createRecurringTrainings({
      weekday: recForm.weekday,
      startDate: recForm.startDate,
      endDate: recForm.endDate,
      startTime: recForm.startTime,
      endTime: recForm.endTime,
      location: recForm.location,
      notes: recForm.notes,
      classId: recForm.classId,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    closeModals();
    refresh();
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Διαγραφή ${selectedIds.size} προπονήσεων;`)) return;
    setBulkDeleting(true);
    await trainingsService.bulkDeleteTrainings([...selectedIds]);
    setBulkDeleting(false);
    setSelectedIds(new Set());
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή προπόνησης;')) return;
    await trainingsService.deleteTraining(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refresh();
  }

  return (
    <div className="stack-lg trainings-page">
      <header className="page-header">
        <div>
          <h1>Προπονήσεις</h1>
          <p>Καταχώρηση και διαχείριση προπονήσεων της ακαδημίας.</p>
        </div>
        <div className="trainings-actions">
          <button type="button" className="trn-btn trn-btn-secondary" onClick={openRecurring}>
            Επαναλαμβανόμενες προπονήσεις
          </button>
          <button
            type="button"
            className="trn-btn trn-btn-danger"
            disabled={selectedIds.size === 0 || bulkDeleting}
            onClick={() => void handleBulkDelete()}
          >
            {bulkDeleting ? 'Διαγραφή...' : 'Μαζική διαγραφή'}
          </button>
          <button type="button" className="trn-btn trn-btn-primary" onClick={openCreate}>
            <Plus size={16} /> Νέα προπόνηση
          </button>
        </div>
      </header>

      <section className="panel table-wrap">
        {trainings.length === 0 ? (
          <div className="empty-state">
            <TrainingsIcon size={28} />
            <h3>Δεν υπάρχουν προπονήσεις</h3>
            <p>Πάτα «+ Νέα προπόνηση» για να προσθέσεις την πρώτη.</p>
            <button type="button" className="trn-btn trn-btn-primary" onClick={openCreate}>
              <Plus size={16} /> Νέα προπόνηση
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="table-check-col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Επιλογή όλων"
                  />
                </th>
                <th>Ημερομηνία</th>
                <th>Έναρξη</th>
                <th>Λήξη</th>
                <th>Τοποθεσία</th>
                <th>Άθλημα</th>
                <th>Τμήμα</th>
                <th>Σημειώσεις</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trainings.map((training) => {
                const cls = data.classes.find((c) => c.id === training.classId);
                return (
                  <tr
                    key={training.id}
                    className={selectedIds.has(training.id) ? 'is-selected' : ''}
                  >
                    <td className="table-check-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(training.id)}
                        onChange={() => toggleRow(training.id)}
                        aria-label="Επιλογή γραμμής"
                      />
                    </td>
                    <td>{formatDate(training.date)}</td>
                    <td>{training.startTime}</td>
                    <td>{training.endTime}</td>
                    <td>{training.location || '—'}</td>
                    <td>{cls?.sport || '—'}</td>
                    <td>{cls?.name ?? '—'}</td>
                    <td>{training.notes || '—'}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => openEdit(training)}
                        aria-label="Επεξεργασία"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleDelete(training.id)}
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

      {showAdd ? (
        <div className="training-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="training-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="training-modal-title">
              {editing ? 'Επεξεργασία προπόνησης' : 'Νέα προπόνηση'}
            </h2>
            <div className="training-modal-fields">
              <label>
                <span>Ημερομηνία</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label>
                <span>Ώρα έναρξης</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </label>
              <label>
                <span>Ώρα λήξης</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </label>
              <label>
                <span>Τοποθεσία</span>
                <input
                  type="text"
                  value={form.location ?? ''}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>
              <label>
                <span>Τμήμα</span>
                <select
                  value={form.classId ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, classId: e.target.value ? e.target.value : null })
                  }
                >
                  <option value="">—</option>
                  {visibleClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Σημειώσεις</span>
                <textarea
                  rows={4}
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
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
              <button type="button" className="training-btn-cancel" onClick={closeModals}>
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRecurring ? (
        <div className="training-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="training-modal training-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="recurring-modal-title">Επαναλαμβανόμενες προπονήσεις</h2>
            <div className="training-modal-fields">
              <label>
                <span>Τμήμα</span>
                <select
                  value={recForm.classId ?? ''}
                  onChange={(e) =>
                    setRecForm({
                      ...recForm,
                      classId: e.target.value ? e.target.value : null,
                    })
                  }
                >
                  <option value="">—</option>
                  {visibleClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ημέρα εβδομάδας</span>
                <select
                  value={recForm.weekday}
                  onChange={(e) =>
                    setRecForm({ ...recForm, weekday: Number(e.target.value) })
                  }
                >
                  {weekdays.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ημ. έναρξης</span>
                <input
                  type="date"
                  value={recForm.startDate}
                  onChange={(e) => setRecForm({ ...recForm, startDate: e.target.value })}
                />
              </label>
              <label>
                <span>Ημ. λήξης</span>
                <input
                  type="date"
                  value={recForm.endDate}
                  min={recForm.startDate || undefined}
                  onChange={(e) => setRecForm({ ...recForm, endDate: e.target.value })}
                />
              </label>
              <label>
                <span>Ώρα έναρξης</span>
                <input
                  type="time"
                  value={recForm.startTime}
                  onChange={(e) => setRecForm({ ...recForm, startTime: e.target.value })}
                />
              </label>
              <label>
                <span>Ώρα λήξης</span>
                <input
                  type="time"
                  value={recForm.endTime}
                  onChange={(e) => setRecForm({ ...recForm, endTime: e.target.value })}
                />
              </label>
              <label>
                <span>Τοποθεσία</span>
                <input
                  type="text"
                  value={recForm.location}
                  onChange={(e) => setRecForm({ ...recForm, location: e.target.value })}
                />
              </label>
              <label>
                <span>Σημειώσεις</span>
                <textarea
                  rows={3}
                  value={recForm.notes}
                  onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })}
                />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
            </div>
            <div className="training-modal-actions">
              <button
                type="button"
                className="training-btn-save"
                disabled={saving}
                onClick={() => void handleSaveRecurring()}
              >
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
              <button type="button" className="training-btn-cancel" onClick={closeModals}>
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
