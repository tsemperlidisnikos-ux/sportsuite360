import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { localDateIso } from '../utils/dates';
import { dayNames } from '../utils/labels';

const MONTH_LABELS = [
  'Ιανουάριος',
  'Φεβρουάριος',
  'Μάρτιος',
  'Απρίλιος',
  'Μάιος',
  'Ιούνιος',
  'Ιούλιος',
  'Αύγουστος',
  'Σεπτέμβριος',
  'Οκτώβριος',
  'Νοέμβριος',
  'Δεκέμβριος',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Monday-first weekday: Mon=0 … Sun=6 */
function mondayFirstWeekday(year: number, monthIndex: number, day: number): number {
  const js = new Date(year, monthIndex, day).getDay(); // Sun=0
  return (js + 6) % 7;
}

export function CalendarPage() {
  const { data } = useAppData();
  const today = localDateIso();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());

  const classById = useMemo(
    () => new Map(data.classes.map((cls) => [cls.id, cls])),
    [data.classes],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string; time: string }>>();
    for (const training of data.trainings ?? []) {
      const date = training.date?.slice(0, 10);
      if (!date) continue;
      const cls = training.classId ? classById.get(training.classId) : undefined;
      const title = cls?.name || training.location || 'Προπόνηση';
      const time = `${training.startTime}${training.endTime ? `–${training.endTime}` : ''}`;
      const list = map.get(date) ?? [];
      list.push({ id: training.id, title, time });
      map.set(date, list);
    }
    return map;
  }, [data.trainings, classById]);

  const cells = useMemo(() => {
    const totalDays = daysInMonth(year, monthIndex);
    const offset = mondayFirstWeekday(year, monthIndex, 1);
    const result: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < offset; i += 1) result.push({ day: null, iso: null });
    for (let day = 1; day <= totalDays; day += 1) {
      result.push({
        day,
        iso: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
      });
    }
    while (result.length % 7 !== 0) result.push({ day: null, iso: null });
    return result;
  }, [year, monthIndex]);

  function shiftMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  }

  const weekdayHeaders = [...dayNames.slice(1), dayNames[0]]; // Δευ–Κυρ

  return (
    <div className="stack-lg">
      <PageHeader
        title="Ημερολόγιο"
        subtitle="Μηνιαία επισκόπηση προπονήσεων και δραστηριοτήτων."
        actions={
          <div className="calendar-nav">
            <Button type="button" variant="secondary" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <strong className="calendar-month-label">
              {MONTH_LABELS[monthIndex]} {year}
            </strong>
            <Button type="button" variant="secondary" onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const d = new Date();
                setYear(d.getFullYear());
                setMonthIndex(d.getMonth());
              }}
            >
              Σήμερα
            </Button>
          </div>
        }
      />

      <section className="panel calendar-panel">
        <div className="calendar-weekdays">
          {weekdayHeaders.map((name) => (
            <div key={name} className="calendar-weekday">
              {name.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((cell, index) => {
            if (!cell.day || !cell.iso) {
              return <div key={`empty-${index}`} className="calendar-cell is-empty" />;
            }
            const events = eventsByDate.get(cell.iso) ?? [];
            const isToday = cell.iso === today;
            return (
              <div
                key={cell.iso}
                className={`calendar-cell ${isToday ? 'is-today' : ''}`}
              >
                <div className="calendar-cell-head">
                  <span className="calendar-day-num">{cell.day}</span>
                </div>
                <ul className="calendar-events">
                  {events.slice(0, 3).map((event) => (
                    <li key={event.id} title={`${event.time} ${event.title}`}>
                      <span className="calendar-event-time">{event.time}</span>
                      <span className="calendar-event-title">{event.title}</span>
                    </li>
                  ))}
                  {events.length > 3 ? (
                    <li className="calendar-more">+{events.length - 3} ακόμη</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="quick-links">
        <Link to="/trainings">Προπονήσεις</Link>
        <Link to="/schedule">Εβδομαδιαίο πρόγραμμα</Link>
        <Link to="/attendance">Παρουσίες</Link>
      </div>
    </div>
  );
}
