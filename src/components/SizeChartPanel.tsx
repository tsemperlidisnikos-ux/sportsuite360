import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import * as sizeChartService from '../api/services/sizeChartService';
import { Button } from './ui/Button';
import { useAppData } from '../hooks/useAppData';
import type { SizeChart, SizeChartCategory } from '../types';

const CATEGORY_LABELS: Record<SizeChartCategory, string> = {
  kids: 'ΠΑΙΔΙΚΟ',
  men: 'ΑΝΔΡΙΚΟ',
  women: 'ΓΥΝΑΙΚΕΙΟ',
};

const CATEGORIES: SizeChartCategory[] = ['kids', 'men', 'women'];

function emptyChart(): SizeChart {
  return { kids: [], men: [], women: [] };
}

export function SizeChartPanel() {
  const { data, refresh } = useAppData();
  const [draft, setDraft] = useState<SizeChart>(() => data.sizeChart ?? emptyChart());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingFor, setAddingFor] = useState<SizeChartCategory | null>(null);
  const [newSize, setNewSize] = useState('');

  useEffect(() => {
    setDraft(data.sizeChart ?? emptyChart());
  }, [data.sizeChart]);

  function removeSize(category: SizeChartCategory, size: string) {
    setDraft((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item !== size),
    }));
    setMessage('');
  }

  function startAdd(category: SizeChartCategory) {
    setAddingFor(category);
    setNewSize('');
    setError('');
  }

  function confirmAdd() {
    if (!addingFor) return;
    const value = newSize.trim().toUpperCase();
    if (!value) {
      setError('Συμπληρώστε μέγεθος');
      return;
    }
    if (draft[addingFor].some((item) => item.toUpperCase() === value)) {
      setError('Το μέγεθος υπάρχει ήδη σε αυτή την κατηγορία');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      [addingFor]: [...prev[addingFor], value],
    }));
    setAddingFor(null);
    setNewSize('');
    setError('');
    setMessage('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    const result = await sizeChartService.saveSizeChart(draft);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setMessage('Το μεγεθολόγιο αποθηκεύτηκε.');
    refresh();
  }

  function handlePrintArchive() {
    window.print();
  }

  return (
    <section className="panel size-chart-panel">
      <div className="size-chart-header">
        <div>
          <h2>Μεγεθολόγιο</h2>
          <p>Ρουχισμός/Μεγέθη</p>
        </div>
        <div className="size-chart-actions">
          <button type="button" className="size-chart-link" onClick={handlePrintArchive}>
            <FileText size={15} /> Μεγεθολόγιο/Αρχείο
          </button>
          <button
            type="button"
            className="size-chart-link"
            onClick={() => startAdd(addingFor ?? 'kids')}
          >
            <Plus size={15} /> Προσθήκη μεγεθών
          </button>
        </div>
      </div>

      {addingFor ? (
        <div className="size-chart-add-row">
          <span>Νέο μέγεθος για {CATEGORY_LABELS[addingFor]}:</span>
          <select
            value={addingFor}
            onChange={(e) => setAddingFor(e.target.value as SizeChartCategory)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <input
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            placeholder="π.χ. XL"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmAdd();
              }
            }}
          />
          <Button type="button" onClick={confirmAdd}>
            Προσθήκη
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAddingFor(null)}>
            Άκυρο
          </Button>
        </div>
      ) : null}

      <div className="size-chart-grid">
        {CATEGORIES.map((category) => (
          <div key={category} className="size-chart-column">
            <h3>{CATEGORY_LABELS[category]}</h3>
            <ul>
              {draft[category].length === 0 ? (
                <li className="size-chart-empty">Δεν υπάρχουν μεγέθη</li>
              ) : (
                draft[category].map((size) => (
                  <li key={size}>
                    <span>{size}</span>
                    <button
                      type="button"
                      className="size-chart-delete"
                      onClick={() => removeSize(category, size)}
                    >
                      Διαγραφή
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              className="size-chart-add-inline"
              onClick={() => startAdd(category)}
            >
              + Προσθήκη
            </button>
          </div>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      <div className="size-chart-footer">
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </Button>
      </div>
    </section>
  );
}
