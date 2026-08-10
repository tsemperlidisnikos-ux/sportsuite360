import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Flag, Megaphone, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
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
} from '../types';

const TEMPLATES_KEY = 'academyhub-announcement-templates';

type MessageTemplate = {
  id: string;
  name: string;
  title: string;
  message: string;
};

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

function htmlToPlain(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.innerText || el.textContent || '').trim();
}

function loadTemplates(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MessageTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTemplates(items: MessageTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(items));
}

function createTemplateId() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => loadTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [wholeClub, setWholeClub] = useState(true);
  const [highlightAvailableClasses, setHighlightAvailableClasses] = useState<string[]>([]);
  const [highlightSelectedClasses, setHighlightSelectedClasses] = useState<string[]>([]);
  const [highlightAvailableAthletes, setHighlightAvailableAthletes] = useState<string[]>([]);
  const [highlightSelectedAthletes, setHighlightSelectedAthletes] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTemplates(loadTemplates());
  }, [open]);

  const announcements = useMemo(
    () =>
      [...(data.announcements ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [data.announcements],
  );

  const selectedClassIds = form.classIds ?? [];
  const selectedRecipientKeys = useMemo(
    () => new Set((form.recipientIds ?? []).map(recipientKey)),
    [form.recipientIds],
  );

  const recipientsByClass = useMemo(() => {
    return selectedClassIds
      .map((classId) => {
        const academyClass = data.classes.find((c) => c.id === classId);
        if (!academyClass) return null;
        const athletes = data.students
          .filter((s) => s.classId === classId && s.status !== 'inactive')
          .map((s) => ({
            kind: 'athlete' as const,
            id: s.id,
            label: `${s.lastName} ${s.firstName}`.trim(),
            className: academyClass.name,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'el'));
        return { classId, className: academyClass.name, athletes };
      })
      .filter(Boolean) as Array<{
      classId: string;
      className: string;
      athletes: Array<{ kind: 'athlete'; id: string; label: string; className: string }>;
    }>;
  }, [selectedClassIds, data.classes, data.students]);

  const availableClasses = useMemo(
    () =>
      data.classes
        .filter((c) => !selectedClassIds.includes(c.id))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'el')),
    [data.classes, selectedClassIds],
  );

  const selectedClasses = useMemo(
    () =>
      data.classes
        .filter((c) => selectedClassIds.includes(c.id))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'el')),
    [data.classes, selectedClassIds],
  );

  const availableAthletes = useMemo(() => {
    const selectedKeys = selectedRecipientKeys;
    return recipientsByClass
      .flatMap((group) =>
        group.athletes
          .filter((a) => !selectedKeys.has(`athlete:${a.id}`))
          .map((a) => ({ ...a, classId: group.classId })),
      )
      .sort((a, b) => a.label.localeCompare(b.label, 'el'));
  }, [recipientsByClass, selectedRecipientKeys]);

  const selectedAthletes = useMemo(() => {
    return (form.recipientIds ?? [])
      .map((r) => {
        const student = data.students.find((s) => s.id === r.id);
        if (!student) return null;
        const academyClass = data.classes.find((c) => c.id === student.classId);
        return {
          kind: 'athlete' as const,
          id: student.id,
          label: `${student.lastName} ${student.firstName}`.trim(),
          className: academyClass?.name ?? '',
          classId: student.classId ?? '',
        };
      })
      .filter(Boolean) as Array<{
      kind: 'athlete';
      id: string;
      label: string;
      className: string;
      classId: string;
    }>;
  }, [form.recipientIds, data.students, data.classes]);

  function clearShuttleHighlights() {
    setHighlightAvailableClasses([]);
    setHighlightSelectedClasses([]);
    setHighlightAvailableAthletes([]);
    setHighlightSelectedAthletes([]);
  }

  function toggleHighlight(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function syncClassSelection(classIds: string[]) {
    setWholeClub(false);
    setForm((prev) => {
      const recipientIds = (prev.recipientIds ?? []).filter((r) => {
        if (r.kind !== 'athlete') return true;
        const student = data.students.find((s) => s.id === r.id);
        return student?.classId ? classIds.includes(student.classId) : false;
      });
      const names = data.classes
        .filter((c) => classIds.includes(c.id))
        .map((c) => c.name);
      return {
        ...prev,
        classIds,
        recipientIds,
        targetType: classIds.length === 1 ? 'team' : 'club',
        targetId: classIds.length === 1 ? classIds[0] : null,
        teamsLabel: names.join(', '),
        showTo: names.join(', ') || 'Ολόκληρος σύλλογος',
      };
    });
  }

  function moveClassesToSelected() {
    if (highlightAvailableClasses.length === 0) return;
    const next = [...new Set([...selectedClassIds, ...highlightAvailableClasses])];
    syncClassSelection(next);
    setHighlightAvailableClasses([]);
  }

  function moveClassesToAvailable() {
    if (highlightSelectedClasses.length === 0) return;
    const remove = new Set(highlightSelectedClasses);
    const next = selectedClassIds.filter((id) => !remove.has(id));
    syncClassSelection(next);
    setHighlightSelectedClasses([]);
    setHighlightAvailableAthletes([]);
    setHighlightSelectedAthletes([]);
  }

  function moveAthletesToSelected() {
    if (highlightAvailableAthletes.length === 0) return;
    setWholeClub(false);
    setForm((prev) => {
      const current = prev.recipientIds ?? [];
      const existing = new Set(current.map(recipientKey));
      const added = highlightAvailableAthletes
        .filter((id) => !existing.has(`athlete:${id}`))
        .map((id) => ({ kind: 'athlete' as const, id }));
      return { ...prev, recipientIds: [...current, ...added] };
    });
    setHighlightAvailableAthletes([]);
  }

  function moveAthletesToAvailable() {
    if (highlightSelectedAthletes.length === 0) return;
    const remove = new Set(highlightSelectedAthletes);
    setForm((prev) => ({
      ...prev,
      recipientIds: (prev.recipientIds ?? []).filter((r) => !remove.has(r.id)),
    }));
    setHighlightSelectedAthletes([]);
  }
  function describeAudience(item: Announcement): string {
    const parts: string[] = [];
    const roles = (item.audienceRoles ?? [])
      .map((role) => AUDIENCE_OPTIONS.find((o) => o.id === role)?.label)
      .filter(Boolean);
    if (roles.length > 0) parts.push(roles.join(', '));

    const classNames = (item.classIds ?? [])
      .map((id) => data.classes.find((c) => c.id === id)?.name)
      .filter(Boolean);
    if (classNames.length > 0) parts.push(classNames.join(', '));
    else if (item.targetType === 'team' && item.targetId) {
      const name = data.classes.find((c) => c.id === item.targetId)?.name;
      if (name) parts.push(name);
    }

    const people = (item.recipientIds ?? [])
      .map((r) => {
        if (r.kind === 'athlete') {
          const s = data.students.find((x) => x.id === r.id);
          return s ? `${s.lastName} ${s.firstName}`.trim() : null;
        }
        if (r.kind === 'coach') {
          const c = data.coaches.find((x) => x.id === r.id);
          return c ? `${c.lastName} ${c.firstName}`.trim() : null;
        }
        const staff = data.staff.find((x) => x.id === r.id);
        return staff?.fullName ?? null;
      })
      .filter(Boolean);
    if (people.length > 0) parts.push(people.join(', '));

    if (item.teamsLabel?.trim() && classNames.length === 0) parts.push(item.teamsLabel.trim());
    if (parts.length === 0) {
      if (item.targetType === 'club') return 'Ολόκληρος σύλλογος';
      return item.showTo?.trim() || 'Όλοι';
    }
    return parts.join(' · ');
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setWholeClub(true);
    setSelectedTemplateId('');
    setTemplateName('');
    setError('');
    clearShuttleHighlights();
    setOpen(true);
  }

  function openEdit(item: Announcement) {
    const classIds =
      item.classIds ??
      (item.targetType === 'team' && item.targetId ? [item.targetId] : []);
    const recipients = item.recipientIds ?? [];
    setEditing(item);
    setForm({
      title: item.title,
      message: htmlToPlain(item.message),
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
      classIds,
      recipientIds: recipients,
    });
    setWholeClub(classIds.length === 0 && recipients.length === 0);
    setSelectedTemplateId('');
    setTemplateName('');
    setError('');
    clearShuttleHighlights();
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError('');
    setDragOver(false);
    clearShuttleHighlights();
  }

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      title: template.title,
      message: template.message,
    }));
    setTemplateName(template.name);
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) {
      setError('Συμπληρώστε όνομα προτύπου');
      return;
    }
    if (!form.message.trim()) {
      setError('Το μήνυμα είναι υποχρεωτικό για αποθήκευση προτύπου');
      return;
    }
    setError('');
    const next: MessageTemplate = {
      id: selectedTemplateId || createTemplateId(),
      name,
      title: form.title.trim(),
      message: form.message.trim(),
    };
    const updated = selectedTemplateId
      ? templates.map((t) => (t.id === selectedTemplateId ? next : t))
      : [...templates, next];
    saveTemplates(updated);
    setTemplates(updated);
    setSelectedTemplateId(next.id);
  }

  function readImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Επιλέξτε αρχείο εικόνας.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    readImageFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    readImageFile(file);
  }

  function toggleWholeClub(checked: boolean) {
    setWholeClub(checked);
    clearShuttleHighlights();
    if (checked) {
      setForm((prev) => ({
        ...prev,
        targetType: 'club',
        targetId: null,
        classIds: [],
        recipientIds: [],
        teamsLabel: '',
        showTo: 'Ολόκληρος σύλλογος',
      }));
    }
  }

  async function handleSave() {
    const message = form.message.trim();
    if (!message) {
      setError('Το μήνυμα είναι υποχρεωτικό');
      return;
    }
    if (!form.title.trim()) {
      setError('Ο τίτλος είναι υποχρεωτικός');
      return;
    }
    if (!wholeClub && (form.classIds ?? []).length === 0) {
      setError('Επιλέξτε τουλάχιστον ένα τμήμα ή ολόκληρο τον σύλλογο');
      return;
    }

    setSaving(true);
    setError('');
    const classIds = wholeClub ? [] : form.classIds ?? [];
    const recipientIds = wholeClub ? [] : form.recipientIds ?? [];
    const classNames = data.classes
      .filter((c) => classIds.includes(c.id))
      .map((c) => c.name);
    const peopleLabels = recipientIds
      .map((r) => {
        const s = data.students.find((x) => x.id === r.id);
        return s ? `${s.lastName} ${s.firstName}`.trim() : null;
      })
      .filter(Boolean) as string[];

    const showParts = [
      ...(classNames.length && recipientIds.length === 0 ? classNames : []),
      ...peopleLabels,
    ];

    const payload: AnnouncementInput = {
      ...form,
      title: form.title.trim(),
      message,
      classIds,
      audienceRoles: form.audienceRoles ?? [],
      recipientIds,
      targetType: classIds.length === 1 ? 'team' : 'club',
      targetId: classIds.length === 1 ? classIds[0] : null,
      teamsLabel: classNames.join(', '),
      showTo: wholeClub
        ? 'Ολόκληρος σύλλογος'
        : showParts.join(', ') || classNames.join(', ') || 'Όλοι',
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
              {announcements.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    {item.highPriority ? <Flag size={14} className="ann-priority-icon" /> : null}{' '}
                    {item.title}
                  </td>
                  <td>{describeAudience(item)}</td>
                  <td className="announcement-message-cell">
                    <span>{htmlToPlain(item.message).slice(0, 120)}</span>
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
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal
        open={open}
        title={editing ? 'Επεξεργασία ανακοίνωσης' : 'Νέα ανακοίνωση'}
        onClose={closeModal}
        className="ann-compose-modal ann-compose-modal--wide"
        fullscreen
        footer={
          <>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Δημοσίευση...' : 'Δημοσίευση'}
            </Button>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Ακύρωση
            </Button>
          </>
        }
      >
        <div className="ann-form ann-form--compose">
          <label className="ann-field">
            <span className="ann-label">Πρότυπα μηνυμάτων</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">Επίλεξε πρότυπο...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <label className="ann-field">
            <span className="ann-label">Τίτλος</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <label className="ann-field">
            <span className="ann-label">Μήνυμα</span>
            <textarea
              className="ann-message-textarea"
              rows={7}
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            />
          </label>

          <div className="ann-image-field ann-image-field--compose">
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
              <div
                className={`ann-image-dropzone${dragOver ? ' is-dragover' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <button
                  type="button"
                  className="ann-image-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Πατήστε εδώ ή σύρετε αρχεία...
                </button>
              </div>
            )}
            <p className="ann-hint">Μπορείτε να ανεβάσετε μόνο ένα αρχείο</p>
          </div>

          <div className="ann-field">
            <span className="ann-label">Στόχος</span>
            <select
              value={wholeClub ? 'club' : 'teams'}
              onChange={(e) => {
                const isClub = e.target.value === 'club';
                toggleWholeClub(isClub);
              }}
            >
              <option value="club">Ολόκληρος σύλλογος</option>
              <option value="teams">Συγκεκριμένα τμήματα</option>
            </select>
          </div>

          {!wholeClub ? (
            <div className="ann-shuttle">
              <div className="ann-shuttle-row">
                <div className="ann-shuttle-box">
                  <div className="ann-shuttle-head">Τμήματα</div>
                  <ul className="ann-shuttle-list">
                    {availableClasses.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`ann-shuttle-item${highlightAvailableClasses.includes(item.id) ? ' is-active' : ''}`}
                          onClick={() =>
                            setHighlightAvailableClasses((prev) =>
                              toggleHighlight(prev, item.id),
                            )
                          }
                          onDoubleClick={() => {
                            syncClassSelection([...selectedClassIds, item.id]);
                            setHighlightAvailableClasses([]);
                          }}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="ann-shuttle-actions">
                  <button
                    type="button"
                    className="ann-shuttle-transfer"
                    onClick={moveClassesToSelected}
                    aria-label="Προσθήκη τμημάτων"
                  >
                    {'>>>>'}
                  </button>
                  <button
                    type="button"
                    className="ann-shuttle-transfer"
                    onClick={moveClassesToAvailable}
                    aria-label="Αφαίρεση τμημάτων"
                  >
                    {'<<<<'}
                  </button>
                </div>

                <div className="ann-shuttle-box">
                  <div className="ann-shuttle-head">Για νέα ανακοίνωση</div>
                  <ul className="ann-shuttle-list">
                    {selectedClasses.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`ann-shuttle-item${highlightSelectedClasses.includes(item.id) ? ' is-active' : ''}`}
                          onClick={() =>
                            setHighlightSelectedClasses((prev) =>
                              toggleHighlight(prev, item.id),
                            )
                          }
                          onDoubleClick={() => {
                            syncClassSelection(
                              selectedClassIds.filter((id) => id !== item.id),
                            );
                            setHighlightSelectedClasses([]);
                          }}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="ann-shuttle-row">
                <div className="ann-shuttle-box">
                  <div className="ann-shuttle-head">Αθλητές επιλ. τμημάτων</div>
                  <ul className="ann-shuttle-list">
                    {availableAthletes.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          className={`ann-shuttle-item${highlightAvailableAthletes.includes(person.id) ? ' is-active' : ''}`}
                          onClick={() =>
                            setHighlightAvailableAthletes((prev) =>
                              toggleHighlight(prev, person.id),
                            )
                          }
                          onDoubleClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              recipientIds: [
                                ...(prev.recipientIds ?? []),
                                { kind: 'athlete', id: person.id },
                              ],
                            }));
                            setHighlightAvailableAthletes([]);
                          }}
                        >
                          <span className="ann-shuttle-item-meta">{person.className}</span>
                          <span className="ann-shuttle-item-name">{person.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="ann-shuttle-actions">
                  <button
                    type="button"
                    className="ann-shuttle-transfer"
                    onClick={moveAthletesToSelected}
                    aria-label="Προσθήκη αθλητών"
                  >
                    {'>>>>'}
                  </button>
                  <button
                    type="button"
                    className="ann-shuttle-transfer"
                    onClick={moveAthletesToAvailable}
                    aria-label="Αφαίρεση αθλητών"
                  >
                    {'<<<<'}
                  </button>
                </div>

                <div className="ann-shuttle-box">
                  <div className="ann-shuttle-head">Για ανακοίνωση</div>
                  <ul className="ann-shuttle-list">
                    {selectedAthletes.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          className={`ann-shuttle-item${highlightSelectedAthletes.includes(person.id) ? ' is-active' : ''}`}
                          onClick={() =>
                            setHighlightSelectedAthletes((prev) =>
                              toggleHighlight(prev, person.id),
                            )
                          }
                          onDoubleClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              recipientIds: (prev.recipientIds ?? []).filter(
                                (r) => r.id !== person.id,
                              ),
                            }));
                            setHighlightSelectedAthletes([]);
                          }}
                        >
                          <span className="ann-shuttle-item-meta">{person.className}</span>
                          <span className="ann-shuttle-item-name">{person.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="ann-hint">
                Επίλεξε τμήματα και αθλητές και μετακίνησέ τους με τα βελάκια. Αν δεν επιλέξεις
                αθλητές, η ανακοίνωση πάει σε όλα τα επιλεγμένα τμήματα.
              </p>
            </div>
          ) : null}

          <label className="ann-field">
            <span className="ann-label">Προγραμματισμός αποστολής</span>
            <input
              type="datetime-local"
              value={form.visibleFrom ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, visibleFrom: e.target.value }))
              }
            />
            <span className="ann-hint">Άφησέ το κενό για άμεση δημοσίευση.</span>
          </label>

          <div className="ann-template-save-row">
            <label className="ann-field">
              <span className="ann-label">Όνομα προτύπου</span>
              <input
                value={templateName}
                placeholder="π.χ. Υπενθύμιση προπόνησης"
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </label>
            <Button type="button" variant="secondary" onClick={handleSaveTemplate}>
              Αποθήκευση προτύπου
            </Button>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
