import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import * as sizeChartService from '../api/services/sizeChartService';
import { Button } from './ui/Button';
import { useAppData } from '../hooks/useAppData';
import type { SizeChart } from '../types';
import {
  SIZE_CHART_GROUP_LABELS,
  adultSizesFromChart,
  type SizeChartGroupId,
} from '../utils/sizeChartOptions';

const GROUPS: SizeChartGroupId[] = ['kids', 'adult'];

function emptyChart(): SizeChart {
  return { kids: [], men: [], women: [] };
}

function toDraft(chart: SizeChart | undefined | null): SizeChart {
  const base = chart ?? emptyChart();
  const adult = adultSizesFromChart(base);
  return {
    kids: [...(base.kids ?? [])],
    men: [...adult],
    women: [...adult],
  };
}

export function SizeChartPanel() {
  const { data, refresh } = useAppData();
  const [draft, setDraft] = useState<SizeChart>(() => toDraft(data.sizeChart));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingFor, setAddingFor] = useState<SizeChartGroupId | null>(null);
  const [newSize, setNewSize] = useState('');

  useEffect(() => {
    setDraft(toDraft(data.sizeChart));
  }, [data.sizeChart]);

  const lists = useMemo(
    () => ({
      kids: draft.kids,
      adult: adultSizesFromChart(draft),
    }),
    [draft],
  );

  function removeSize(group: SizeChartGroupId, size: string) {
    setDraft((prev) => {
      if (group === 'kids') {
        return {
          ...prev,
          kids: prev.kids.filter((item) => item !== size),
        };
      }
      const nextAdult = adultSizesFromChart(prev).filter((item) => item !== size);
      return { ...prev, men: nextAdult, women: nextAdult };
    });
    setMessage('');
  }

  function startAdd(group: SizeChartGroupId) {
    setAddingFor(group);
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
    const existing = lists[addingFor];
    if (existing.some((item) => item.toUpperCase() === value)) {
      setError('Το μέγεθος υπάρχει ήδη σε αυτή την κατηγορία');
      return;
    }
    setDraft((prev) => {
      if (addingFor === 'kids') {
        return { ...prev, kids: [...prev.kids, value] };
      }
      const nextAdult = [...adultSizesFromChart(prev), value];
      return { ...prev, men: nextAdult, women: nextAdult };
    });
    setAddingFor(null);
    setNewSize('');
    setError('');
    setMessage('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    const adult = adultSizesFromChart(draft);
    const result = await sizeChartService.saveSizeChart({
      kids: [...draft.kids],
      men: [...adult],
      women: [...adult],
    });
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
          <span>Νέο μέγεθος για {SIZE_CHART_GROUP_LABELS[addingFor]}:</span>
          <select
            value={addingFor}
            onChange={(e) => setAddingFor(e.target.value as SizeChartGroupId)}
          >
            {GROUPS.map((group) => (
              <option key={group} value={group}>
                {SIZE_CHART_GROUP_LABELS[group]}
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

      <div className="size-chart-grid size-chart-grid--2">
        {GROUPS.map((group) => (
          <div key={group} className="size-chart-column">
            <h3>{SIZE_CHART_GROUP_LABELS[group]}</h3>
            <ul>
              {lists[group].length === 0 ? (
                <li className="size-chart-empty">Δεν υπάρχουν μεγέθη</li>
              ) : (
                lists[group].map((size) => (
                  <li key={size}>
                    <span>{size}</span>
                    <button
                      type="button"
                      className="size-chart-delete"
                      onClick={() => removeSize(group, size)}
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
              onClick={() => startAdd(group)}
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
