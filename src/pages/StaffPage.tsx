import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import * as staffService from '../api/services/staffService';
import type { StaffInput } from '../api/services/staffService';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { StaffMember } from '../types';
import { formatDate } from '../utils/labels';

const roleLabels: Record<StaffMember['role'], string> = {
  admin: 'Διαχειριστής',
  coach: 'Προπονητής',
  secretariat: 'Γραμματεία',
};

const emptyForm: StaffInput = {
  fullName: '',
  email: '',
  phone: '',
  role: 'coach',
  active: true,
};

export function StaffPage() {
  const { data, refresh } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const staff = useMemo(
    () => (data.staff ?? []).filter((member) => member.active),
    [data.staff],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setForm({
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      role: member.role,
      active: member.active,
    });
    setError('');
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = editing
      ? await staffService.updateStaff(editing.id, form)
      : await staffService.createStaff(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    closeModal();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή μέλους προσωπικού;')) return;
    await staffService.deleteStaff(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Προσωπικό"
        subtitle="Διαχειριστές, προπονητές και γραμματεία του συλλόγου."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Προσθήκη προσωπικού
          </Button>
        }
      />

      <section className="panel table-wrap">
        {staff.length === 0 ? (
          <div className="empty-state">
            <h3>Δεν υπάρχει προσωπικό</h3>
            <p>Πρόσθεσε το πρώτο μέλος προσωπικού.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ονοματεπώνυμο</th>
                <th>Email</th>
                <th>Τηλέφωνο</th>
                <th>Ρόλος</th>
                <th>Κατάσταση</th>
                <th>Πρόσληψη</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.fullName}</strong>
                  </td>
                  <td>{member.email}</td>
                  <td>{member.phone || '—'}</td>
                  <td>{roleLabels[member.role]}</td>
                  <td>
                    <span className={`badge ${member.active ? 'badge-active' : 'badge-inactive'}`}>
                      {member.active ? 'Ενεργός' : 'Ανενεργός'}
                    </span>
                  </td>
                  <td>{formatDate(member.hireDate)}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openEdit(member)}
                      aria-label="Επεξεργασία"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleDelete(member.id)}
                      aria-label="Διαγραφή"
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

      {open ? (
        <div className="training-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="training-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editing ? 'Επεξεργασία προσωπικού' : 'Νέο μέλος προσωπικού'}</h2>
            <div className="training-modal-fields">
              <label>
                <span>Ονοματεπώνυμο</span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                <span>Τηλέφωνο</span>
                <input
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                <span>Ρόλος</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as StaffMember['role'],
                    })
                  }
                >
                  <option value="admin">Διαχειριστής</option>
                  <option value="coach">Προπονητής</option>
                  <option value="secretariat">Γραμματεία</option>
                </select>
              </label>
              <label>
                <span>Κατάσταση</span>
                <select
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                >
                  <option value="true">Ενεργός</option>
                  <option value="false">Ανενεργός</option>
                </select>
              </label>
              {error ? <p className="form-error">{error}</p> : null}
            </div>
            <div className="training-modal-actions">
              <button
                type="button"
                className="training-btn-save"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                Αποθήκευση
              </button>
              <button type="button" className="training-btn-cancel" onClick={closeModal}>
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
