import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, Plus, Receipt } from 'lucide-react';
import * as emailService from '../api/services/emailService';
import * as feeChargesService from '../api/services/feeChargesService';
import * as vivaService from '../api/services/vivaService';
import { getSession } from '../auth/auth';
import { getClubById, getClubSmtp, getClubViva } from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { getPreviewClubId, loadPlatformConfig } from '../platform/platformConfig';
import type { FeeChargeTemplateInput } from '../schemas';
import type { FeeChargeTemplate } from '../types';
import { formatCurrency, formatDate } from '../utils/labels';
import { normalizeSportKey } from '../utils/sport';

type Panel = 'list' | 'createCharges' | 'reminders' | 'newCharge';

const defaultMonths = [...feeChargesService.DEFAULT_FEE_MONTHS];

function emptyForm(season: string): FeeChargeTemplateInput {
  return {
    season,
    sport: '',
    typeLabel: 'Συνδρομή',
    monthlyAmount: 30,
    appliesTo: 'all',
    classId: null,
    months: defaultMonths,
    reminderDays: 7,
    registrationFee: 0,
    seasonTicketAmount: 0,
    seasonTicketMonths: defaultMonths,
  };
}

function toggleMonth(list: number[], month: number): number[] {
  return list.includes(month) ? list.filter((m) => m !== month) : [...list, month];
}

export function FeesPage() {
  const { data, refresh } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = getSession();
  const clubId = getPreviewClubId() ?? session?.clubId ?? null;
  const vivaEnabled = clubId ? getClubViva(clubId).enabled : false;
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<Panel>('list');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    const txnId = searchParams.get('t');
    if (!txnId) return;
    setMessage(
      `Επιστροφή από Viva (transaction ${txnId}). Καταχωρήστε τη σχετική πληρωμή στις Συναλλαγές αν δεν εμφανίζεται αυτόματα.`,
    );
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const seasons = useMemo(() => {
    const fromConfig = loadPlatformConfig().seasons ?? [];
    return fromConfig.length > 0 ? fromConfig : ['2025–2026', '2026–2027'];
  }, []);

  const [form, setForm] = useState<FeeChargeTemplateInput>(() =>
    emptyForm(seasons[seasons.length - 1] ?? '2026–2027'),
  );

  const transactions = data.transactions ?? [];
  const templates = data.feeChargeTemplates ?? [];

  const sports = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data.sports ?? []) {
      if (item.active === false) continue;
      const key = normalizeSportKey(item.name);
      if (key) map.set(key, item.name.trim());
    }
    for (const cls of data.classes) {
      const label = cls.sport?.trim();
      const key = normalizeSportKey(label);
      if (key && !map.has(key)) map.set(key, label!);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b, 'el'));
  }, [data.sports, data.classes]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students
      .filter((s) => s.status !== 'inactive')
      .filter((s) => {
        if (!q) return true;
        return `${s.lastName} ${s.firstName} ${s.amka ?? ''}`.toLowerCase().includes(q);
      })
      .map((athlete) => {
        const balance = feeChargesService.athleteBalance(athlete.id, transactions);
        const lastPayment = [...transactions]
          .filter((t) => t.athleteId === athlete.id && t.type === 'payment')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return {
          athlete,
          balance,
          lastPayment,
          cls: data.classes.find((c) => c.id === athlete.classId),
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [data.students, data.classes, transactions, query]);

  const totals = useMemo(
    () => ({
      owed: rows.filter((r) => r.balance > 0).reduce((sum, r) => sum + r.balance, 0),
      credit: rows.filter((r) => r.balance < 0).reduce((sum, r) => sum + Math.abs(r.balance), 0),
      athletesWithDebt: rows.filter((r) => r.balance > 0).length,
    }),
    [rows],
  );

  const reminders = useMemo(
    () => (panel === 'reminders' ? feeChargesService.listDebtReminders() : []),
    [panel, data.transactions, data.students, data.feeChargeTemplates, data.feeReminderLogs],
  );

  function openNewCharge() {
    setError('');
    setMessage('');
    setForm(emptyForm(seasons[seasons.length - 1] ?? '2026–2027'));
    setPanel('newCharge');
  }

  function openCreateCharges() {
    setError('');
    setMessage('');
    setSelectedTemplateId(templates[0]?.id ?? '');
    setPanel('createCharges');
  }

  function openReminders() {
    setError('');
    setMessage('');
    setPanel('reminders');
  }

  async function handleSaveTemplate() {
    setSaving(true);
    setError('');
    setMessage('');
    const result = await feeChargesService.createFeeChargeTemplate(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setMessage('Το πρότυπο χρέωσης αποθηκεύτηκε.');
    setPanel('createCharges');
    setSelectedTemplateId(result.data?.id ?? '');
    refresh();
  }

  async function handleGenerateCharges() {
    if (!selectedTemplateId) {
      setError('Επιλέξτε πρότυπο χρέωσης.');
      return;
    }
    if (!confirm('Δημιουργία χρεώσεων για τους ενεργούς αθλητές του προτύπου;')) return;
    setSaving(true);
    setError('');
    setMessage('');
    const result = await feeChargesService.generateChargesFromTemplate(selectedTemplateId);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα δημιουργίας χρεώσεων');
      return;
    }
    setMessage(
      `Δημιουργήθηκαν ${result.data?.created ?? 0} χρεώσεις για ${result.data?.athletes ?? 0} αθλητές.`,
    );
    refresh();
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Διαγραφή προτύπου χρέωσης;')) return;
    await feeChargesService.deleteFeeChargeTemplate(id);
    if (selectedTemplateId === id) setSelectedTemplateId('');
    refresh();
  }

  async function handleSendReminder(row: feeChargesService.DebtReminderRow) {
    if (!clubId) {
      setError('Δεν βρέθηκε σύλλογος.');
      return;
    }
    if (!row.email.includes('@')) {
      setError(
        `Ο ${row.athleteName} δεν έχει έγκυρο email γονέα/αθλητή. Συμπληρώστε το στο προφίλ.`,
      );
      return;
    }

    const smtp = getClubSmtp(clubId);
    if (!smtp.enabled) {
      setError('Ενεργοποιήστε το SMTP στις Ρυθμίσεις → Email για αποστολή υπενθυμίσεων.');
      return;
    }

    const club = getClubById(clubId);
    setSaving(true);
    setError('');
    const send = await emailService.sendClubEmail({
      clubId,
      to: row.email,
      subject: `Υπενθύμιση οφειλής — ${club?.name ?? 'Σύλλογος'}`,
      text: [
        `Αγαπητοί γονείς / κηδεμόνες,`,
        ``,
        `Υπενθυμίζουμε ότι υπάρχει οφειλή συνδρομής για τον/την ${row.athleteName}.`,
        `Ποσό: ${formatCurrency(row.balance)}`,
        `Ημέρες καθυστέρησης: ${row.daysOverdue}`,
        ``,
        `Παρακαλούμε τακτοποιήστε την οφειλή το συντομότερο.`,
        ``,
        club?.name ?? 'SPORTSUITE 360',
      ].join('\n'),
    });
    setSaving(false);
    if (!send.success) {
      setError(send.error ?? 'Αποτυχία αποστολής email');
      return;
    }

    await feeChargesService.logDebtReminder({
      athleteId: row.athleteId,
      amount: row.balance,
      note: `Email υπενθύμισης σε ${row.email} · ${formatCurrency(row.balance)}`,
    });
    setMessage(`Στάλθηκε υπενθύμιση email στον/στην ${row.athleteName} (${row.email}).`);
    refresh();
  }

  async function handleVivaPay(athleteId: string, amount: number, athleteName: string, email: string) {
    if (!clubId) return;
    setPayingId(athleteId);
    setError('');
    const result = await vivaService.createVivaCheckout({
      clubId,
      amountEuro: amount,
      customerEmail: email || undefined,
      customerFullName: athleteName,
      merchantTrns: `Οφειλή ${athleteName}`,
    });
    setPayingId(null);
    if (!result.success || !result.data?.checkoutUrl) {
      setError(result.error ?? 'Αποτυχία Viva checkout');
      return;
    }
    window.location.href = result.data.checkoutUrl;
  }

  function templateSummary(tpl: FeeChargeTemplate): string {
    const sport = tpl.sport || 'Όλα';
    const applies =
      feeChargesService.FEE_APPLIES_TO_LABELS[tpl.appliesTo ?? 'all'] ?? 'Όλοι οι αθλητές';
    const months = tpl.months.length;
    return `${tpl.season} · ${sport} · ${applies} · ${formatCurrency(tpl.monthlyAmount)} · ${months} μήνες`;
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Συνδρομές / Πληρωμές"
        subtitle="Υπόλοιπα συνδρομών, πρότυπα χρεώσεων και υπενθυμίσεις οφειλών."
        actions={
          <div className="fees-actions">
            <Button type="button" variant="secondary" onClick={openCreateCharges}>
              <Receipt size={16} /> Δημιουργία χρεώσεων
            </Button>
            <Button type="button" variant="secondary" onClick={openReminders}>
              <Bell size={16} /> Υπενθύμιση οφειλών
            </Button>
            <Button type="button" onClick={openNewCharge}>
              <Plus size={16} /> Νέα χρέωση
            </Button>
          </div>
        }
      />

      {message ? <p className="settings-success">{message}</p> : null}
      {error && panel === 'list' ? <p className="form-error">{error}</p> : null}

      <section className="stats-grid cols-3">
        <article className="stat-card tone-warn">
          <span className="stat-label">Οφειλές</span>
          <strong className="stat-value">{formatCurrency(totals.owed)}</strong>
          <span className="stat-hint">{totals.athletesWithDebt} αθλητές</span>
        </article>
        <article className="stat-card tone-positive">
          <span className="stat-label">Πιστωτικά</span>
          <strong className="stat-value">{formatCurrency(totals.credit)}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Ενεργοί αθλητές</span>
          <strong className="stat-value">{String(rows.length)}</strong>
        </article>
      </section>

      <div className="toolbar">
        <input
          className="tx-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση αθλητή..."
        />
        <Link className="btn btn-secondary" to="/transactions">
          Μετάβαση σε Συναλλαγές
        </Link>
      </div>

      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αθλητής</th>
              <th>Τμήμα</th>
              <th>Μηνιαία συνδρομή</th>
              <th>Υπόλοιπο</th>
              <th>Τελευταία πληρωμή</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ athlete, balance, lastPayment, cls }) => (
              <tr key={athlete.id}>
                <td>
                  <strong>
                    {athlete.lastName} {athlete.firstName}
                  </strong>
                  <div className="muted">{athlete.amka || '—'}</div>
                </td>
                <td>{cls?.name ?? '—'}</td>
                <td>{formatCurrency(athlete.monthlyFee)}</td>
                <td>
                  <span className={balance > 0 ? 'badge badge-overdue' : 'badge badge-paid'}>
                    {formatCurrency(balance)}
                  </span>
                </td>
                <td>
                  {lastPayment
                    ? `${formatCurrency(lastPayment.amount)} · ${formatDate(lastPayment.createdAt.slice(0, 10))}`
                    : '—'}
                </td>
                <td className="row-actions">
                  {balance > 0 && vivaEnabled ? (
                    <Button
                      type="button"
                      disabled={payingId === athlete.id}
                      onClick={() =>
                        void handleVivaPay(
                          athlete.id,
                          balance,
                          `${athlete.lastName} ${athlete.firstName}`,
                          athlete.motherEmail || athlete.email || '',
                        )
                      }
                    >
                      {payingId === athlete.id ? 'Viva…' : 'Viva'}
                    </Button>
                  ) : null}
                  <Link className="btn btn-secondary" to={`/athletes/${athlete.id}`}>
                    Προφίλ
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modal
        open={panel === 'newCharge'}
        title="Νέα χρέωση"
        onClose={() => setPanel('list')}
        wide
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setPanel('list')}>
              Ακύρωση
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSaveTemplate()}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="fee-charge-form">
          <div className="fee-charge-hero">
            <div className="fee-charge-hero-grid">
              <label className="field">
                <span className="field-label">Σεζόν</span>
                <select
                  className="field-input"
                  value={form.season}
                  onChange={(e) => setForm({ ...form, season: e.target.value })}
                >
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Άθλημα</span>
                <select
                  className="field-input"
                  value={form.sport}
                  onChange={(e) => setForm({ ...form, sport: e.target.value })}
                >
                  <option value="">Όλα</option>
                  {sports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="fee-charge-note">
              Ισχύει για μηνιαία συνδρομή, εγγραφή και εισιτήριο διαρκείας. Αν επιλεγεί άθλημα, η
              χρέωση εφαρμόζεται μόνο σε αθλητές αυτού του αθλήματος.
            </p>
          </div>

          <section className="fee-charge-section">
            <h3>Μηνιαία συνδρομή</h3>
            <div className="fee-charge-hero-grid">
              <label className="field">
                <span className="field-label">Τύπος</span>
                <input
                  className="field-input"
                  value={form.typeLabel}
                  onChange={(e) => setForm({ ...form, typeLabel: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Μηνιαίο ποσό (€)</span>
                <input
                  className="field-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.monthlyAmount || ''}
                  onChange={(e) =>
                    setForm({ ...form, monthlyAmount: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Ισχύει για</span>
                <select
                  className="field-input"
                  value={form.appliesTo}
                  onChange={(e) => {
                    const appliesTo = e.target.value as FeeChargeTemplateInput['appliesTo'];
                    setForm({
                      ...form,
                      appliesTo,
                      classId: appliesTo === 'class' ? form.classId : null,
                    });
                  }}
                >
                  {feeChargesService.FEE_APPLIES_TO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {form.appliesTo === 'class' ? (
              <label className="field">
                <span className="field-label">Τμήμα</span>
                <select
                  className="field-input"
                  value={form.classId ?? ''}
                  onChange={(e) => setForm({ ...form, classId: e.target.value || null })}
                >
                  <option value="">Επιλέξτε τμήμα…</option>
                  {data.classes
                    .filter((cls) => {
                      if (!form.sport) return true;
                      return normalizeSportKey(cls.sport) === normalizeSportKey(form.sport);
                    })
                    .map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.sport ? ` · ${cls.sport}` : ''}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <div className="field">
              <span className="field-label">Μήνες χρέωσης</span>
              <div className="fee-month-grid">
                {feeChargesService.FEE_SEASON_MONTHS.map((item) => (
                  <label key={item.month} className="fee-month-chip">
                    <input
                      type="checkbox"
                      checked={form.months.includes(item.month)}
                      onChange={() =>
                        setForm({ ...form, months: toggleMonth(form.months, item.month) })
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <span className="settings-hint">
                Επίλεξε τους μήνες της σεζόν που θα δημιουργείται η μηνιαία χρέωση.
              </span>
            </div>

            <label className="field fee-reminder-field">
              <span className="field-label">Υπενθύμιση (ημέρες μετά την οφειλή)</span>
              <input
                className="field-input"
                type="number"
                min={0}
                value={form.reminderDays}
                onChange={(e) =>
                  setForm({ ...form, reminderDays: Number(e.target.value) || 0 })
                }
              />
            </label>
          </section>

          <section className="fee-charge-section">
            <h3>Εγγραφή</h3>
            <label className="field">
              <span className="field-label">Εγγραφή (€)</span>
              <input
                className="field-input"
                type="number"
                min={0}
                step="0.01"
                value={form.registrationFee || ''}
                onChange={(e) =>
                  setForm({ ...form, registrationFee: Number(e.target.value) || 0 })
                }
              />
            </label>
            <span className="settings-hint">
              Προστίθεται μία φορά στην πρώτη μηνιαία χρέωση κάθε αθλητή για αυτό το πρότυπο.
            </span>
          </section>

          <section className="fee-charge-section">
            <h3>Εισιτήριο Διαρκείας</h3>
            <label className="field">
              <span className="field-label">Συνολικό ποσό (€)</span>
              <input
                className="field-input"
                type="number"
                min={0}
                step="0.01"
                value={form.seasonTicketAmount || ''}
                onChange={(e) =>
                  setForm({ ...form, seasonTicketAmount: Number(e.target.value) || 0 })
                }
              />
            </label>
            <div className="field">
              <span className="field-label">Μήνες εισιτηρίου</span>
              <div className="fee-month-grid">
                {feeChargesService.FEE_SEASON_MONTHS.map((item) => (
                  <label key={`ticket-${item.month}`} className="fee-month-chip">
                    <input
                      type="checkbox"
                      checked={form.seasonTicketMonths.includes(item.month)}
                      onChange={() =>
                        setForm({
                          ...form,
                          seasonTicketMonths: toggleMonth(form.seasonTicketMonths, item.month),
                        })
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <span className="settings-hint">
                Επίλεξε σεζόν, ποσό και τους μήνες που αφορά. Το ποσό μοιράζεται ισόποσα στους μήνες
                που επιλέγεις.
              </span>
            </div>
          </section>

          {error && panel === 'newCharge' ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={panel === 'createCharges'}
        title="Δημιουργία χρεώσεων"
        onClose={() => setPanel('list')}
        wide
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setPanel('list')}>
              Κλείσιμο
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleGenerateCharges()}>
              Δημιουργία χρεώσεων
            </Button>
          </>
        }
      >
        <div className="stack-md">
          <p className="muted">
            Επίλεξε αποθηκευμένο πρότυπο και δημιούργησε χρεώσεις στους ενεργούς αθλητές (χωρίς
            διπλοεγγραφές για τον ίδιο μήνα).
          </p>
          {templates.length === 0 ? (
            <div className="empty-state">
              <h3>Δεν υπάρχουν πρότυπα</h3>
              <p>Πάτα «Νέα χρέωση» για να ορίσεις το πρώτο πρότυπο.</p>
              <Button type="button" onClick={openNewCharge}>
                <Plus size={16} /> Νέα χρέωση
              </Button>
            </div>
          ) : (
            <>
              <label className="field">
                <span className="field-label">Πρότυπο</span>
                <select
                  className="field-input"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {templateSummary(tpl)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Σεζόν</th>
                      <th>Άθλημα</th>
                      <th>Μηνιαίο</th>
                      <th>Εγγραφή</th>
                      <th>Εισιτήριο</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((tpl) => (
                      <tr key={tpl.id}>
                        <td>{tpl.season}</td>
                        <td>{tpl.sport || 'Όλα'}</td>
                        <td>{formatCurrency(tpl.monthlyAmount)}</td>
                        <td>{formatCurrency(tpl.registrationFee)}</td>
                        <td>{formatCurrency(tpl.seasonTicketAmount)}</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handleDeleteTemplate(tpl.id)}
                          >
                            Διαγραφή
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error && panel === 'createCharges' ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={panel === 'reminders'}
        title="Υπενθύμιση οφειλών"
        onClose={() => setPanel('list')}
        wide
        footer={
          <Button variant="secondary" type="button" onClick={() => setPanel('list')}>
            Κλείσιμο
          </Button>
        }
      >
        <div className="stack-md">
          <p className="muted">
            Αθλητές με οφειλή μετά τις ημέρες υπενθύμισης. Η «Υπενθύμιση» στέλνει πραγματικό email
            μέσω SMTP (μόνο αν είναι ενεργό στις Ρυθμίσεις και υπάρχει έγκυρο email).
          </p>
          {reminders.length === 0 ? (
            <p className="muted">Δεν υπάρχουν οφειλές προς υπενθύμιση αυτή τη στιγμή.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Αθλητής</th>
                    <th>Οφειλή</th>
                    <th>Ημέρες</th>
                    <th>Παλαιότερη χρέωση</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((row) => (
                    <tr key={row.athleteId}>
                      <td>
                        <strong>{row.athleteName}</strong>
                        <div className="muted">{row.email || '—'}</div>
                      </td>
                      <td>{formatCurrency(row.balance)}</td>
                      <td>
                        {row.daysOverdue} / {row.reminderDays}
                      </td>
                      <td>{formatDate(row.oldestChargeDate)}</td>
                      <td className="row-actions">
                        <Button type="button" onClick={() => void handleSendReminder(row)}>
                          Υπενθύμιση
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && panel === 'reminders' ? <p className="form-error">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
