import { useRef, useState, type ChangeEvent } from 'react';
import * as backendSyncService from '../api/services/backendSyncService';
import { getSession } from '../auth/auth';
import { getClubById } from '../auth/clubs';
import { Button } from './ui/Button';
import {
  clearDataCache,
  getData,
  replaceClubData,
  replaceData,
  reseedDemoShowcase,
} from '../data/repository';
import { isDemoClubName, markDemoShowcaseApplied } from '../data/demoShowcase';
import { getPreviewClubId } from '../platform/platformConfig';
import {
  downloadBackupJson,
  downloadBackupZip,
  formatBackupError,
  pickAppDataForRestore,
  readBackupFile,
} from '../utils/backupArchive';

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState('Δεν επιλέχθηκε κανένα αρχείο.');
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [restoring, setRestoring] = useState(false);

  const clubId = getPreviewClubId() ?? getSession()?.clubId ?? null;
  const club = clubId ? getClubById(clubId) : null;
  const isDemoClub = isDemoClubName(club?.name);

  function flash(ok: string) {
    setError('');
    setMessage(ok);
  }

  function handleBackupExport() {
    downloadBackupZip();
    flash('Το backup ZIP κατέβηκε.');
  }

  function handleBackupExportJson() {
    downloadBackupJson();
    flash('Το backup JSON κατέβηκε.');
  }

  async function handlePushMirror() {
    if (!clubId) {
      setError('Δεν βρέθηκε σύλλογος για συγχρονισμό.');
      return;
    }
    setSyncing('push');
    setError('');
    const result = await backendSyncService.pushClubMirror(clubId);
    setSyncing(null);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία push');
      return;
    }
    flash(
      `Cloud mirror ενημερώθηκε${result.data?.updatedAt ? ` · ${result.data.updatedAt}` : ''}.`,
    );
  }

  async function handlePullMirror() {
    if (!clubId) {
      setError('Δεν βρέθηκε σύλλογος για συγχρονισμό.');
      return;
    }
    const confirmed = window.confirm(
      'Θα αντικατασταθούν τα τοπικά δεδομένα του συλλόγου από το cloud mirror. Συνέχεια;',
    );
    if (!confirmed) return;

    setSyncing('pull');
    setError('');
    const result = await backendSyncService.pullClubMirror(clubId);
    setSyncing(null);
    if (!result.success || !result.data) {
      setError(result.error ?? 'Αποτυχία pull');
      return;
    }

    replaceData(result.data.payload);
    flash(
      `Επαναφορά από mirror ολοκληρώθηκε${
        result.data.updatedAt ? ` · ${result.data.updatedAt}` : ''
      }. Ανανέωση σελίδας…`,
    );
    window.setTimeout(() => {
      window.location.reload();
    }, 600);
  }

  function handleReseedDemo() {
    if (!clubId || !isDemoClub) return;
    const confirmed = window.confirm(
      'Θα επαναφορτωθούν τα πλήρη δεδομένα παρουσίασης DEMO (αντικαθιστά τα τρέχοντα). Συνέχεια;',
    );
    if (!confirmed) return;
    const result = reseedDemoShowcase(clubId);
    if (!result) {
      setError('Αποτυχία επαναφόρτωσης DEMO δεδομένων.');
      return;
    }
    flash('Τα DEMO δεδομένα παρουσίασης φορτώθηκαν. Ανανέωση σελίδας…');
    window.setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  async function applyBackupFile(file: File) {
    setRestoring(true);
    setError('');
    setMessage('');
    try {
      if (!clubId) {
        throw new Error('Δεν βρέθηκε ενεργός σύλλογος. Κάντε login και ξαναδοκιμάστε.');
      }

      const parsed = await readBackupFile(file);
      const clubData = pickAppDataForRestore(parsed, clubId);
      if (!clubData) {
        throw new Error('Το backup δεν περιέχει δεδομένα συλλόγου.');
      }

      const expectedStudents = clubData.students?.length ?? 0;
      replaceClubData(clubId, clubData);

      // Prevent DEMO showcase auto-seed from overwriting a manual restore.
      if (isDemoClubName(getClubById(clubId)?.name)) {
        markDemoShowcaseApplied(clubId);
      }

      clearDataCache();
      const verify = getData();
      const gotStudents = verify.students?.length ?? 0;

      if (expectedStudents > 0 && gotStudents === 0) {
        throw new Error(
          'Η εγγραφή ολοκληρώθηκε αλλά τα δεδομένα δεν διαβάστηκαν πίσω. Καθαρίστε τα δεδομένα ιστότοπου και δοκιμάστε αρχείο .json.',
        );
      }

      flash(
        `Επαναφορά OK στον σύλλογο «${getClubById(clubId)?.name ?? clubId}»: ` +
          `${gotStudents} αθλητές, ${verify.classes?.length ?? 0} τμήματα. Ανανέωση…`,
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      setMessage('');
      setError(formatBackupError(err));
    } finally {
      setRestoring(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileLabel('Δεν επιλέχθηκε κανένα αρχείο.');
      return;
    }
    setFileLabel(file.name);
    void applyBackupFile(file);
    event.target.value = '';
  }

  return (
    <section className="settings-backup">
      <header className="settings-backup-head">
        <h2>Αντίγραφα ασφαλείας</h2>
        <p>
          Backup και επαναφορά δεδομένων στον τρέχοντα σύλλογο (δουλεύει και από localhost →
          Vercel).
        </p>
      </header>

      <div className="settings-backup-block">
        <div className="settings-backup-copy">
          <h3>Λήψη backup</h3>
          <p>
            Κατεβάστε ZIP ή JSON. Για μεταφορά στο Vercel προτείνεται <strong>JSON</strong>.
          </p>
        </div>
        <div className="settings-backup-panel" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button type="button" className="settings-backup-action" onClick={handleBackupExport}>
            Λήψη ZIP
          </Button>
          <Button type="button" className="settings-backup-action" onClick={handleBackupExportJson}>
            Λήψη JSON
          </Button>
        </div>
      </div>

      <div className="settings-backup-block">
        <div className="settings-backup-copy">
          <h3>Επαναφορά από backup</h3>
          <p>
            Εφαρμόζει τα δεδομένα στον ενεργό σύλλογο
            {club ? (
              <>
                {' '}
                (<strong>{club.name}</strong>)
              </>
            ) : null}
            . Δεν αλλάζει τους λογαριασμούς σύνδεσης.
          </p>
        </div>
        <div className="settings-backup-panel">
          <input
            ref={fileRef}
            type="file"
            accept="application/zip,.zip,application/json,.json"
            hidden
            onChange={handleFileChange}
            disabled={restoring}
          />
          <button
            type="button"
            className="settings-backup-file-btn"
            disabled={restoring || !clubId}
            onClick={() => fileRef.current?.click()}
          >
            {restoring ? 'Επαναφορά…' : 'Επιλογή αρχείου'}
          </button>
          <span className="settings-backup-file-name">{fileLabel}</span>
          <p className="settings-hint">
            Προτίμησε .json από localhost αν το ZIP αποτύχει. Login στον σύλλογο-στόχο πριν την
            επαναφορά.
          </p>
        </div>
      </div>

      <div className="settings-backup-block">
        <div className="settings-backup-copy">
          <h3>Cloud mirror (πειραματικό)</h3>
          <p>
            Push / Pull μέσω `/api/sync/mirror` (Upstash Redis αν έχει ρυθμιστεί).
          </p>
        </div>
        <div className="settings-backup-panel" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            type="button"
            className="settings-backup-action"
            disabled={syncing !== null || !clubId}
            onClick={() => void handlePushMirror()}
          >
            {syncing === 'push' ? 'Push…' : 'Push mirror συλλόγου'}
          </Button>
          <Button
            type="button"
            className="settings-backup-action"
            disabled={syncing !== null || !clubId}
            onClick={() => void handlePullMirror()}
          >
            {syncing === 'pull' ? 'Pull…' : 'Pull / επαναφορά από mirror'}
          </Button>
        </div>
      </div>

      {isDemoClub ? (
        <div className="settings-backup-block">
          <div className="settings-backup-copy">
            <h3>Δεδομένα παρουσίασης DEMO</h3>
            <p>Επαναφορτώνει το ενσωματωμένο δείγμα παρουσίασης.</p>
          </div>
          <div className="settings-backup-panel">
            <Button type="button" className="settings-backup-action" onClick={handleReseedDemo}>
              Επαναφόρτωση DEMO δεδομένων
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}
    </section>
  );
}
