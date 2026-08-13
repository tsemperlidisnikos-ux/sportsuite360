import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Pencil, Plus } from 'lucide-react';
import * as scheduleService from '../api/services/scheduleService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { useAppData } from '../hooks/useAppData';
import type { ScheduleSlotInput } from '../schemas';
import type { ScheduleSlot } from '../types';
import { localDateIso } from '../utils/dates';
import { dayNames } from '../utils/labels';

const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const PX_PER_HOUR = 56;

/** Monday-first weekday labels (Δευτέρα … Κυριακή). */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const emptyForm: ScheduleSlotInput = {
  classId: '',
  dayOfWeek: 1,
  startTime: '17:00',
  endTime: '18:30',
  location: 'Γήπεδο 1',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayHeader(date: Date): string {
  const name = dayNames[date.getDay()].toUpperCase();
  return `${name} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const month = sunday.toLocaleDateString('el-GR', { month: 'long' });
  const year = sunday.getFullYear();
  if (sameMonth) {
    return `${monday.getDate()} – ${sunday.getDate()} ${month} ${year}`;
  }
  const monthStart = monday.toLocaleDateString('el-GR', { month: 'long' });
  return `${monday.getDate()} ${monthStart} – ${sunday.getDate()} ${month} ${year}`;
}

type GridBlock = {
  id: string;
  kind: 'training' | 'match';
  dayIndex: number;
  startMin: number;
  endMin: number;
  title: string;
  location: string;
  slot?: ScheduleSlot;
};

export function SchedulePage() {
  const { data, refresh } = useAppData();
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '');
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleSlotInput>({
    ...emptyForm,
    classId: data.classes[0]?.id ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(
    () => WEEKDAY_ORDER.map((dow, index) => {
      const date = addDays(weekStart, index);
      return { dow, date, iso: localDateIso(date), label: formatDayHeader(date) };
    }),
    [weekStart],
  );

  const blocks = useMemo(() => {
    const result: GridBlock[] = [];
    const selectedClass = classId || null;

    for (const slot of data.schedule) {
      if (selectedClass && slot.classId !== selectedClass) continue;
      const dayIndex = WEEKDAY_ORDER.indexOf(slot.dayOfWeek as (typeof WEEKDAY_ORDER)[number]);
      if (dayIndex < 0) continue;
      const cls = data.classes.find((c) => c.id === slot.classId);
      result.push({
        id: slot.id,
        kind: 'training',
        dayIndex,
        startMin: parseTimeToMinutes(slot.startTime),
        endMin: parseTimeToMinutes(slot.endTime),
        title: cls?.name ? `Προπόνηση · ${cls.name}` : 'Προπόνηση',
        location: slot.location,
        slot,
      });
    }

    for (const match of data.matches ?? []) {
      if (match.status === 'cancelled') continue;
      if (selectedClass && match.classId && match.classId !== selectedClass) continue;
      const iso = match.date?.slice(0, 10);
      const dayIndex = weekDays.findIndex((d) => d.iso === iso);
      if (dayIndex < 0) continue;
      const startMin = parseTimeToMinutes(match.time || '12:00');
      const endMin = startMin + 90;
      result.push({
        id: match.id,
        kind: 'match',
        dayIndex,
        startMin,
        endMin,
        title: `Αγώνας vs ${match.opponent}`,
        location: match.location || (match.venue === 'home' ? 'Εντός' : match.venue === 'away' ? 'Εκτός' : ''),
      });
    }

    return result;
  }, [data.schedule, data.matches, data.classes, classId, weekDays]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      classId: classId || data.classes[0]?.id || '',
      dayOfWeek: 1,
    });
    setError('');
    setOpen(true);
  }

  function openEdit(slot: ScheduleSlot) {
    setEditingId(slot.id);
    setForm({
      classId: slot.classId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: slot.location,
    });
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = editingId
      ? await scheduleService.updateScheduleSlot(editingId, form)
      : await scheduleService.createScheduleSlot(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    if (!editingId && form.classId) setClassId(form.classId);
    setOpen(false);
    refresh();
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm('Διαγραφή ώρας από το πρόγραμμα;')) return;
    await scheduleService.deleteScheduleSlot(editingId);
    setOpen(false);
    refresh();
  }

  function shiftWeek(delta: number) {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }

  function goToday() {
    setWeekStart(startOfWeekMonday(new Date()));
  }

  const gridHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR;
  const dayStartMin = HOUR_START * 60;

  return (
    <div className="prog-page">
      <div className="prog-toolbar panel">
        <label className="prog-field">
          <span>Επιλογή Τάξης</span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Όλες οι τάξεις</option>
            {data.classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
                {cls.ageGroup ? ` · ${cls.ageGroup}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="prog-field prog-week-field">
          <span>Εβδομάδα</span>
          <div className="prog-week-nav">
            <button type="button" onClick={() => shiftWeek(-1)} aria-label="Προηγούμενη εβδομάδα">
              <ChevronLeft size={16} />
            </button>
            <strong>{formatWeekRange(weekStart)}</strong>
            <button type="button" onClick={() => shiftWeek(1)} aria-label="Επόμενη εβδομάδα">
              <ChevronRight size={16} />
            </button>
          </div>
        </label>

        <div className="prog-toolbar-actions">
          <button type="button" className="prog-today-btn" onClick={goToday}>
            Σήμερα
          </button>
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Νέα Ώρα
          </Button>
        </div>
      </div>

      <section className="prog-board panel">
        <div className="prog-grid-head">
          <div className="prog-time-gutter" aria-hidden />
          {weekDays.map((day) => (
            <div key={day.iso} className="prog-day-head">
              {day.label}
            </div>
          ))}
        </div>

        <div className="prog-grid-body">
          <div className="prog-time-col" style={{ height: gridHeight }}>
            {HOURS.map((hour) => (
              <div key={hour} className="prog-hour-label" style={{ height: PX_PER_HOUR }}>
                {pad(hour)}:00
              </div>
            ))}
          </div>

          <div className="prog-days" style={{ height: gridHeight }}>
            {weekDays.map((day, dayIndex) => (
              <div key={day.iso} className="prog-day-col">
                {HOURS.map((hour) => (
                  <div key={hour} className="prog-hour-line" style={{ height: PX_PER_HOUR }} />
                ))}
                {blocks
                  .filter((b) => b.dayIndex === dayIndex)
                  .map((block) => {
                    const top = ((block.startMin - dayStartMin) / 60) * PX_PER_HOUR;
                    const height = Math.max(
                      36,
                      ((block.endMin - block.startMin) / 60) * PX_PER_HOUR - 4,
                    );
                    const startLabel = `${pad(Math.floor(block.startMin / 60))}:${pad(block.startMin % 60)}`;
                    const endLabel = `${pad(Math.floor(block.endMin / 60))}:${pad(block.endMin % 60)}`;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        className={`prog-block is-${block.kind}`}
                        style={{ top, height }}
                        onClick={() => {
                          if (block.slot) openEdit(block.slot);
                        }}
                        title={`${startLabel} – ${endLabel} · ${block.title}`}
                      >
                        <span className="prog-block-time">
                          {startLabel} - {endLabel}
                        </span>
                        <strong className="prog-block-title">{block.title}</strong>
                        {block.location ? (
                          <span className="prog-block-loc">{block.location}</span>
                        ) : null}
                        {block.slot ? (
                          <span className="prog-block-edit" aria-hidden>
                            <Pencil size={12} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="prog-footer">
        <ul className="prog-legend">
          <li>
            <i className="is-training" /> Προπόνηση
          </li>
          <li>
            <i className="is-match" /> Αγώνας
          </li>
        </ul>
        <p className="prog-hint">
          <Info size={15} aria-hidden /> Κάντε κλικ σε ένα μπλοκ για επεξεργασία
        </p>
      </div>

      <Modal
        open={open}
        title={editingId ? 'Επεξεργασία ώρας' : 'Νέα ώρα προγράμματος'}
        onClose={() => setOpen(false)}
        footer={
          <>
            {editingId ? (
              <Button variant="danger" type="button" onClick={() => void handleDelete()}>
                Διαγραφή
              </Button>
            ) : null}
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Ακύρωση
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
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
