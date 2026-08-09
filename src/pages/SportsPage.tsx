import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import * as sportsService from '../api/services/sportsService';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { SportItemInput } from '../schemas';
import type { SportItem } from '../types';

const emptyForm: SportItemInput = {
  name: '',
  active: true,
};

export function SportsPage() {
  const { data, refresh } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SportItem | null>(null);
  const [form, setForm] = useState<SportItemInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const sports = useMemo(() => data.sports ?? [], [data.sports]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(item: SportItem) {
    setEditing(item);
    setForm({
      name: item.name,
      active: item.active,
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
      ? await sportsService.updateSport(editing.id, form)
      : await sportsService.createSport(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    closeModal();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή αθλήματος;')) return;
    await sportsService.deleteSport(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Άθλημα"
        subtitle="Αθλήματα που προσφέρει η ακαδημία."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Νέο άθλημα
          </Button>
        }
      />

      <section className="panel table-wrap">
        {sports.length === 0 ? (
          <div className="empty-state">
            <h3>Δεν υπάρχουν αθλήματα</h3>
            <p>Πρόσθεσε το πρώτο άθλημα.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Όνομα</th>
                <th>Κατάσταση</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sports.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <span className={`badge ${item.active ? 'badge-active' : 'badge-inactive'}`}>
                      {item.active ? 'Ενεργό' : 'Ανενεργό'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openEdit(item)}
                      aria-label="Επεξεργασία"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleDelete(item.id)}
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
            <h2>{editing ? 'Επεξεργασία αθλήματος' : 'Νέο άθλημα'}</h2>
            <div className="training-modal-fields">
              <label>
                <span>Όνομα</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                <span>Κατάσταση</span>
                <select
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                >
                  <option value="true">Ενεργό</option>
                  <option value="false">Ανενεργό</option>
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
