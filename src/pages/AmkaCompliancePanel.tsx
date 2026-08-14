import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import * as amkaAuditService from '../api/services/amkaAuditService';
import * as legalComplianceService from '../api/services/legalComplianceService';
import { getSession } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { SettingsFormRow } from '../components/ui/SettingsFormRow';
import { useAppData } from '../hooks/useAppData';
import {
  AMKA_CHECKLIST_ITEMS,
  AMKA_DELETION_PROCEDURE_HTML,
  AMKA_DPIA_HTML,
  AMKA_SECURITY_POLICY_HTML,
  DEFAULT_DATA_RETENTION_MONTHS,
  DEFAULT_DPA_HTML,
  DEFAULT_RETENTION_POLICY_HTML,
  MEDICAL_ACCESS_HINT,
} from '../shared/termsDefaults';
import { canAccessAmka } from '../utils/amkaAccess';
import type { AmkaAccessLog } from '../types';

const ACTION_LABELS: Record<AmkaAccessLog['action'], string> = {
  view: 'Προβολή',
  edit: 'Επεξεργασία',
  delete: 'Διαγραφή',
  consent: 'Συγκατάθεση',
  seal: 'Σφράγιση / ολοκλήρωση',
};

export function AmkaCompliancePanel() {
  const session = getSession();
  const { data, refresh } = useAppData();
  const [logs, setLogs] = useState<AmkaAccessLog[]>([]);
  const [dpaHtml, setDpaHtml] = useState(DEFAULT_DPA_HTML);
  const [retentionPolicyHtml, setRetentionPolicyHtml] = useState(DEFAULT_RETENTION_POLICY_HTML);
  const [retentionMonths, setRetentionMonths] = useState(DEFAULT_DATA_RETENTION_MONTHS);
  const [saving, setSaving] = useState(false);
  const [runningRetention, setRunningRetention] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const allowed = canAccessAmka(session?.role);

  useEffect(() => {
    if (!allowed) return;
    void legalComplianceService.getLegalComplianceDocs().then((result) => {
      if (!result.success || !result.data) return;
      setDpaHtml(result.data.dpaHtml);
      setRetentionPolicyHtml(result.data.retentionPolicyHtml);
      setRetentionMonths(result.data.dataRetentionMonths);
    });
  }, [allowed, data.dpaHtml, data.retentionPolicyHtml, data.dataRetentionMonths]);

  useEffect(() => {
    if (!allowed) return;
    void amkaAuditService.listAmkaAccessLogs().then((result) => {
      if (result.success && result.data) {
        setLogs([...result.data].sort((a, b) => b.at.localeCompare(a.at)));
      }
    });
  }, [allowed, data.amkaAccessLogs]);

  async function handleSaveRetention() {
    setSaving(true);
    setError('');
    setMessage('');
    const result = await legalComplianceService.saveLegalComplianceDocs({
      dpaHtml: data.dpaHtml?.trim() ? data.dpaHtml : DEFAULT_DPA_HTML,
      retentionPolicyHtml: data.retentionPolicyHtml?.trim()
        ? data.retentionPolicyHtml
        : DEFAULT_RETENTION_POLICY_HTML,
      dataRetentionMonths: retentionMonths,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία αποθήκευσης');
      return;
    }
    refresh();
    setMessage('Η ρύθμιση διατήρησης αποθηκεύτηκε.');
  }

  async function handleRunRetention() {
    if (
      !confirm(
        `Καθαρισμός ΑΜΚΑ και ιατρικών πεδίων για ανενεργούς αθλητές με εγγραφή παλαιότερη από ${retentionMonths} μήνες;`,
      )
    ) {
      return;
    }
    setRunningRetention(true);
    setError('');
    setMessage('');
    await handleSaveRetention();
    const result = await legalComplianceService.applySensitiveDataRetention();
    setRunningRetention(false);
    if (!result.success || !result.data) {
      setError(result.error ?? 'Αποτυχία εφαρμογής διατήρησης');
      return;
    }
    refresh();
    setMessage(
      `Καθαρίστηκαν ευαίσθητα πεδία σε ${result.data.cleaned} ανενεργούς αθλητές (όριο: ${result.data.cutoff}).`,
    );
  }

  if (!allowed) {
    return (
      <section className="panel settings-panel">
        <p className="form-error">Η ενότητα ΑΜΚΑ / GDPR είναι διαθέσιμη μόνο σε διαχειριστή και ιατρό.</p>
      </section>
    );
  }

  return (
    <section className="panel settings-panel settings-amka-compliance">
      <header className="settings-terms-head">
        <h3>
          <ShieldCheck size={18} aria-hidden /> Συμμόρφωση GDPR
        </h3>
        <p className="lede">
          DPA, διατήρηση δεδομένων, ΑΜΚΑ/ιατρικά μέτρα, DPIA και audit logs.
        </p>
      </header>

      <p className="ap-field-hint">{MEDICAL_ACCESS_HINT}</p>

      <div className="ap-amka-privacy" dangerouslySetInnerHTML={{ __html: dpaHtml }} />
      <div className="ap-amka-privacy" dangerouslySetInnerHTML={{ __html: retentionPolicyHtml }} />
      <div className="ap-amka-privacy" dangerouslySetInnerHTML={{ __html: AMKA_SECURITY_POLICY_HTML }} />
      <div className="ap-amka-privacy" dangerouslySetInnerHTML={{ __html: AMKA_DPIA_HTML }} />
      <div
        className="ap-amka-privacy"
        dangerouslySetInnerHTML={{ __html: AMKA_DELETION_PROCEDURE_HTML }}
      />

      <SettingsFormRow label="Μήνες διατήρησης ευαίσθητων (ανενεργοί)">
        <input
          type="number"
          min={1}
          max={120}
          className="ap-input"
          value={retentionMonths}
          onChange={(e) => setRetentionMonths(Number(e.target.value) || DEFAULT_DATA_RETENTION_MONTHS)}
        />
      </SettingsFormRow>

      <div className="settings-form-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button type="button" disabled={saving} onClick={() => void handleSaveRetention()}>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση διατήρησης'}
        </Button>
        <Button type="button" disabled={runningRetention} onClick={() => void handleRunRetention()}>
          {runningRetention ? 'Εφαρμογή…' : 'Εφαρμογή διατήρησης τώρα'}
        </Button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      <div className="settings-amka-checklist">
        <h4>Checklist κάλυψης</h4>
        <ul>
          {AMKA_CHECKLIST_ITEMS.map((item) => (
            <li key={item}>
              <label>
                <input type="checkbox" checked readOnly />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="lede">
          HTTPS παρέχεται από το hosting (Vercel). Τα εξερχόμενα email φιλτράρονται ώστε να μην
          περιέχουν ΑΜΚΑ σε plain text.
        </p>
      </div>

      <div className="settings-amka-logs">
        <h4>Audit logs ΑΜΚΑ (12 μήνες)</h4>
        {logs.length === 0 ? (
          <p className="lede">Δεν υπάρχουν καταγραφές ακόμη.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ημ/νία</th>
                  <th>Χρήστης</th>
                  <th>Αθλητής</th>
                  <th>Ενέργεια</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 100).map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.at).toLocaleString('el-GR')}</td>
                    <td>{row.userName}</td>
                    <td>{row.athleteName}</td>
                    <td>{ACTION_LABELS[row.action]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
