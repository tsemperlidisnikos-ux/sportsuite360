import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Bold,
  Flag,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Pencil,
  Plus,
  Strikethrough,
  Trash2,
  Underline,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import * as announcementsService from '../api/services/announcementsService';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { AnnouncementInput } from '../schemas';
import type {
  Announcement,
  AnnouncementAudienceRole,
  AnnouncementRecipient,
  AnnouncementRecipientKind,
} from '../types';

const AUDIENCE_OPTIONS: Array<{ id: AnnouncementAudienceRole; label: string }> = [
  { id: 'athletes', label: 'Αθλητές' },
  { id: 'coaches', label: 'Προπονητές' },
  { id: 'staff', label: 'Προσωπικό' },
  { id: 'parents', label: 'Γονείς' },
];

const emptyForm: AnnouncementInput = {
  title: '',
  message: '',
  targetType: 'club',
  targetId: null,
  highPriority: false,
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

function applyFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function recipientKey(item: AnnouncementRecipient): string {
  return `${item.kind}:${item.id}`;
}

export function AnnouncementsPage() {
  const { data, refresh } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const announcements = useMemo(
    () =>
      [...(data.announcements ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [data.announcements],
  );

  const peopleOptions = useMemo(() => {
    const athletes = data.students
      .filter((s) => s.status !== 'inactive')
      .map((s) => ({
        kind: 'athlete' as const,
        id: s.id,
        label: `${s.lastName} ${s.firstName}`.trim(),
        group: 'Αθλητές',
      }));
    const coaches = data.coaches
      .filter((c) => c.active)
      .map((c) => ({
        kind: 'coach' as const,
        id: c.id,
        label: `${c.lastName} ${c.firstName}`.trim(),
        group: 'Προπονητές',
      }));
    const staff = data.staff
      .filter((s) => s.active)
      .map((s) => ({
        kind: 'staff' as const,
        id: s.id,
        label: s.fullName,
        group: 'Προσωπικό',
      }));
    return [...athletes, ...coaches, ...staff].sort((a, b) =>
      a.label.localeCompare(b.label, 'el'),
    );
  }, [data.students, data.coaches, data.staff]);

  const selectedRecipientKeys = useMemo(
    () => new Set((form.recipientIds ?? []).map(recipientKey)),
    [form.recipientIds],
  );

  function syncMessageFromEditor() {
    const html = editorRef.current?.innerHTML?.trim() ?? '';
    const text = editorRef.current?.innerText?.trim() ?? '';
    setForm((prev) => ({ ...prev, message: text ? html : '' }));
  }

  function toggleAudienceRole(role: AnnouncementAudienceRole) {
    setForm((prev) => {
      const current = prev.audienceRoles ?? [];
      const next = current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role];
      return { ...prev, audienceRoles: next };
    });
  }

  function toggleClassId(classId: string) {
    setForm((prev) => {
      const current = prev.classIds ?? [];
      const next = current.includes(classId)
        ? current.filter((item) => item !== classId)
        : [...current, classId];
      const teamsLabel = data.classes
        .filter((c) => next.includes(c.id))
        .map((c) => c.name)
        .join(', ');
      return {
        ...prev,
        classIds: next,
        teamsLabel,
        targetType: next.length === 1 ? 'team' : 'club',
        targetId: next.length === 1 ? next[0] : null,
      };
    });
  }

  function toggleRecipient(kind: AnnouncementRecipientKind, id: string) {
    setForm((prev) => {
      const current = prev.recipientIds ?? [];
      const exists = current.some((item) => item.kind === kind && item.id === id);
      const next = exists
        ? current.filter((item) => !(item.kind === kind && item.id === id))
        : [...current, { kind, id }];
      return { ...prev, recipientIds: next };
    });
  }

  function describeAudience(item: Announcement): string {
    const parts: string[] = [];
    const roles = item.audienceRoles ?? [];
    if (roles.length > 0) {
      parts.push(
        roles
          .map((role) => AUDIENCE_OPTIONS.find((o) => o.id === role)?.label ?? role)
          .join(', '),
      );
    }
    const classNames = (item.classIds ?? [])
      .map((id) => data.classes.find((c) => c.id === id)?.name)
      .filter(Boolean);
    if (classNames.length > 0) parts.push(classNames.join(', '));
    else if (item.teamsLabel) parts.push(item.teamsLabel);

    const people = (item.recipientIds ?? [])
      .map((r) => {
        if (r.kind === 'athlete') {
          const s = data.students.find((x) => x.id === r.id);
          return s ? `${s.lastName} ${s.firstName}` : null;
        }
        if (r.kind === 'coach') {
          const c = data.coaches.find((x) => x.id === r.id);
          return c ? `${c.lastName} ${c.firstName}` : null;
        }
        const staff = data.staff.find((x) => x.id === r.id);
        return staff?.fullName ?? null;
      })
      .filter(Boolean);
    if (people.length > 0) parts.push(people.join(', '));

    if (parts.length === 0) return item.showTo?.trim() || 'Όλοι';
    return parts.join(' · ');
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
    window.setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = '';
    }, 0);
  }

  function openEdit(item: Announcement) {
    setEditing(item);
    setForm({
      title: item.title,
      message: item.message,
      targetType: item.targetType,
      targetId: item.targetId,
      highPriority: item.highPriority ?? false,
      imageUrl: item.imageUrl ?? null,
      visibleFrom: item.visibleFrom ?? '',
      visibleUntil: item.visibleUntil ?? '',
      showTo: item.showTo ?? '',
      sportCategories: item.sportCategories ?? '',
      teamsLabel: item.teamsLabel ?? '',
      audienceRoles: item.audienceRoles ?? [],
      classIds:
        item.classIds ??
        (item.targetType === 'team' && item.targetId ? [item.targetId] : []),
      recipientIds: item.recipientIds ?? [],
    });
    setError('');
    setOpen(true);
    window.setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = item.message || '';
    }, 0);
  }

  function closeModal() {
    setOpen(false);
    setError('');
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Επιλέξτε αρχείο εικόνας.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  }

  function handleAiHelp() {
    const draft =
      form.title.trim().length > 0
        ? `<p>Αγαπητοί αθλητές και γονείς,</p><p>Σας ενημερώνουμε σχετικά με: <strong>${form.title}</strong>.</p><p>Περισσότερες λεπτομέρειες θα ακολουθήσουν.</p>`
        : '<p>Αγαπητοί αθλητές και γονείς,</p><p>Σας ενημερώνουμε για μια σημαντική ανακοίνωση του συλλόγου.</p><p>Παρακαλούμε διαβάστε προσεκτικά τις λεπτομέρειες.</p>';
    if (editorRef.current) editorRef.current.innerHTML = draft;
    setForm((prev) => ({ ...prev, message: draft }));
  }

  async function handleSave() {
    syncMessageFromEditor();
    const message =
      (editorRef.current?.innerText?.trim()
        ? editorRef.current.innerHTML.trim()
        : form.message.trim()) || '';
    if (!message || message === '<br>') {
      setError('Το κείμενο είναι υποχρεωτικό');
      return;
    }

    setSaving(true);
    setError('');
    const classIds = form.classIds ?? [];
    const audienceRoles = form.audienceRoles ?? [];
    const recipientIds = form.recipientIds ?? [];
    const showTo =
      [
        ...audienceRoles.map(
          (role) => AUDIENCE_OPTIONS.find((o) => o.id === role)?.label ?? role,
        ),
        ...recipientIds.map((r) => {
          const person = peopleOptions.find((p) => p.kind === r.kind && p.id === r.id);
          return person?.label;
        }),
      ]
        .filter(Boolean)
        .join(', ') || '';

    const payload: AnnouncementInput = {
      ...form,
      message,
      classIds,
      audienceRoles,
      recipientIds,
      showTo,
      teamsLabel: data.classes
        .filter((c) => classIds.includes(c.id))
        .map((c) => c.name)
        .join(', '),
      targetType: classIds.length === 1 ? 'team' : 'club',
      targetId: classIds.length === 1 ? classIds[0] : null,
    };
    const result = editing
      ? await announcementsService.updateAnnouncement(editing.id, payload)
      : await announcementsService.createAnnouncement(payload);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    closeModal();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή ανακοίνωσης;')) return;
    await announcementsService.deleteAnnouncement(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Ανακοινώσεις"
        subtitle="Ανακοινώσεις προς αθλητές και τμήματα."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Νέα ανακοίνωση
          </Button>
        }
      />

      <section className="panel table-wrap">
        {announcements.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={28} />
            <p>Δεν υπάρχουν ακόμη ανακοινώσεις.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ημερομηνία</th>
                <th>Τίτλος</th>
                <th>Στόχος</th>
                <th>Μήνυμα</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {announcements.map((item) => {
                return (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      {item.highPriority ? <Flag size={14} className="ann-priority-icon" /> : null}{' '}
                      {item.title}
                    </td>
                    <td>{describeAudience(item)}</td>
                    <td className="announcement-message-cell">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: item.message.replace(/<[^>]+>/g, ' ').slice(0, 120),
                        }}
                      />
                    </td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Επεξεργασία"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Διαγραφή"
                        onClick={() => void handleDelete(item.id)}
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

      <Modal
        open={open}
        title={editing ? 'Επεξεργασία ανακοίνωσης' : 'Νέα ανακοίνωση'}
        onClose={closeModal}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Άκυρο
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </Button>
          </>
        }
      >
        <div className="ann-form">
          <div className="ann-form-top">
            <label className="ann-priority">
              <input
                type="checkbox"
                checked={Boolean(form.highPriority)}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, highPriority: e.target.checked }))
                }
              />
              <Flag size={16} />
              <span>Υψηλή προτεραιότητα</span>
            </label>

            <div className="ann-image-field">
              <span className="ann-label">Εικόνα</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageChange}
              />
              {form.imageUrl ? (
                <div className="ann-image-preview">
                  <img src={form.imageUrl} alt="Προεπισκόπηση" />
                  <button
                    type="button"
                    className="ann-image-remove"
                    aria-label="Αφαίρεση εικόνας"
                    onClick={() => setForm((prev) => ({ ...prev, imageUrl: null }))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="ann-image-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Πατήστε εδώ ή σύρετε αρχεία...
                </button>
              )}
              <p className="ann-hint">Μπορείτε να ανεβάσετε μόνο ένα αρχείο</p>
            </div>
          </div>

          <label className="ann-field">
            <span className="ann-label">Τίτλος</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <div className="ann-field">
            <span className="ann-label">
              Κείμενο <span className="ann-required">*</span>
            </span>
            <div className="ann-editor">
              <div className="ann-editor-toolbar">
                <select
                  className="ann-editor-select"
                  defaultValue="p"
                  onChange={(e) => applyFormat('formatBlock', e.target.value)}
                >
                  <option value="p">Normal</option>
                  <option value="h2">Heading</option>
                  <option value="h3">Subheading</option>
                </select>
                <button type="button" onClick={() => applyFormat('insertUnorderedList')} aria-label="Λίστα">
                  <List size={16} />
                </button>
                <button type="button" onClick={() => applyFormat('insertOrderedList')} aria-label="Αριθμημένη λίστα">
                  <ListOrdered size={16} />
                </button>
                <button type="button" onClick={() => applyFormat('bold')} aria-label="Έντονα">
                  <Bold size={16} />
                </button>
                <button type="button" onClick={() => applyFormat('italic')} aria-label="Πλάγια">
                  <Italic size={16} />
                </button>
                <button type="button" onClick={() => applyFormat('underline')} aria-label="Υπογράμμιση">
                  <Underline size={16} />
                </button>
                <button type="button" onClick={() => applyFormat('strikeThrough')} aria-label="Διαγραφή">
                  <Strikethrough size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('URL συνδέσμου');
                    if (url) applyFormat('createLink', url);
                  }}
                  aria-label="Σύνδεσμος"
                >
                  <Link2 size={16} />
                </button>
                <button type="button" onClick={() => applyFormat('removeFormat')} aria-label="Καθαρισμός">
                  Tx
                </button>
              </div>
              <div
                ref={editorRef}
                className="ann-editor-body"
                contentEditable
                role="textbox"
                aria-multiline="true"
                onInput={syncMessageFromEditor}
                suppressContentEditableWarning
              />
            </div>
            <button type="button" className="ann-ai-btn" onClick={handleAiHelp}>
              <Wand2 size={16} />
              Βοήθησέ με να γράψω
            </button>
          </div>

          <div className="ann-dates">
            <label className="ann-field">
              <span className="ann-label">Να εμφανίζεται από</span>
              <input
                type="date"
                value={form.visibleFrom ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visibleFrom: e.target.value }))
                }
              />
            </label>
            <label className="ann-field">
              <span className="ann-label">μέχρι</span>
              <input
                type="date"
                value={form.visibleUntil ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visibleUntil: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="ann-field">
            <span className="ann-label">Εμφάνισε στους</span>
            <div className="ann-chip-row">
              {AUDIENCE_OPTIONS.map((option) => {
                const active = (form.audienceRoles ?? []).includes(option.id);
                return (
                  <label key={option.id} className={`ann-chip ${active ? 'is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleAudienceRole(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
            <span className="ann-hint">
              Αφήστε κενό για όλους. Μπορείτε να επιλέξετε ομάδες ρόλων και/ή συγκεκριμένα άτομα.
            </span>
          </div>

          <label className="ann-field">
            <span className="ann-label">Για τις κατηγορίες αθλημάτων</span>
            <input
              value={form.sportCategories ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sportCategories: e.target.value }))
              }
              list="ann-sports-list"
            />
            <datalist id="ann-sports-list">
              {data.sports.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <span className="ann-hint">
              Αφήστε το κενό για να εμφανιστεί σε όλες τις κατηγορίες που διαχειρίζεστε
            </span>
          </label>

          <div className="ann-field">
            <span className="ann-label">Τμήματα</span>
            <div className="ann-chip-row">
              {data.classes.length === 0 ? (
                <span className="ann-hint">Δεν υπάρχουν τμήματα.</span>
              ) : (
                data.classes.map((item) => {
                  const active = (form.classIds ?? []).includes(item.id);
                  return (
                    <label key={item.id} className={`ann-chip ${active ? 'is-active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleClassId(item.id)}
                      />
                      <span>{item.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <span className="ann-hint">
              Αφήστε κενό για όλα τα διαχειριζόμενα τμήματα
            </span>
          </div>

          <div className="ann-field">
            <span className="ann-label">Συγκεκριμένα άτομα</span>
            <div className="ann-people-list">
              {peopleOptions.length === 0 ? (
                <span className="ann-hint">Δεν υπάρχουν διαθέσιμα άτομα.</span>
              ) : (
                peopleOptions.map((person) => {
                  const active = selectedRecipientKeys.has(`${person.kind}:${person.id}`);
                  return (
                    <label
                      key={`${person.kind}:${person.id}`}
                      className={`ann-person-row ${active ? 'is-active' : ''}`}
                    >
                      <span>
                        {person.label}
                        <small>{person.group}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleRecipient(person.kind, person.id)}
                      />
                    </label>
                  );
                })
              )}
            </div>
            <span className="ann-hint">
              Προαιρετικά: επιλέξτε συγκεκριμένους αθλητές, προπονητές ή προσωπικό
            </span>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
