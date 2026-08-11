import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import * as parentsService from '../api/services/parentsService';
import { getSession } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { getPreviewClubId } from '../platform/platformConfig';
import { formatDate } from '../utils/labels';

function generatePassword(): string {
  return `gon${Math.random().toString(36).slice(2, 8)}`;
}

export function ParentsPage() {
  const { data, refresh } = useAppData();
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;

  const [rows, setRows] = useState<parentsService.ParentLinkRow[]>([]);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [athleteId, setAthleteId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const athletes = useMemo(
    () =>
      [...(data.students ?? [])]
        .filter((s) => s.status !== 'inactive')
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'el'),
        ),
    [data.students],
  );

  async function loadRows() {
    if (!clubId) {
      setRows([]);
      return;
    }
    const result = await parentsService.listParentLinks(clubId);
    if (result.success) setRows(result.data ?? []);
  }

  useEffect(() => {
    void loadRows();
  }, [clubId, data.parentLinks, data.students]);

  function openConnect() {
    setFullName('');
    setEmail('');
    setPassword(generatePassword());
    setAthleteId(athletes[0]?.id ?? '');
    setError('');
    setMessage('');
    setOpen(true);
  }

  async function handleConnect() {
    if (!clubId) return;
    setSaving(true);
    setError('');
    setMessage('');
    const result = await parentsService.connectParent({
      clubId,
      fullName,
      email,
      password,
      athleteId,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα σύνδεσης');
      return;
    }
    setOpen(false);
    setMessage('Ο γονέας συνδέθηκε με τον αθλητή.');
    refresh();
    await loadRows();
  }

  async function handleDisconnect(linkId: string) {
    if (!clubId) return;
    if (!confirm('Αποσύνδεση γονέα από τον αθλητή;')) return;
    await parentsService.disconnectParentLink(clubId, linkId);
    refresh();
    await loadRows();
  }

  if (!clubId) {
    return <p className="form-error">Δεν βρέθηκε σύλλογος για τον λογαριασμό.</p>;
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Γονείς"
        actions={
          <Button type="button" onClick={openConnect}>
            <Plus size={16} /> Σύνδεση γονέα
          </Button>
        }
      />

      {message ? <p className="settings-success">{message}</p> : null}

      <section className="panel parents-panel">
        <h2>Λογαριασμοί γονέων συνδεδεμένοι με αθλητές</h2>
        {rows.length === 0 ? (
          <p className="muted parents-empty">Δεν υπάρχουν στοιχεία γονέων.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Γονέας</th>
                  <th>Email</th>
                  <th>Αθλητής</th>
                  <th>Ημ/νία</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.linkId}>
                    <td>
                      <strong>{row.parentName}</strong>
                    </td>
                    <td>{row.parentEmail}</td>
                    <td>{row.athleteName}</td>
                    <td>{formatDate(row.createdAt.slice(0, 10))}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleDisconnect(row.linkId)}
                        aria-label="Αποσύνδεση"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={open}
        title="Σύνδεση γονέα"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Άκυρο
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleConnect()}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="stack-md">
          <label className="field">
            <span className="field-label">Ονοματεπώνυμο γονέα</span>
            <input
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Κωδικός</span>
            <input
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Αθλητής</span>
            <select
              className="field-input"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
            >
              <option value="">Επιλέξτε…</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.lastName} {athlete.firstName}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
