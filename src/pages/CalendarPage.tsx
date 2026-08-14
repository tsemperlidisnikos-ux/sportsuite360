import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSession } from '../auth/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import {
  classIdsOf,
  isClassInCoachScope,
  resolveCoachRecord,
  sportsMatch,
  visibleClassesForSession,
} from '../utils/coachScope';
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

type CalView = 'month' | 'week' | 'day';
type EventKind = 'training' | 'match' | 'other';

type CalEvent = {
  id: string;
  title: string;
  time: string;
  kind: EventKind;
  classId: string | null;
  location: string;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function mondayFirstWeekday(year: number, monthIndex: number, day: number): number {
  const js = new Date(year, monthIndex, day).getDay();
  return (js + 6) % 7;
}

function buildMonthCells(year: number, monthIndex: number) {
  const totalDays = daysInMonth(year, monthIndex);
  const offset = mondayFirstWeekday(year, monthIndex, 1);
  const prevDays = daysInMonth(year, monthIndex - 1);
  const result: Array<{ day: number; iso: string; inMonth: boolean }> = [];

  for (let i = 0; i < offset; i += 1) {
    const day = prevDays - offset + i + 1;
    const d = new Date(year, monthIndex - 1, day);
    result.push({
      day,
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      inMonth: false,
    });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    result.push({
      day,
      iso: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
      inMonth: true,
    });
  }
  let next = 1;
  while (result.length % 7 !== 0 || result.length < 42) {
    const d = new Date(year, monthIndex + 1, next);
    result.push({
      day: next,
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      inMonth: false,
    });
    next += 1;
    if (result.length >= 42) break;
  }
  return result;
}

export function CalendarPage() {
  const { data } = useAppData();
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
  const allowedClassIds = useMemo(() => classIdsOf(visibleClasses), [visibleClasses]);
  const today = localDateIso();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [view, setView] = useState<CalView>('month');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedIso, setSelectedIso] = useState(today);

  const classById = useMemo(
    () => new Map(visibleClasses.map((cls) => [cls.id, cls])),
    [visibleClasses],
  );

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const t of data.trainings ?? []) if (t.location) set.add(t.location);
    for (const m of data.matches ?? []) if (m.location) set.add(m.location);
    return [...set].sort((a, b) => a.localeCompare(b, 'el'));
  }, [data.trainings, data.matches]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();

    const push = (date: string, event: CalEvent) => {
      const list = map.get(date) ?? [];
      list.push(event);
      map.set(date, list);
    };

    for (const training of data.trainings ?? []) {
      const date = training.date?.slice(0, 10);
      if (!date) continue;
      if (!isClassInCoachScope(training.classId, allowedClassIds, isCoach)) continue;
      const cls = training.classId ? classById.get(training.classId) : undefined;
      push(date, {
        id: training.id,
        title: cls?.name || training.location || 'Προπόνηση',
        time: training.startTime || '',
        kind: 'training',
        classId: training.classId,
        location: training.location || '',
      });
    }

    for (const match of data.matches ?? []) {
      const date = match.date?.slice(0, 10);
      if (!date) continue;
      const matchInScope = match.classId
        ? isClassInCoachScope(match.classId, allowedClassIds, isCoach)
        : !isCoach || sportsMatch(match.sport, coach?.sport);
      if (!matchInScope) continue;
      push(date, {
        id: match.id,
        title: `Αγώνας vs ${match.opponent}`,
        time: match.time || '',
        kind: 'match',
        classId: match.classId,
        location: match.location || '',
      });
    }

    for (const [, list] of map) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [data.trainings, data.matches, classById, allowedClassIds, isCoach, coach]);

  function passesFilters(event: CalEvent) {
    if (categoryFilter && event.kind !== categoryFilter) return false;
    if (teamFilter && event.classId !== teamFilter) return false;
    if (locationFilter && event.location !== locationFilter) return false;
    return true;
  }

  const cells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);

  const miniCells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);

  const weekDays = useMemo(() => {
    const selected = new Date(`${selectedIso}T12:00:00`);
    const mondayOffset = (selected.getDay() + 6) % 7;
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        day: d.getDate(),
        iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        inMonth: d.getMonth() === monthIndex,
        label: dayNames[(d.getDay() + 7) % 7],
      };
    });
  }, [selectedIso, monthIndex]);

  function shiftMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  }

  function shiftRange(delta: number) {
    if (view === 'month') {
      shiftMonth(delta);
      return;
    }
    const base = new Date(`${selectedIso}T12:00:00`);
    base.setDate(base.getDate() + delta * (view === 'week' ? 7 : 1));
    const iso = localDateIso(base);
    setSelectedIso(iso);
    setYear(base.getFullYear());
    setMonthIndex(base.getMonth());
  }

  function goToday() {
    const d = new Date();
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
    setSelectedIso(localDateIso(d));
  }

  const weekdayHeaders = [...dayNames.slice(1), dayNames[0]].map((n) => n.slice(0, 3));

  const titleLabel =
    view === 'day'
      ? new Date(`${selectedIso}T12:00:00`).toLocaleDateString('el-GR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : view === 'week'
        ? `Εβδομάδα · ${weekDays[0]?.iso.slice(8)}–${weekDays[6]?.iso.slice(8)} ${MONTH_LABELS[monthIndex]} ${year}`
        : `${MONTH_LABELS[monthIndex]} ${year}`;

  function renderEventList(iso: string, limit = 12) {
    const events = (eventsByDate.get(iso) ?? []).filter(passesFilters);
    if (events.length === 0) {
      return <p className="cal-empty-day">Δεν υπάρχουν γεγονότα.</p>;
    }
    return (
      <ul className="cal-agenda">
        {events.slice(0, limit).map((event) => (
          <li key={event.id} className={`cal-agenda-item is-${event.kind}`}>
            <i aria-hidden />
            <div>
              <strong>
                {event.time ? `${event.time} · ` : ''}
                {event.title}
              </strong>
              {event.location ? <span>{event.location}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="cal-page">
      <PageHeader title="Ημερολόγιο" subtitle="Προπονήσεις, αγώνες και δραστηριότητες." />

      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <button type="button" className="cal-nav-btn" onClick={() => shiftRange(-1)} aria-label="Προηγούμενο">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="cal-nav-btn" onClick={() => shiftRange(1)} aria-label="Επόμενο">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="cal-today-btn" onClick={goToday}>
            Σήμερα
          </button>
          <strong className="cal-month-title">{titleLabel}</strong>
        </div>

        <div className="cal-toolbar-right">
          <div className="cal-view-toggle" role="group" aria-label="Προβολή">
            {(
              [
                ['month', 'Μήνας'],
                ['week', 'Εβδομάδα'],
                ['day', 'Ημέρα'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={view === id ? 'is-active' : ''}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to="/trainings" className="cal-new-btn">
            <CalendarPlus size={16} /> Νέο Γεγονός
          </Link>
        </div>
      </div>

      <div className="cal-layout">
        <section className="cal-main">
          {view === 'month' ? (
            <>
              <div className="cal-weekdays">
                {weekdayHeaders.map((name) => (
                  <div key={name} className="cal-weekday">
                    {name}
                  </div>
                ))}
              </div>
              <div className="cal-grid">
                {cells.map((cell) => {
                  const events = (eventsByDate.get(cell.iso) ?? []).filter(passesFilters);
                  const isToday = cell.iso === today;
                  const isSelected = cell.iso === selectedIso;
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      className={`cal-cell${!cell.inMonth ? ' is-out' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                      onClick={() => setSelectedIso(cell.iso)}
                    >
                      <span className="cal-day-num">{cell.day}</span>
                      <ul className="cal-events">
                        {events.slice(0, 3).map((event) => (
                          <li
                            key={event.id}
                            className={`cal-event is-${event.kind}`}
                            title={`${event.time} ${event.title}`}
                          >
                            <i aria-hidden />
                            <span>
                              {event.time ? `${event.time} ` : ''}
                              {event.title}
                            </span>
                          </li>
                        ))}
                        {events.length > 3 ? (
                          <li className="cal-more">+{events.length - 3} ακόμη</li>
                        ) : null}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </>
          ) : view === 'week' ? (
            <div className="cal-week-view">
              {weekDays.map((day) => (
                <article
                  key={day.iso}
                  className={`cal-week-col${day.iso === today ? ' is-today' : ''}${day.iso === selectedIso ? ' is-selected' : ''}`}
                >
                  <button type="button" className="cal-week-head" onClick={() => setSelectedIso(day.iso)}>
                    <span>{day.label.slice(0, 3)}</span>
                    <strong>{day.day}</strong>
                  </button>
                  {renderEventList(day.iso, 8)}
                </article>
              ))}
            </div>
          ) : (
            <div className="cal-day-view">{renderEventList(selectedIso)}</div>
          )}
        </section>

        <aside className="cal-sidebar">
          <div className="cal-mini">
            <div className="cal-mini-head">
              <strong>
                {MONTH_LABELS[monthIndex].slice(0, 3)} {year}
              </strong>
              <div>
                <button type="button" onClick={() => shiftMonth(-1)} aria-label="Προηγούμενος">
                  <ChevronLeft size={14} />
                </button>
                <button type="button" onClick={() => shiftMonth(1)} aria-label="Επόμενος">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="cal-mini-weekdays">
              {weekdayHeaders.map((n) => (
                <span key={n}>{n.slice(0, 2)}</span>
              ))}
            </div>
            <div className="cal-mini-grid">
              {miniCells.map((cell) => {
                const hasEvents = (eventsByDate.get(cell.iso) ?? []).some(passesFilters);
                return (
                  <button
                    key={`mini-${cell.iso}`}
                    type="button"
                    className={`cal-mini-day${!cell.inMonth ? ' is-out' : ''}${cell.iso === today ? ' is-today' : ''}${cell.iso === selectedIso ? ' is-selected' : ''}`}
                    onClick={() => setSelectedIso(cell.iso)}
                  >
                    {cell.day}
                    {hasEvents ? <i className="cal-mini-dot" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cal-side-block">
            <h3>Φίλτρα</h3>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Όλες οι Κατηγορίες</option>
              <option value="training">Προπόνηση</option>
              <option value="match">Αγώνας</option>
            </select>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">Όλες οι Ομάδες</option>
              {visibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Όλοι οι Χώροι</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="cal-side-block">
            <h3>Υπόμνημα</h3>
            <ul className="cal-legend">
              <li>
                <i className="is-training" /> Προπόνηση
              </li>
              <li>
                <i className="is-match" /> Αγώνας
              </li>
              <li>
                <i className="is-other" /> Άλλο
              </li>
            </ul>
          </div>

          <div className="cal-side-block cal-sync">
            <h3>Συγχρονισμός</h3>
            <Link to="/schedule" className="cal-sync-link">
              <Link2 size={16} /> Σύνδεση Ημερολογίου
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
