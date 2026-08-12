import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import * as publicClubCloudService from '../api/services/publicClubCloudService';
import * as registrationApplicationsService from '../api/services/registrationApplicationsService';
import * as studentsService from '../api/services/studentsService';
import { getSession } from '../auth/auth';
import { AthletesIcon } from '../components/icons/AthletesIcon';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { getPreviewClubId } from '../platform/platformConfig';
import type { StudentInput } from '../schemas';
import type { RegistrationApplication, RegistrationApplicationKind } from '../types';
import { studentStatusLabels } from '../utils/labels';

const draftAthlete: StudentInput = {
  firstName: 'ΝΕΟΣ',
  lastName: 'ΑΘΛΗΤΗΣ',
  email: '',
  phone: '',
  birthDate: '',
  guardianName: '',
  guardianPhone: '',
  classId: null,
  status: 'active',
  monthlyFee: 0,
  amka: '',
  gender: '',
  fatherFirstName: '',
  motherFirstName: '',
  fatherEmail: '',
  motherEmail: '',
  motherPhone: '',
  address: '',
  postalCode: '',
  city: '',
  clubName: '',
  registrationNumber: '',
  sport: '',
  healthCard: false,
  healthCardExpires: '',
  consentExpires: '',
  uniformReceived: false,
  uniformSize: '',
  registrationFee: 0,
  registrationCharge: true,
  monthlyCharge: true,
  seasonTicket: false,
  subscriptionDiscount: false,
  discountAmount: 0,
  discountReason: '',
  comments: '',
  photoUrl: null,
  gdprConsent: 'pending',
};

type EditDraft = {
  firstName: string;
  lastName: string;
  guardianName: string;
  guardianPhone: string;
  email: string;
  classId: string;
  kind: RegistrationApplicationKind;
  notes: string;
};

function applicationKindLabel(kind: RegistrationApplication['kind']): string {
  if (kind === 'trial') return 'Δοκιμαστική';
  if (kind === 'waitlist') return 'Λίστα αναμονής';
  return 'Πλήρης εγγραφή';
}

function toEditDraft(app: RegistrationApplication): EditDraft {
  return {
    firstName: app.firstName,
    lastName: app.lastName,
    guardianName: app.guardianName,
    guardianPhone: app.guardianPhone,
    email: app.email || '',
    classId: app.classId || '',
    kind: app.kind,
    notes: app.notes || '',
  };
}

export function StudentsPage() {
  const navigate = useNavigate();
  const { data, refresh } = useAppData();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [appMessage, setAppMessage] = useState('');
  const [appError, setAppError] = useState('');

  useEffect(() => {
    const clubId = getSession()?.clubId ?? getPreviewClubId();
    if (!clubId) return;
    void publicClubCloudService.pullRemoteRegistrationApplications(clubId).then((result) => {
      if (result.success && (result.data?.merged ?? 0) > 0) {
        refresh();
        setAppMessage(`Συγχρονίστηκαν ${result.data!.merged} νέες αιτήσεις από το cloud.`);
      }
    });
  }, [refresh]);

  const pendingApplications = useMemo(
    () =>
      (data.registrationApplications ?? []).filter((app) => app.status === 'pending'),
    [data.registrationApplications],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students.filter((s) => {
      if (s.status === 'inactive') return false;
      if (!q) return true;
      const hay = `${s.firstName} ${s.lastName} ${s.email} ${s.guardianName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.students, query]);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    const result = await studentsService.createStudent(draftAthlete);
    setCreating(false);
    if (!result.success || !result.data) {
      window.alert(result.error ?? 'Αποτυχία δημιουργίας αθλητή');
      return;
    }
    refresh();
    navigate(`/athletes/${result.data.id}`, { state: { editing: true } });
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή αθλητή;')) return;
    await studentsService.deleteStudent(id);
    refresh();
  }

  function startEdit(app: RegistrationApplication) {
    setEditingAppId(app.id);
    setEditDraft(toEditDraft(app));
    setAppError('');
    setAppMessage('');
  }

  function cancelEdit() {
    setEditingAppId(null);
    setEditDraft(null);
  }

  async function handleSaveEdit(appId: string) {
    if (!editDraft || busyAppId) return;
    setBusyAppId(appId);
    setAppError('');
    setAppMessage('');
    const result = await registrationApplicationsService.updateRegistrationApplication(appId, {
      firstName: editDraft.firstName,
      lastName: editDraft.lastName,
      guardianName: editDraft.guardianName,
      guardianPhone: editDraft.guardianPhone,
      email: editDraft.email,
      classId: editDraft.classId || null,
      kind: editDraft.kind,
      notes: editDraft.notes,
    });
    setBusyAppId(null);
    if (!result.success) {
      setAppError(result.error ?? 'Αποτυχία αποθήκευσης αίτησης');
      return;
    }
    refresh();
    cancelEdit();
    setAppMessage('Η αίτηση ενημερώθηκε.');
  }

  async function handleApprove(appId: string, force = false) {
    if (busyAppId) return;
    setBusyAppId(appId);
    setAppError('');
    setAppMessage('');
    const result = await registrationApplicationsService.approveRegistrationApplication(appId, {
      force,
    });
    setBusyAppId(null);
    if (!result.success || !result.data) {
      const err = result.error ?? 'Αποτυχία έγκρισης';
      if (!force && err.includes('διπλότυπο')) {
        const ok = window.confirm(`${err}\n\nΘέλετε να συνεχίσετε την έγκριση;`);
        if (ok) {
          await handleApprove(appId, true);
          return;
        }
      }
      setAppError(err);
      return;
    }
    refresh();
    cancelEdit();
    const athleteId = result.data.athleteId;
    setAppMessage('Η αίτηση εγκρίθηκε και καταχωρήθηκε στους αθλητές.');
    if (athleteId) {
      navigate(`/athletes/${athleteId}`, { state: { editing: true } });
    }
  }

  async function handleReject(appId: string) {
    if (busyAppId) return;
    if (!confirm('Απόρριψη αίτησης;')) return;
    setBusyAppId(appId);
    setAppError('');
    setAppMessage('');
    const result = await registrationApplicationsService.rejectRegistrationApplication(appId);
    setBusyAppId(null);
    if (!result.success) {
      setAppError(result.error ?? 'Αποτυχία απόρριψης');
      return;
    }
    refresh();
    cancelEdit();
    setAppMessage('Η αίτηση απορρίφθηκε.');
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Αθλητές"
        subtitle="Μητρώο αθλητών, κηδεμόνες και σύνδεση με τμήματα."
        actions={
          <Button type="button" disabled={creating} onClick={() => void handleCreate()}>
            <Plus size={16} /> {creating ? 'Δημιουργία...' : 'Νέος αθλητής'}
          </Button>
        }
      />

      {pendingApplications.length > 0 ? (
        <section className="panel registration-apps-panel">
          <div className="registration-apps-head">
            <h3>Εκκρεμείς αιτήσεις εγγραφής</h3>
            <span className="badge badge-pending">{pendingApplications.length}</span>
          </div>
          <p className="lede">
            Από δημόσια φόρμα. Μπορείτε να επεξεργαστείτε τμήμα/τύπο πριν την έγκριση.
          </p>
          {appError ? <p className="form-error">{appError}</p> : null}
          {appMessage ? <p className="settings-success">{appMessage}</p> : null}
          <div className="registration-apps-list">
            {pendingApplications.map((app) => {
              const cls = data.classes.find((c) => c.id === app.classId);
              const busy = busyAppId === app.id;
              const editing = editingAppId === app.id && editDraft;
              return (
                <article key={app.id} className="registration-app-card">
                  {editing ? (
                    <div className="registration-app-edit">
                      <div className="public-join-grid">
                        <label className="field">
                          <span className="field-label">Όνομα</span>
                          <input
                            className="field-input"
                            value={editDraft.firstName}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, firstName: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Επώνυμο</span>
                          <input
                            className="field-input"
                            value={editDraft.lastName}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, lastName: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Κηδεμόνας</span>
                          <input
                            className="field-input"
                            value={editDraft.guardianName}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, guardianName: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Τηλέφωνο</span>
                          <input
                            className="field-input"
                            value={editDraft.guardianPhone}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, guardianPhone: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Email</span>
                          <input
                            className="field-input"
                            value={editDraft.email}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, email: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Τμήμα</span>
                          <select
                            className="field-input"
                            value={editDraft.classId}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, classId: e.target.value })
                            }
                          >
                            <option value="">—</option>
                            {data.classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">Τύπος</span>
                          <select
                            className="field-input"
                            value={editDraft.kind}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                kind: e.target.value as RegistrationApplicationKind,
                              })
                            }
                          >
                            <option value="full">Πλήρης εγγραφή</option>
                            <option value="trial">Δοκιμαστική</option>
                            <option value="waitlist">Λίστα αναμονής</option>
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">Σχόλια</span>
                          <input
                            className="field-input"
                            value={editDraft.notes}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, notes: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="row-actions registration-app-edit-actions">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSaveEdit(app.id)}
                        >
                          Αποθήκευση αλλαγών
                        </Button>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleApprove(app.id)}
                        >
                          <Check size={16} /> Έγκριση
                        </Button>
                        <Button type="button" variant="secondary" onClick={cancelEdit}>
                          Ακύρωση
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="registration-app-card-grid">
                        <div>
                          <strong>
                            {app.lastName} {app.firstName}
                          </strong>
                          {app.email ? <div className="muted">{app.email}</div> : null}
                          {app.notes ? <div className="muted">{app.notes}</div> : null}
                        </div>
                        <div>
                          <span className="muted">Κηδεμόνας</span>
                          <div>{app.guardianName}</div>
                          <div className="muted">{app.guardianPhone}</div>
                        </div>
                        <div>
                          <span className="muted">Τμήμα</span>
                          <div>{cls?.name ?? '—'}</div>
                        </div>
                        <div>
                          <span className="muted">Τύπος / Ημ/νία</span>
                          <div>{applicationKindLabel(app.kind)}</div>
                          <div className="muted">{(app.createdAt || '').slice(0, 10) || '—'}</div>
                        </div>
                      </div>
                      <div className="row-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy || Boolean(busyAppId)}
                          onClick={() => startEdit(app)}
                        >
                          <Pencil size={16} /> Επεξεργασία
                        </Button>
                        <Button
                          type="button"
                          disabled={busy || Boolean(busyAppId)}
                          onClick={() => void handleApprove(app.id)}
                        >
                          <Check size={16} /> {busy ? '…' : 'Έγκριση'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy || Boolean(busyAppId)}
                          onClick={() => void handleReject(app.id)}
                        >
                          <X size={16} /> Απόρριψη
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση αθλητή ή κηδεμόνα..."
          />
        </label>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αθλητής</th>
              <th>Τμήμα</th>
              <th>Κηδεμόνας</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => {
              const cls = data.classes.find((c) => c.id === student.classId);
              return (
                <tr
                  key={student.id}
                  className="clickable-row"
                  onClick={() => navigate(`/athletes/${student.id}`)}
                >
                  <td>
                    <div className="athlete-cell">
                      <span className="athlete-avatar" aria-hidden="true">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt="" />
                        ) : (
                          <AthletesIcon size={22} />
                        )}
                      </span>
                      <div>
                        <Link
                          to={`/athletes/${student.id}`}
                          className="athlete-name-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <strong>
                            {student.lastName} {student.firstName}
                          </strong>
                        </Link>
                        <div className="muted">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{cls?.name ?? '—'}</td>
                  <td>
                    {student.guardianName}
                    <div className="muted">{student.guardianPhone}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${student.status}`}>
                      {studentStatusLabels[student.status]}
                    </span>
                  </td>
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        navigate(`/athletes/${student.id}`, { state: { editing: true } })
                      }
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => void handleDelete(student.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
