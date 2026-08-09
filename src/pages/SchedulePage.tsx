import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import * as scheduleService from '../api/services/scheduleService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useAppData } from '../hooks/useAppData';
import type { ScheduleSlotInput } from '../schemas';
import { dayNames } from '../utils/labels';

const emptyForm: ScheduleSlotInput = {
  classId: '',
  dayOfWeek: 1,
  startTime: '17:00',
  endTime: '18:30',
  location: 'Γήπεδο Α',
};

export function SchedulePage() {
  const { data, refresh } = useAppData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ScheduleSlotInput>({
    ...emptyForm,
    classId: data.classes[0]?.id ?? '',
  });
  const [error, setError] = useState('');

  const byDay = useMemo(() => {
    return dayNames.map((name, dayOfWeek) => ({
      name,
      dayOfWeek,
      slots: data.schedule
        .filter((s) => s.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  }, [data.schedule]);

  async function handleSave() {
    setError('');
    const result = await scheduleService.createScheduleSlot(form);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα');
      return;
    }
    setOpen(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή ώρας;')) return;
    await scheduleService.deleteScheduleSlot(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Εβδομαδιαίο πρόγραμμα"
        subtitle="Ωρολόγιο πρόγραμμα τμημάτων και χώρων."
        actions={
          <Button
            type="button"
            onClick={() => {
              setForm({ ...emptyForm, classId: data.classes[0]?.id ?? '' });
              setError('');
              setOpen(true);
            }}
          >
            <Plus size={16} /> Νέα ώρα
          </Button>
        }
      />

      <div className="schedule-grid">
        {byDay.map((day) => (
          <section key={day.dayOfWeek} className="schedule-day">
            <h3>{day.name}</h3>
            {day.slots.length === 0 ? (
              <p className="muted">Καμία προπόνηση</p>
            ) : (
              <ul>
                {day.slots.map((slot) => {
                  const cls = data.classes.find((c) => c.id === slot.classId);
                  return (
                    <li key={slot.id} className="schedule-slot">
                      <div>
                        <strong>{cls?.name ?? 'Τμήμα'}</strong>
                        <span>
                          {slot.startTime}–{slot.endTime}
                        </span>
                        <span className="muted">{slot.location}</span>
                      </div>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => void handleDelete(slot.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      <Modal
        open={open}
        title="Νέα ώρα προγράμματος"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Ακύρωση
            </Button>
            <Button type="button" onClick={() => void handleSave()}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Select
            label="Τμήμα"
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            options={data.classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Ημέρα"
            value={String(form.dayOfWeek)}
            onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
            options={dayNames.map((label, value) => ({
              value: String(value),
              label,
            }))}
          />
          <Input
            label="Έναρξη"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <Input
            label="Λήξη"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
          <Input
            label="Χώρος"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </Modal>
    </div>
  );
}
