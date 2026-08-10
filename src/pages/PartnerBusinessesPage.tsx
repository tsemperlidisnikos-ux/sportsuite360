import { useMemo, useState } from 'react';
import { Building2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import * as partnerService from '../api/services/partnerBusinessesService';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { PartnerBusinessInput, PartnerOfferInput } from '../schemas';
import type { PartnerBusiness, PartnerOffer, PartnerStatus } from '../types';
import { localDateIso } from '../utils/dates';

type Tab = 'businesses' | 'offers' | 'sponsors';

const STATUS_LABELS: Record<PartnerStatus, string> = {
  active: 'Ενεργή',
  inactive: 'Ανενεργή',
};

const emptyBusiness: PartnerBusinessInput = {
  name: '',
  url: '',
  status: 'active',
  categories: '',
  isSponsor: false,
};

const emptyOffer: PartnerOfferInput = {
  name: '',
  businessId: '',
  status: 'active',
};

function formatDate(value: string): string {
  if (!value) return '—';
  const datePart = value.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function PartnerBusinessesPage() {
  const { data, refresh } = useAppData();
  const [tab, setTab] = useState<Tab>('businesses');

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);

  const [businessOpen, setBusinessOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<PartnerBusiness | null>(null);
  const [businessForm, setBusinessForm] = useState<PartnerBusinessInput>(emptyBusiness);
  const [businessError, setBusinessError] = useState('');
  const [businessSaving, setBusinessSaving] = useState(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<PartnerOffer | null>(null);
  const [offerForm, setOfferForm] = useState<PartnerOfferInput>(emptyOffer);
  const [offerError, setOfferError] = useState('');
  const [offerSaving, setOfferSaving] = useState(false);

  const [sponsorsOpen, setSponsorsOpen] = useState(false);
  const [sponsorDraft, setSponsorDraft] = useState<string[]>([]);
  const [sponsorsSaving, setSponsorsSaving] = useState(false);

  const businesses = useMemo(
    () => [...(data.partnerBusinesses ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'el')),
    [data.partnerBusinesses],
  );
  const offers = useMemo(
    () =>
      [...(data.partnerOffers ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.partnerOffers],
  );
  const businessById = useMemo(
    () => new Map(businesses.map((item) => [item.id, item])),
    [businesses],
  );
  const offerCountByBusiness = useMemo(() => {
    const map = new Map<string, number>();
    for (const offer of offers) {
      map.set(offer.businessId, (map.get(offer.businessId) ?? 0) + 1);
    }
    return map;
  }, [offers]);

  const filteredBusinesses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cat = appliedCategory.trim().toLowerCase();
    return businesses.filter((item) => {
      if (appliedStatus && item.status !== appliedStatus) return false;
      if (cat && !item.categories.toLowerCase().includes(cat)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.categories.toLowerCase().includes(q) ||
        item.lastModifiedBy.toLowerCase().includes(q)
      );
    });
  }, [businesses, search, appliedStatus, appliedCategory]);

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter((item) => {
      if (!q) return true;
      const affiliate = businessById.get(item.businessId)?.name ?? '';
      return (
        item.name.toLowerCase().includes(q) ||
        affiliate.toLowerCase().includes(q) ||
        STATUS_LABELS[item.status].toLowerCase().includes(q)
      );
    });
  }, [offers, search, businessById]);

  const sponsors = useMemo(
    () => businesses.filter((item) => item.isSponsor),
    [businesses],
  );

  const pageTitle =
    tab === 'offers' ? 'Προσφορές' : tab === 'sponsors' ? 'Χορηγοί' : 'Συμβεβλημένες Επιχειρήσεις';

  const visibleBusinesses = filteredBusinesses.slice(0, pageSize);
  const visibleOffers = filteredOffers.slice(0, pageSize);

  function applyFilters() {
    setAppliedStatus(statusFilter);
    setAppliedCategory(categoryFilter);
  }

  function resetFilters() {
    setStatusFilter('');
    setCategoryFilter('');
    setAppliedStatus('');
    setAppliedCategory('');
    setSearch('');
  }

  function openCreateBusiness() {
    setEditingBusiness(null);
    setBusinessForm(emptyBusiness);
    setBusinessError('');
    setBusinessOpen(true);
  }

  function openEditBusiness(item: PartnerBusiness) {
    setEditingBusiness(item);
    setBusinessForm({
      name: item.name,
      url: item.url,
      status: item.status,
      categories: item.categories,
      isSponsor: item.isSponsor,
    });
    setBusinessError('');
    setBusinessOpen(true);
  }

  async function handleSaveBusiness() {
    setBusinessSaving(true);
    setBusinessError('');
    const result = editingBusiness
      ? await partnerService.updatePartnerBusiness(editingBusiness.id, businessForm)
      : await partnerService.createPartnerBusiness(businessForm);
    setBusinessSaving(false);
    if (!result.success) {
      setBusinessError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setBusinessOpen(false);
    refresh();
  }

  async function handleDeleteBusiness(id: string) {
    if (!confirm('Διαγραφή επιχείρησης; Θα διαγραφούν και οι προσφορές της.')) return;
    await partnerService.deletePartnerBusiness(id);
    refresh();
  }

  function openCreateOffer() {
    setEditingOffer(null);
    setOfferForm({
      ...emptyOffer,
      businessId: businesses[0]?.id ?? '',
    });
    setOfferError('');
    setOfferOpen(true);
  }

  function openEditOffer(item: PartnerOffer) {
    setEditingOffer(item);
    setOfferForm({
      name: item.name,
      businessId: item.businessId,
      status: item.status,
    });
    setOfferError('');
    setOfferOpen(true);
  }

  async function handleSaveOffer() {
    setOfferSaving(true);
    setOfferError('');
    const result = editingOffer
      ? await partnerService.updatePartnerOffer(editingOffer.id, offerForm)
      : await partnerService.createPartnerOffer(offerForm);
    setOfferSaving(false);
    if (!result.success) {
      setOfferError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setOfferOpen(false);
    refresh();
  }

  async function handleDeleteOffer(id: string) {
    if (!confirm('Διαγραφή προσφοράς;')) return;
    await partnerService.deletePartnerOffer(id);
    refresh();
  }

  function openSponsorsManager() {
    setSponsorDraft(sponsors.map((item) => item.id));
    setSponsorsOpen(true);
  }

  async function handleSaveSponsors() {
    setSponsorsSaving(true);
    const result = await partnerService.setPartnerBusinessSponsors(sponsorDraft);
    setSponsorsSaving(false);
    if (!result.success) return;
    setSponsorsOpen(false);
    refresh();
  }

  function toggleSponsorDraft(id: string) {
    setSponsorDraft((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  return (
    <div className="stack-lg">
      <PageHeader title={pageTitle} />

      <div className="tabs">
        {(
          [
            ['businesses', 'Επιχειρήσεις'],
            ['offers', 'Προσφορές'],
            ['sponsors', 'Χορηγοί'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => {
              setTab(id);
              setSearch('');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'businesses' ? (
        <section className="panel stack-md">
          <div className="panel-head">
            <h3>Επιχειρήσεις</h3>
            <Button type="button" onClick={openCreateBusiness}>
              <Plus size={16} /> Δημιουργία νέας
            </Button>
          </div>

          <div className="toolbar">
            <label className="field">
              <span className="field-label">Κατάσταση</span>
              <select
                className="field-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Όλες</option>
                <option value="active">Ενεργή</option>
                <option value="inactive">Ανενεργή</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Κατηγορίες</span>
              <input
                className="field-input"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="π.χ. ένδυση"
              />
            </label>
            <Button type="button" onClick={applyFilters}>
              Προβολή
            </Button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetFilters}
              aria-label="Ανανέωση φίλτρων"
              title="Ανανέωση"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="partner-table-controls">
            <label className="partner-page-size">
              Δείξε{' '}
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>{' '}
              εγγραφές
            </label>
            <label className="partner-search">
              Αναζήτηση:
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder=""
              />
            </label>
          </div>

          <div className="table-wrap">
            {visibleBusinesses.length === 0 ? (
              <div className="empty-state">
                <Building2 size={28} />
                <h3>Δεν υπάρχουν δεδομένα στον πίνακα</h3>
                <p>Πάτα «Δημιουργία νέας» για την πρώτη επιχείρηση.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Όνομα</th>
                    <th>URL</th>
                    <th>Κατάσταση</th>
                    <th>Κατηγορίες</th>
                    <th>Τελευταία τροποποίηση από</th>
                    <th>Προσφορές</th>
                    <th>Χορηγός</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBusinesses.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer">
                            {item.url}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{STATUS_LABELS[item.status]}</td>
                      <td>{item.categories || '—'}</td>
                      <td>
                        {item.lastModifiedBy}
                        <div className="match-print-details">
                          {formatDate(item.lastModifiedAt || localDateIso())}
                        </div>
                      </td>
                      <td>{offerCountByBusiness.get(item.id) ?? 0}</td>
                      <td>{item.isSponsor ? 'Ναι' : 'Όχι'}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEditBusiness(item)}
                          aria-label="Επεξεργασία"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleDeleteBusiness(item.id)}
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
          </div>
          <p className="partner-table-footer">
            Εμφανίζονται {visibleBusinesses.length === 0 ? 0 : 1} έως {visibleBusinesses.length} από{' '}
            {filteredBusinesses.length} εγγραφές
          </p>
        </section>
      ) : null}

      {tab === 'offers' ? (
        <section className="panel stack-md">
          <div className="panel-head">
            <h3>Προσφορές</h3>
            <Button type="button" onClick={openCreateOffer} disabled={businesses.length === 0}>
              <Plus size={16} /> Δημιουργία νέας
            </Button>
          </div>

          <div className="partner-table-controls">
            <label className="partner-page-size">
              Δείξε{' '}
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>{' '}
              εγγραφές
            </label>
            <label className="partner-search">
              Αναζήτηση:
              <input value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>

          <div className="table-wrap">
            {visibleOffers.length === 0 ? (
              <div className="empty-state">
                <h3>Δεν υπάρχουν δεδομένα στον πίνακα</h3>
                <p>
                  {businesses.length === 0
                    ? 'Πρώτα δημιούργησε μια επιχείρηση.'
                    : 'Πάτα «Δημιουργία νέας» για την πρώτη προσφορά.'}
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Όνομα</th>
                    <th>Affiliate</th>
                    <th>Ημ/νία δημιουργίας</th>
                    <th>Κατάσταση</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOffers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{businessById.get(item.businessId)?.name ?? '—'}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{STATUS_LABELS[item.status]}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEditOffer(item)}
                          aria-label="Επεξεργασία"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleDeleteOffer(item.id)}
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
          </div>
          <p className="partner-table-footer">
            Εμφανίζονται {visibleOffers.length === 0 ? 0 : 1} έως {visibleOffers.length} από{' '}
            {filteredOffers.length} εγγραφές
          </p>
        </section>
      ) : null}

      {tab === 'sponsors' ? (
        <section className="panel stack-md">
          <div className="panel-head">
            <h3>Χορηγοί</h3>
            <Button type="button" variant="secondary" onClick={openSponsorsManager}>
              <Plus size={16} /> Διαχείριση Χορηγών
            </Button>
          </div>

          {sponsors.length === 0 ? (
            <div className="empty-state">
              <h3>Δεν υπάρχουν επιχειρήσεις στη λίστα χορηγών</h3>
              <p>Επίλεξε επιχειρήσεις από τη διαχείριση χορηγών.</p>
              <Button type="button" onClick={openSponsorsManager}>
                Διαχείριση Χορηγών
              </Button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Όνομα</th>
                    <th>URL</th>
                    <th>Κατηγορίες</th>
                    <th>Κατάσταση</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{item.url || '—'}</td>
                      <td>{item.categories || '—'}</td>
                      <td>{STATUS_LABELS[item.status]}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEditBusiness(item)}
                          aria-label="Επεξεργασία"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <Modal
        open={businessOpen}
        title={editingBusiness ? 'Επεξεργασία επιχείρησης' : 'Νέα επιχείρηση'}
        onClose={() => setBusinessOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setBusinessOpen(false)}>
              Άκυρο
            </Button>
            <Button
              type="button"
              disabled={businessSaving}
              onClick={() => void handleSaveBusiness()}
            >
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="stack-md">
          <label className="field">
            <span className="field-label">
              Όνομα <span className="req">*</span>
            </span>
            <input
              className="field-input"
              value={businessForm.name}
              onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">URL</span>
            <input
              className="field-input"
              value={businessForm.url}
              onChange={(e) => setBusinessForm({ ...businessForm, url: e.target.value })}
              placeholder="https://"
            />
          </label>
          <div className="product-form-row product-form-row--2">
            <label className="field">
              <span className="field-label">Κατάσταση</span>
              <select
                className="field-input"
                value={businessForm.status}
                onChange={(e) =>
                  setBusinessForm({
                    ...businessForm,
                    status: e.target.value as PartnerStatus,
                  })
                }
              >
                <option value="active">Ενεργή</option>
                <option value="inactive">Ανενεργή</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Κατηγορίες</span>
              <input
                className="field-input"
                value={businessForm.categories}
                onChange={(e) =>
                  setBusinessForm({ ...businessForm, categories: e.target.value })
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(businessForm.isSponsor)}
              onChange={(e) =>
                setBusinessForm({ ...businessForm, isSponsor: e.target.checked })
              }
            />
            <span>Χορηγός</span>
          </label>
          {businessError ? <p className="form-error">{businessError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={offerOpen}
        title={editingOffer ? 'Επεξεργασία προσφοράς' : 'Νέα προσφορά'}
        onClose={() => setOfferOpen(false)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOfferOpen(false)}>
              Άκυρο
            </Button>
            <Button type="button" disabled={offerSaving} onClick={() => void handleSaveOffer()}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="stack-md">
          <label className="field">
            <span className="field-label">
              Όνομα <span className="req">*</span>
            </span>
            <input
              className="field-input"
              value={offerForm.name}
              onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Affiliate <span className="req">*</span>
            </span>
            <select
              className="field-input"
              value={offerForm.businessId}
              onChange={(e) => setOfferForm({ ...offerForm, businessId: e.target.value })}
            >
              <option value="">—</option>
              {businesses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Κατάσταση</span>
            <select
              className="field-input"
              value={offerForm.status}
              onChange={(e) =>
                setOfferForm({ ...offerForm, status: e.target.value as PartnerStatus })
              }
            >
              <option value="active">Ενεργή</option>
              <option value="inactive">Ανενεργή</option>
            </select>
          </label>
          {offerError ? <p className="form-error">{offerError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={sponsorsOpen}
        title="Διαχείριση Χορηγών"
        onClose={() => setSponsorsOpen(false)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setSponsorsOpen(false)}>
              Άκυρο
            </Button>
            <Button
              type="button"
              disabled={sponsorsSaving}
              onClick={() => void handleSaveSponsors()}
            >
              Αποθήκευση
            </Button>
          </>
        }
      >
        {businesses.length === 0 ? (
          <p className="muted">Δεν υπάρχουν επιχειρήσεις για επιλογή.</p>
        ) : (
          <div className="stack-sm">
            {businesses.map((item) => (
              <label key={item.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={sponsorDraft.includes(item.id)}
                  onChange={() => toggleSponsorDraft(item.id)}
                />
                <span>
                  {item.name}
                  {item.categories ? ` — ${item.categories}` : ''}
                </span>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
