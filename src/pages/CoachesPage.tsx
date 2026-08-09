import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import * as coachesService from '../api/services/coachesService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useAppData } from '../hooks/useAppData';
import type { CoachInput } from '../schemas';
import type { Coach } from '../types';
import { formatDate } from '../utils/labels';

const emptyForm: CoachInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  sport: '',
  active: true,
};

export function CoachesPage() {
  const { data, refresh } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState<CoachInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const sportOptions = useMemo(
    () => [
      { value: '', label: 'Επιλέξτε άθλημα' },
      ...(data.sports ?? [])
        .filter((s) => s.active)
        .map((s) => ({ value: s.name, label: s.name })),
    ],
    [data.sports],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(coach: Coach) {
    setEditing(coach);
    setForm({
      firstName: coach.firstName,
      lastName: coach.lastName,
      email: coach.email,
      phone: coach.phone,
      sport: coach.sport ?? '',
      active: coach.active,
    });
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = editing
      ? await coachesService.updateCoach(editing.id, form)
      : await coachesService.createCoach(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα');
      return;
    }
    setOpen(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή προπονητή;')) return;
    await coachesService.deleteCoach(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Προπονητές"
        subtitle="Προσωπικό προπονητών ανά άθλημα."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Νέος προπονητής
          </Button>
        }
      />

      <section className="panel table-wrap">
        {data.coaches.length === 0 ? (
          <div className="empty-state">
            <h3>Δεν υπάρχουν προπονητές</h3>
            <p>Πάτα «Νέος προπονητής» για να προσθέσεις τον πρώτο.</p>
            <Button type="button" onClick={openCreate}>
              <Plus size={16} /> Νέος προπονητής
            </Button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ονοματεπώνυμο</th>
                <th>Άθλημα</th>
                <th>Email</th>
                <th>Τηλέφωνο</th>
                <th>Κατάσταση</th>
                <th>Πρόσληψη</th>
                <th>Τμήματα</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.coaches.map((coach) => {
                const assigned = data.classes.filter((c) => c.coachId === coach.id);
                return (
                  <tr key={coach.id}>
                    <td>
                      <strong>
                        {coach.firstName} {coach.lastName}
                      </strong>
                    </td>
                    <td>{coach.sport || '—'}</td>
                    <td>{coach.email}</td>
                    <td>{coach.phone || '—'}</td>
                    <td>
                      <span className={`badge ${coach.active ? 'badge-active' : 'badge-inactive'}`}>
                        {coach.active ? 'Ενεργός' : 'Ανενεργός'}
                      </span>
                    </td>
                    <td>{formatDate(coach.hireDate)}</td>
                    <td>{assigned.map((c) => c.name).join(', ') || '—'}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => openEdit(coach)}
                        aria-label="Επεξεργασία"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleDelete(coach.id)}
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

      <Modal
        open={open}
        title={editing ? 'Επεξεργασία προπονητή' : 'Νέος προπονητής'}
        onClose={() => setOpen(false)}
        footer={
          <>
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
          <Input
            label="Όνομα"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <Input
            label="Επώνυμο"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Τηλέφωνο"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select
            label="Άθλημα"
            value={form.sport}
            onChange={(e) => setForm({ ...form, sport: e.target.value })}
            options={sportOptions}
          />
          <Select
            label="Κατάσταση"
            value={form.active ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
            options={[
              { value: 'true', label: 'Ενεργός' },
              { value: 'false', label: 'Ανενεργός' },
            ]}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </Modal>
    </div>
  );
}
