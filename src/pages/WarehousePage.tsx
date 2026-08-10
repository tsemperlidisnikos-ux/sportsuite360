import { useMemo, useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import * as productsService from '../api/services/productsService';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { PRODUCT_CATEGORIES, type WarehouseProductInput } from '../schemas';
import type { ProductSizeGroup, WarehouseProduct } from '../types';
import { formatCurrency } from '../utils/labels';
import {
  formatProductSize,
  sizeChartOptGroups,
  type SizeChartGroupId,
} from '../utils/sizeChartOptions';

const emptyForm: WarehouseProductInput = {
  name: '',
  category: '',
  sku: '',
  salePrice: 0,
  size: '',
  sizeGroup: '',
  notes: '',
};

function encodeSizeValue(group: SizeChartGroupId, size: string): string {
  return `${group}::${size}`;
}

function parseSizeValue(value: string): { sizeGroup: ProductSizeGroup | ''; size: string } {
  if (!value) return { sizeGroup: '', size: '' };
  const sep = value.indexOf('::');
  if (sep === -1) return { sizeGroup: '', size: value };
  const group = value.slice(0, sep);
  const size = value.slice(sep + 2);
  if (group === 'kids' || group === 'adult') {
    return { sizeGroup: group, size };
  }
  return { sizeGroup: '', size };
}

export function WarehousePage() {
  const { data, refresh } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseProduct | null>(null);
  const [form, setForm] = useState<WarehouseProductInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const products = useMemo(
    () =>
      [...(data.products ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'el')),
    [data.products],
  );

  const sizeOptions = useMemo(() => {
    const groups = sizeChartOptGroups(data.sizeChart);
    const keys = new Set(
      groups.flatMap((g) => g.sizes.map((s) => encodeSizeValue(g.category, s).toUpperCase())),
    );
    const currentSize = form.size.trim();
    const currentGroup = (form.sizeGroup || '') as SizeChartGroupId | '';
    if (currentSize && currentGroup) {
      const key = encodeSizeValue(currentGroup, currentSize).toUpperCase();
      if (!keys.has(key)) {
        return [
          ...groups,
          {
            category: currentGroup,
            label: 'Τρέχον',
            sizes: [currentSize],
          },
        ];
      }
    } else if (currentSize) {
      const inChart = groups.some((g) =>
        g.sizes.some((s) => s.toUpperCase() === currentSize.toUpperCase()),
      );
      if (!inChart) {
        return [
          ...groups,
          { category: 'adult' as const, label: 'Τρέχον', sizes: [currentSize] },
        ];
      }
    }
    return groups;
  }, [data.sizeChart, form.size, form.sizeGroup]);

  const selectedSizeValue = useMemo(() => {
    if (!form.size) return '';
    if (form.sizeGroup === 'kids' || form.sizeGroup === 'adult') {
      return encodeSizeValue(form.sizeGroup, form.size);
    }
    const match = sizeOptions.find((g) =>
      g.sizes.some((s) => s.toUpperCase() === form.size.trim().toUpperCase()),
    );
    if (match) {
      const size =
        match.sizes.find((s) => s.toUpperCase() === form.size.trim().toUpperCase()) ?? form.size;
      return encodeSizeValue(match.category, size);
    }
    return form.size;
  }, [form.size, form.sizeGroup, sizeOptions]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(product: WarehouseProduct) {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      sku: product.sku ?? '',
      salePrice: product.salePrice,
      size: product.size ?? '',
      sizeGroup: product.sizeGroup ?? '',
      notes: product.notes ?? '',
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
      ? await productsService.updateProduct(editing.id, form)
      : await productsService.createProduct(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    closeModal();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή προϊόντος;')) return;
    await productsService.deleteProduct(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Αποθήκη"
        subtitle="Προϊόντα, τιμές και αποθέματα ακαδημίας."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Προσθήκη προϊόντος
          </Button>
        }
      />

      <section className="panel table-wrap">
        {products.length === 0 ? (
          <div className="empty-state">
            <Package size={28} />
            <h3>Δεν υπάρχουν προϊόντα</h3>
            <p>Πάτα «Προσθήκη προϊόντος» για να καταχωρήσεις το πρώτο.</p>
            <Button type="button" onClick={openCreate}>
              <Plus size={16} /> Προσθήκη προϊόντος
            </Button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Όνομα</th>
                <th>Κατηγορία</th>
                <th>SKU</th>
                <th>Μέγεθος</th>
                <th>Τιμή πώλησης</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.notes ? (
                      <div className="match-print-details">{item.notes}</div>
                    ) : null}
                  </td>
                  <td>{item.category || '—'}</td>
                  <td>{item.sku || '—'}</td>
                  <td>{formatProductSize(item.size, item.sizeGroup)}</td>
                  <td>{formatCurrency(item.salePrice)}</td>
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

      <Modal
        open={open}
        title={editing ? 'Επεξεργασία προϊόντος' : 'Προσθήκη προϊόντος'}
        onClose={closeModal}
        wide
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeModal}>
              Άκυρο
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="product-form">
          <div className="product-form-row product-form-row--2">
            <label className="field">
              <span className="field-label">
                Όνομα <span className="req">*</span>
              </span>
              <input
                className="field-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">
                Κατηγορία <span className="req">*</span>
              </span>
              <select
                className="field-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                <option value="">—</option>
                {PRODUCT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="product-form-row product-form-row--3">
            <label className="field">
              <span className="field-label">SKU</span>
              <input
                className="field-input"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">
                Τιμή πώλησης <span className="req">*</span>
              </span>
              <input
                className="field-input"
                type="number"
                min={0}
                step="0.01"
                value={form.salePrice || ''}
                onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Μέγεθος</span>
              <select
                className="field-input"
                value={selectedSizeValue}
                onChange={(e) => {
                  const parsed = parseSizeValue(e.target.value);
                  setForm({
                    ...form,
                    size: parsed.size,
                    sizeGroup: parsed.sizeGroup,
                  });
                }}
              >
                <option value="">—</option>
                {sizeOptions.map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.sizes.map((size) => (
                      <option
                        key={`${group.category}-${size}`}
                        value={encodeSizeValue(group.category, size)}
                      >
                        {size}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Σημειώσεις</span>
            <textarea
              className="field-input"
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
