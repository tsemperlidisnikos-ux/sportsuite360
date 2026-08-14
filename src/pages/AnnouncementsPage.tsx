import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Bold,
  CalendarClock,
  Flag,
  Italic,
  Layers,
  List,
  ListOrdered,
  MoreHorizontal,
  Search,
  Send,
  Underline,
  Users,
  UserRound,
  GraduationCap,
} from 'lucide-react';
import * as announcementsService from '../api/services/announcementsService';
import * as notificationService from '../api/services/notificationService';
import { getSession } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { useAppData } from '../hooks/useAppData';
import type { AnnouncementInput } from '../schemas';
import type {
  Announcement,
  AnnouncementAudienceRole,
  AnnouncementPriority,
  AnnouncementRecipient,
  AnnouncementRecipientKind,
} from '../types';
import { listParentRecipients } from '../utils/announcementAudience';
import {
  classIdsOf,
  visibleClassesForSession,
  visibleStudentsForSession,
} from '../utils/coachScope';

const PAGE_SIZE = 5;

type AudiencePicker = AnnouncementAudienceRole | 'classes' | null;

const AUDIENCE_OPTIONS: Array<{
  id: AnnouncementAudienceRole;
  label: string;
  icon: typeof Users;
  recipientKind: AnnouncementRecipientKind;
}> = [
  { id: 'parents', label: 'Γονείς', icon: Users, recipientKind: 'parent' },
  { id: 'coaches', label: 'Προπονητές', icon: UserRound, recipientKind: 'coach' },
  { id: 'athletes', label: 'Αθλητές', icon: GraduationCap, recipientKind: 'athlete' },
];

const PRIORITY_OPTIONS: Array<{ id: AnnouncementPriority; label: string }> = [
  { id: 'low', label: 'Χαμηλή' },
  { id: 'normal', label: 'Κανονική' },
  { id: 'high', label: 'Υψηλή' },
  { id: 'urgent', label: 'Επείγουσα' },
];

const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  low: 'Χαμηλή',
  normal: 'Κανονική',
  high: 'Υψηλή',
  urgent: 'Επείγουσα',
};

const emptyForm: AnnouncementInput = {
  title: '',
  message: '',
  targetType: 'club',
  targetId: null,
  highPriority: false,
  priority: 'normal',
  status: 'published',
  createdBy: '',
  imageUrl: null,
  visibleFrom: '',
  visibleUntil: '',
  showTo: '',
  sportCategories: '',
  teamsLabel: '',
  audienceRoles: [],
  classIds: [],
  recipientIds: [],
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function htmlToPlain(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.innerText || el.textContent || '').trim();
}

function resolvePriority(item: Announcement): AnnouncementPriority {
  if (item.priority) return item.priority;
  return item.highPriority ? 'high' : 'normal';
}

export function AnnouncementsPage() {
  const { data, refresh } = useAppData();
  const session = getSession();
  const composeRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementInput>(emptyForm);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [audienceFilter, setAudienceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState<AudiencePicker>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [classesEnabled, setClassesEnabled] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      createdBy: session?.fullName || 'Διαχειριστής',
    }));
  }, [session?.fullName]);

  const visibleClasses = useMemo(
    () => visibleClassesForSession(data.classes, data.coaches, session),
    [data.classes, data.coaches, session],
  );
  const allowedClassIds = useMemo(() => classIdsOf(visibleClasses), [visibleClasses]);

  const coachOptions = useMemo(
    () =>
      (data.coaches ?? [])
        .filter((c) => c.active)
        .map((c) => ({
          id: c.id,
          label: `${c.lastName} ${c.firstName}`.trim(),
          hint: c.email,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'el')),
    [data.coaches],
  );

  const athleteOptions = useMemo(() => {
    const classFilter = form.classIds ?? [];
    return visibleStudentsForSession(data.students, allowedClassIds, session)
      .filter((s) => s.status !== 'inactive')
      .filter((s) => (classFilter.length === 0 ? true : s.classId && classFilter.includes(s.classId)))
      .map((s) => ({
        id: s.id,
        label: `${s.lastName} ${s.firstName}`.trim(),
        hint: data.classes.find((c) => c.id === s.classId)?.name ?? '',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'el'));
  }, [data.students, data.classes, form.classIds, allowedClassIds, session]);

  const parentOptions = useMemo(() => listParentRecipients(), [data.parentLinks, data.students]);

  const classOptions = useMemo(
    () =>
      visibleClasses
        .map((c) => ({
          id: c.id,
          label: c.name,
          hint: c.ageGroup || c.sport || '',
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'el')),
    [visibleClasses],
  );

  const announcements = useMemo(
    () =>
      [...(data.announcements ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.announcements],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return announcements.filter((item) => {
      if (item.status === 'draft') return false;
      const priority = resolvePriority(item);
      if (priorityFilter && priority !== priorityFilter) return false;
      if (audienceFilter) {
        const roles = item.audienceRoles ?? [];
        if (roles.length > 0 && !roles.includes(audienceFilter as AnnouncementAudienceRole)) {
          return false;
        }
      }
      if (!q) return true;
      const hay = `${item.title} ${htmlToPlain(item.message)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [announcements, audienceFilter, priorityFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  function resetCompose() {
    setEditing(null);
    setForm({
      ...emptyForm,
      createdBy: session?.fullName || 'Διαχειριστής',
      priority: 'normal',
      status: 'published',
    });
    setScheduleMode('now');
    setSendEmail(false);
    setError('');
    setPickerOpen(null);
    setPickerQuery('');
    setClassesEnabled(false);
  }

  function focusCompose() {
    resetCompose();
    composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openEdit(item: Announcement) {
    setEditing(item);
    setForm({
      title: item.title,
      message: htmlToPlain(item.message),
      targetType: item.targetType,
      targetId: item.targetId,
      highPriority: item.highPriority ?? false,
      priority: resolvePriority(item),
      status: item.status ?? 'published',
      createdBy: item.createdBy || session?.fullName || 'Διαχειριστής',
      imageUrl: item.imageUrl ?? null,
      visibleFrom: item.visibleFrom ?? '',
      visibleUntil: item.visibleUntil ?? '',
      showTo: item.showTo ?? '',
      sportCategories: item.sportCategories ?? '',
      teamsLabel: item.teamsLabel ?? '',
      audienceRoles: item.audienceRoles ?? [],
      classIds: item.classIds ?? [],
      recipientIds: item.recipientIds ?? [],
    });
    setClassesEnabled((item.classIds ?? []).length > 0);
    setScheduleMode(item.visibleFrom ? 'later' : 'now');
    setError('');
    setMenuId(null);
    setPickerOpen(null);
    setPickerQuery('');
    composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function recipientCount(kind: AnnouncementRecipientKind): number {
    return (form.recipientIds ?? []).filter((r) => r.kind === kind).length;
  }

  function toggleAudience(role: AnnouncementAudienceRole) {
    const option = AUDIENCE_OPTIONS.find((o) => o.id === role);
    const active = (form.audienceRoles ?? []).includes(role);

    if (!active) {
      setForm((prev) => ({
        ...prev,
        audienceRoles: [...(prev.audienceRoles ?? []), role],
      }));
      setPickerOpen(role);
      setPickerQuery('');
      return;
    }

    if (pickerOpen === role) {
      setForm((prev) => ({
        ...prev,
        audienceRoles: (prev.audienceRoles ?? []).filter((r) => r !== role),
        recipientIds: (prev.recipientIds ?? []).filter((r) => r.kind !== option?.recipientKind),
      }));
      setPickerOpen(null);
      setPickerQuery('');
      return;
    }

    setPickerOpen(role);
    setPickerQuery('');
  }

  function toggleClassesTarget() {
    if (!classesEnabled) {
      setClassesEnabled(true);
      setPickerOpen('classes');
      setPickerQuery('');
      return;
    }

    if (pickerOpen === 'classes') {
      setClassesEnabled(false);
      setForm((f) => ({ ...f, classIds: [] }));
      setPickerOpen(null);
      setPickerQuery('');
      return;
    }

    setPickerOpen('classes');
    setPickerQuery('');
  }

  function toggleRecipient(kind: AnnouncementRecipientKind, id: string) {
    setForm((prev) => {
      const current = prev.recipientIds ?? [];
      const exists = current.some((r) => r.kind === kind && r.id === id);
      const next: AnnouncementRecipient[] = exists
        ? current.filter((r) => !(r.kind === kind && r.id === id))
        : [...current, { kind, id }];
      return { ...prev, recipientIds: next };
    });
  }

  function toggleClassId(classId: string) {
    setForm((prev) => {
      const current = prev.classIds ?? [];
      const next = current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId];
      return { ...prev, classIds: next };
    });
  }

  function isRecipientSelected(kind: AnnouncementRecipientKind, id: string): boolean {
    return (form.recipientIds ?? []).some((r) => r.kind === kind && r.id === id);
  }

  function setPriority(priority: AnnouncementPriority) {
    setForm((prev) => ({
      ...prev,
      priority,
      highPriority: priority === 'high' || priority === 'urgent',
    }));
  }

  function wrapMessage(prefix: string, suffix = prefix) {
    const el = messageRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = form.message;
    const selected = value.slice(start, end) || 'κείμενο';
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    setForm((prev) => ({ ...prev, message: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  async function persist(status: 'draft' | 'published') {
    const message = form.message.trim();
    const title = form.title.trim();
    if (!title) {
      setError('Ο τίτλος είναι υποχρεωτικός');
      return;
    }
    if (!message) {
      setError('Το περιεχόμενο είναι υποχρεωτικό');
      return;
    }

    setSaving(true);
    setError('');

    const priority = form.priority ?? 'normal';
    const roles = form.audienceRoles ?? [];
    const classIds = form.classIds ?? [];
    const recipientIds = form.recipientIds ?? [];
    const audienceLabels: string[] = [];
    for (const role of roles) {
      const base = AUDIENCE_OPTIONS.find((o) => o.id === role)?.label ?? role;
      const kind = AUDIENCE_OPTIONS.find((o) => o.id === role)?.recipientKind;
      const count = kind ? recipientIds.filter((r) => r.kind === kind).length : 0;
      audienceLabels.push(count > 0 ? `${base} (${count})` : base);
    }
    if (classIds.length > 0) {
      audienceLabels.push(
        classIds.length === 1
          ? classOptions.find((c) => c.id === classIds[0])?.label ?? 'Τμήμα'
          : `Τμήματα (${classIds.length})`,
      );
    }

    const payload: AnnouncementInput = {
      ...form,
      title,
      message,
      priority,
      status,
      highPriority: priority === 'high' || priority === 'urgent',
      createdBy: session?.fullName || form.createdBy || 'Διαχειριστής',
      audienceRoles: roles,
      classIds,
      recipientIds,
      targetType: classIds.length === 1 ? 'team' : 'club',
      targetId: classIds.length === 1 ? classIds[0] : null,
      showTo: audienceLabels.length > 0 ? audienceLabels.join(', ') : 'Ολόκληρος σύλλογος',
      visibleFrom: scheduleMode === 'later' ? form.visibleFrom || '' : '',
    };

    const result = editing
      ? await announcementsService.updateAnnouncement(editing.id, payload)
      : await announcementsService.createAnnouncement(payload);

    if (!result.success) {
      setSaving(false);
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }

    if (status === 'published' && sendEmail && !editing) {
      const clubId = session?.clubId;
      if (clubId) {
        const emails = notificationService.resolveAnnouncementEmails(payload);
        if (emails.length > 0) {
          await notificationService.sendAnnouncementEmails({
            clubId,
            title: payload.title,
            message: payload.message,
            emails,
          });
        }
      }
    }

    setSaving(false);
    resetCompose();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή ανακοίνωσης;')) return;
    await announcementsService.deleteAnnouncement(id);
    setMenuId(null);
    refresh();
  }

  function audienceRolesOf(item: Announcement): AnnouncementAudienceRole[] {
    if (item.audienceRoles && item.audienceRoles.length > 0) return item.audienceRoles;
    return ['parents', 'coaches', 'athletes'];
  }

  return (
    <div className="ann-page">
      <header className="ann-page-head">
        <div>
          <h1>Ανακοινώσεις</h1>
          <p>Δημιουργία και αποστολή ανακοινώσεων σε γονείς, προπονητές και αθλητές.</p>
        </div>
        <Button type="button" onClick={focusCompose}>
          <Send size={16} /> Νέα Ανακοίνωση
        </Button>
      </header>

      <section className="ann-compose panel" ref={composeRef}>
        <h2>{editing ? 'Επεξεργασία ανακοίνωσης' : 'Νέα ανακοίνωση'}</h2>
        <div className="ann-compose-grid">
          <div className="ann-compose-main">
            <label className="ann-field">
              <span className="ann-label">Τίτλος *</span>
              <input
                value={form.title}
                placeholder="Πληκτρολογήστε τίτλο ανακοίνωσης"
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>

            <div className="ann-field">
              <span className="ann-label">Περιεχόμενο *</span>
              <div className="ann-editor">
                <div className="ann-editor-toolbar" role="toolbar" aria-label="Μορφοποίηση">
                  <button type="button" onClick={() => wrapMessage('**', '**')} aria-label="Έντονα">
                    <Bold size={15} />
                  </button>
                  <button type="button" onClick={() => wrapMessage('_', '_')} aria-label="Πλάγια">
                    <Italic size={15} />
                  </button>
                  <button type="button" onClick={() => wrapMessage('__', '__')} aria-label="Υπογράμμιση">
                    <Underline size={15} />
                  </button>
                  <button type="button" onClick={() => wrapMessage('\n- ', '')} aria-label="Λίστα">
                    <List size={15} />
                  </button>
                  <button type="button" onClick={() => wrapMessage('\n1. ', '')} aria-label="Αρίθμηση">
                    <ListOrdered size={15} />
                  </button>
                </div>
                <textarea
                  ref={messageRef}
                  className="ann-message-textarea"
                  rows={8}
                  placeholder="Γράψτε το περιεχόμενο της ανακοίνωσης..."
                  value={form.message}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <aside className="ann-compose-side">
            <div className="ann-side-block">
              <span className="ann-label">Ακροατήριο</span>
              <div className="ann-audience-toggles">
                {AUDIENCE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = (form.audienceRoles ?? []).includes(option.id);
                  const count = recipientCount(option.recipientKind);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`ann-audience-btn${active ? ' is-active' : ''}${
                        pickerOpen === option.id ? ' is-open' : ''
                      }`}
                      onClick={() => toggleAudience(option.id)}
                    >
                      <Icon size={16} />
                      <span className="ann-audience-btn-label">
                        {option.label}
                        {active ? (
                          <em>{count > 0 ? `${count} επιλεγμένοι` : 'Όλοι'}</em>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`ann-audience-btn${classesEnabled ? ' is-active' : ''}${
                    pickerOpen === 'classes' ? ' is-open' : ''
                  }`}
                  onClick={toggleClassesTarget}
                >
                  <Layers size={16} />
                  <span className="ann-audience-btn-label">
                    Τμήματα
                    {classesEnabled ? (
                      <em>
                        {(form.classIds ?? []).length > 0
                          ? `${(form.classIds ?? []).length} επιλεγμένα`
                          : 'Επιλογή'}
                      </em>
                    ) : null}
                  </span>
                </button>
              </div>

              {pickerOpen ? (
                <div className="ann-audience-picker">
                  <label className="ann-audience-search">
                    <Search size={14} aria-hidden />
                    <input
                      type="search"
                      placeholder="Αναζήτηση..."
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                    />
                  </label>
                  <div className="ann-audience-list" role="group">
                    {(() => {
                      const q = pickerQuery.trim().toLowerCase();
                      if (pickerOpen === 'classes') {
                        const rows = classOptions.filter(
                          (row) =>
                            !q ||
                            row.label.toLowerCase().includes(q) ||
                            row.hint.toLowerCase().includes(q),
                        );
                        if (rows.length === 0) {
                          return <p className="ann-hint">Δεν βρέθηκαν τμήματα.</p>;
                        }
                        return rows.map((row) => {
                          const checked = (form.classIds ?? []).includes(row.id);
                          return (
                            <label key={row.id} className={`ann-pick-row${checked ? ' is-on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleClassId(row.id)}
                              />
                              <span>
                                <strong>{row.label}</strong>
                                {row.hint ? <em>{row.hint}</em> : null}
                              </span>
                            </label>
                          );
                        });
                      }

                      const option = AUDIENCE_OPTIONS.find((o) => o.id === pickerOpen);
                      if (!option) return null;
                      const kind = option.recipientKind;
                      const rows =
                        kind === 'coach'
                          ? coachOptions
                          : kind === 'athlete'
                            ? athleteOptions
                            : parentOptions.map((p) => ({
                                id: p.id,
                                label: p.label,
                                hint: p.email,
                              }));
                      const filteredRows = rows.filter(
                        (row) =>
                          !q ||
                          row.label.toLowerCase().includes(q) ||
                          (row.hint || '').toLowerCase().includes(q),
                      );
                      if (filteredRows.length === 0) {
                        return (
                          <p className="ann-hint">
                            {kind === 'parent'
                              ? 'Δεν υπάρχουν συνδεδεμένοι γονείς. Χωρίς επιλογή → όλοι οι γονείς.'
                              : 'Δεν βρέθηκαν εγγραφές.'}
                          </p>
                        );
                      }
                      return filteredRows.map((row) => {
                        const checked = isRecipientSelected(kind, row.id);
                        return (
                          <label key={row.id} className={`ann-pick-row${checked ? ' is-on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRecipient(kind, row.id)}
                            />
                            <span>
                              <strong>{row.label}</strong>
                              {row.hint ? <em>{row.hint}</em> : null}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                  <p className="ann-hint">
                    Χωρίς τικ → όλη η κατηγορία
                    {pickerOpen === 'classes' ? ' (όλα τα τμήματα αν δεν επιλέξετε).' : '.'}
                  </p>
                </div>
              ) : (
                <p className="ann-hint">
                  Χωρίς επιλογή → ολόκληρος σύλλογος. Κλικ σε κατηγορία για συγκεκριμένους παραλήπτες.
                </p>
              )}
            </div>

            <div className="ann-side-block">
              <span className="ann-label">Προτεραιότητα</span>
              <div className="ann-priority-toggles">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`ann-priority-btn is-${option.id}${
                      (form.priority ?? 'normal') === option.id ? ' is-active' : ''
                    }`}
                    onClick={() => setPriority(option.id)}
                  >
                    <Flag size={14} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ann-side-block">
              <span className="ann-label">Προγραμματισμός</span>
              <label className="ann-schedule-select">
                <CalendarClock size={16} aria-hidden />
                <select
                  value={scheduleMode}
                  onChange={(e) => setScheduleMode(e.target.value as 'now' | 'later')}
                >
                  <option value="now">Δημοσίευση τώρα</option>
                  <option value="later">Προγραμματισμός</option>
                </select>
              </label>
              {scheduleMode === 'later' ? (
                <input
                  type="datetime-local"
                  className="ann-schedule-datetime"
                  value={form.visibleFrom ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, visibleFrom: e.target.value }))
                  }
                />
              ) : null}
            </div>

            {!editing ? (
              <label className="ann-email-check">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <span>Αποστολή και με email</span>
              </label>
            ) : null}
          </aside>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="ann-compose-actions">
          {editing ? (
            <button type="button" className="ann-draft-btn" onClick={resetCompose}>
              Ακύρωση επεξεργασίας
            </button>
          ) : null}
          <button
            type="button"
            className="ann-draft-btn"
            disabled={saving}
            onClick={() => void persist('draft')}
          >
            Αποθήκευση ως πρόχειρο
          </button>
          <Button type="button" disabled={saving} onClick={() => void persist('published')}>
            <Send size={16} /> {saving ? 'Αποστολή…' : 'Αποστολή'}
          </Button>
        </div>
      </section>

      <section className="ann-list panel">
        <div className="ann-list-head">
          <h2>Λίστα ανακοινώσεων</h2>
          <div className="ann-list-filters">
            <select
              value={audienceFilter}
              onChange={(e) => {
                setAudienceFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Όλα τα ακροατήρια</option>
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Όλες οι προτεραιότητες</option>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="ann-search">
              <Search size={15} aria-hidden />
              <input
                type="search"
                placeholder="Αναζήτηση..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <p className="ann-empty">Δεν υπάρχουν ανακοινώσεις με αυτά τα κριτήρια.</p>
        ) : (
          <div className="table-wrap ann-table-wrap">
            <table className="ann-table">
              <thead>
                <tr>
                  <th>Τίτλος</th>
                  <th>Ακροατήριο</th>
                  <th>Προτεραιότητα</th>
                  <th>Δημοσίευση</th>
                  <th>Δημιουργός</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item) => {
                  const priority = resolvePriority(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="ann-title-cell">
                          <i className={`ann-dot is-${priority}`} aria-hidden />
                          <div>
                            <strong>{item.title}</strong>
                            <span>{htmlToPlain(item.message).slice(0, 90)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="ann-role-pills">
                          {audienceRolesOf(item).map((role) => {
                            const kind = AUDIENCE_OPTIONS.find((o) => o.id === role)?.recipientKind;
                            const count = kind
                              ? (item.recipientIds ?? []).filter((r) => r.kind === kind).length
                              : 0;
                            return (
                              <span key={role} className={`ann-role-pill is-${role}`}>
                                {AUDIENCE_OPTIONS.find((o) => o.id === role)?.label ?? role}
                                {count > 0 ? ` · ${count}` : ''}
                              </span>
                            );
                          })}
                          {(item.classIds ?? []).length > 0 ? (
                            <span className="ann-role-pill is-classes">
                              Τμήματα · {(item.classIds ?? []).length}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className={`ann-priority-label is-${priority}`}>
                          <Flag size={13} />
                          {PRIORITY_LABELS[priority]}
                        </span>
                      </td>
                      <td>{formatDate(item.visibleFrom || item.createdAt)}</td>
                      <td>{item.createdBy || 'Διαχειριστής'}</td>
                      <td className="ann-row-actions">
                        <div className="ann-menu-wrap">
                          <button
                            type="button"
                            className="ann-menu-btn"
                            aria-label="Ενέργειες"
                            onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {menuId === item.id ? (
                            <div className="ann-menu">
                              <button type="button" onClick={() => openEdit(item)}>
                                Επεξεργασία
                              </button>
                              <button type="button" onClick={() => void handleDelete(item.id)}>
                                Διαγραφή
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="ann-pager">
          <span>
            {from}-{to} από {filtered.length}
          </span>
          <div className="ann-pager-btns">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === safePage ? 'is-active' : ''}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
