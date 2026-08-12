import { useId, useMemo, useState, type ChangeEvent } from 'react';
import * as backendSyncService from '../api/services/backendSyncService';
import { getSession } from '../auth/auth';
import { ensureSessionClub, getClubById } from '../auth/clubs';
import { Button } from './ui/Button';
import {
  flushClubMirrorPush,
  getLastSyncAt,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
} from '../data/clubSync';
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

function resolveTargetClubId(): string | null {
  const preview = getPreviewClubId();
  if (preview) return preview;
  const session = getSession();
  const ensured = ensureSessionClub(session);
  return ensured?.id ?? session?.clubId ?? null;
}

export function BackupPanel() {
  const fileInputId = useId();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState('Δεν επιλέχθηκε κανένα αρχείο.');
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [clubTick, setClubTick] = useState(0);

  const clubId = useMemo(() => resolveTargetClubId(), [clubTick]);
  const club = clubId ? getClubById(clubId) : null;
  const isDemoClub = isDemoClubName(club?.name);
  const autoSync = clubId ? isAutoSyncEnabled(clubId) : false;
  const lastSync = clubId ? getLastSyncAt(clubId) : null;

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
    const activeClubId = resolveTargetClubId();
    setClubTick((n) => n + 1);
    if (!activeClubId) {
      setError('Δεν βρέθηκε σύλλογος για συγχρονισμό. Κάντε login και ξαναδοκιμάστε.');
      return;
    }
    setSyncing('push');
    setError('');
    const result = await backendSyncService.pushClubMirror(activeClubId);
    setSyncing(null);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία push');
      return;
    }
    flash(
      `Cloud mirror ενημερώθηκε${result.data?.updatedAt ? ` · ${result.data.updatedAt}` : ''}.`,
    );
    setClubTick((n) => n + 1);
  }

  async function handleToggleAutoSync(enabled: boolean) {
    const activeClubId = resolveTargetClubId();
    setClubTick((n) => n + 1);
    if (!activeClubId) {
      setError('Δεν βρέθηκε σύλλογος.');
      return;
    }
    setAutoSyncEnabled(activeClubId, enabled);
    setClubTick((n) => n + 1);
    if (enabled) {
      setSyncing('push');
      const result = await flushClubMirrorPush(activeClubId);
      setSyncing(null);
      if (!result.success) {
        setError(result.error ?? 'Αποτυχία αρχικού push');
        flash('Το αυτόματο sync ενεργοποιήθηκε, αλλά το πρώτο push απέτυχε.');
        return;
      }
      flash('Αυτόματο cloud sync ενεργό. Τα δεδομένα ανεβαίνουν μετά από κάθε αλλαγή.');
      return;
    }
    flash('Αυτόματο cloud sync απενεργοποιήθηκε.');
  }

  async function handlePullMirror() {
    const activeClubId = resolveTargetClubId();
    setClubTick((n) => n + 1);
    if (!activeClubId) {
      setError('Δεν βρέθηκε σύλλογος για συγχρονισμό. Κάντε login και ξαναδοκιμάστε.');
      return;
    }
    const confirmed = window.confirm(
      'Θα αντικατασταθούν τα τοπικά δεδομένα του συλλόγου από το cloud mirror. Συνέχεια;',
    );
    if (!confirmed) return;

    setSyncing('pull');
    setError('');
    const result = await backendSyncService.pullClubMirror(activeClubId);
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
    const activeClubId = resolveTargetClubId();
    if (!activeClubId || !isDemoClubName(getClubById(activeClubId)?.name)) return;
    const confirmed = window.confirm(
      'Θα επαναφορτωθούν τα πλήρη δεδομένα παρουσίασης DEMO (αντικαθιστά τα τρέχοντα). Συνέχεια;',
    );
    if (!confirmed) return;
    const result = reseedDemoShowcase(activeClubId);
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
      const activeClubId = resolveTargetClubId();
      setClubTick((n) => n + 1);
      if (!activeClubId) {
        throw new Error(
          'Δεν βρέθηκε ενεργός σύλλογος. Αποσύνδεση → «Είσοδος DEMO παρουσίασης» και ξαναδοκιμάστε.',
        );
      }

      const parsed = await readBackupFile(file);
      const clubData = pickAppDataForRestore(parsed, activeClubId);
      if (!clubData) {
        throw new Error('Το backup δεν περιέχει δεδομένα συλλόγου.');
      }

      const expectedStudents = clubData.students?.length ?? 0;
      replaceClubData(activeClubId, clubData);

      if (isDemoClubName(getClubById(activeClubId)?.name)) {
        markDemoShowcaseApplied(activeClubId);
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
        `Επαναφορά OK στον σύλλογο «${getClubById(activeClubId)?.name ?? activeClubId}»: ` +
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
    <section className="panel settings-panel settings-backup">
      <header className="settings-backup-head">
        <h3>Αντίγραφα ασφαλείας</h3>
        <p className="lede">
          Backup και επαναφορά δεδομένων στον τρέχοντα σύλλογο (δουλεύει και από localhost → Vercel).
        </p>
      </header>

      <div className="settings-form">
        <div className="settings-form-row settings-backup-block">
          <div className="settings-form-row-label settings-backup-copy">
            <strong>Λήψη backup</strong>
            <p>
              Κατεβάστε ZIP ή JSON. Για μεταφορά στο Vercel προτείνεται <strong>JSON</strong>.
            </p>
          </div>
          <div className="settings-form-row-content settings-backup-panel">
            <Button type="button" className="settings-backup-action" onClick={handleBackupExport}>
              Λήψη ZIP
            </Button>
            <Button type="button" className="settings-backup-action" onClick={handleBackupExportJson}>
              Λήψη JSON
            </Button>
          </div>
        </div>

        <div className="settings-form-row settings-backup-block">
          <div className="settings-form-row-label settings-backup-copy">
            <strong>Επαναφορά από backup</strong>
            <p>
              Εφαρμόζει τα δεδομένα στον ενεργό σύλλογο
              {club ? (
                <>
                  {' '}
                  (<strong>{club.name}</strong>)
                </>
              ) : (
                ' (θα χρησιμοποιηθεί ο σύλλογος του λογαριασμού σας)'
              )}
              . Δεν αλλάζει τους λογαριασμούς σύνδεσης.
            </p>
          </div>
          <div className="settings-form-row-content settings-backup-panel">
            <label
              htmlFor={fileInputId}
              className={`settings-backup-file-btn${restoring ? ' is-disabled' : ''}`}
              aria-disabled={restoring}
              onClick={() => {
                resolveTargetClubId();
                setClubTick((n) => n + 1);
              }}
            >
              {restoring ? 'Επαναφορά…' : 'Επιλογή αρχείου'}
            </label>
            <input
              id={fileInputId}
              type="file"
              accept=".zip,.json,application/zip,application/json,text/json"
              className="settings-backup-file-input"
              disabled={restoring}
              onChange={handleFileChange}
            />
            <span className="settings-backup-file-name">{fileLabel}</span>
            <p className="settings-hint">
              Προτίμησε .json από localhost. Αν το κουμπί φαίνεται ανενεργό, κάνε login με DEMO και
              Ctrl+F5.
            </p>
          </div>
        </div>

        <div className="settings-form-row settings-backup-block">
          <div className="settings-form-row-label settings-backup-copy">
            <strong>Cloud sync (multi-device)</strong>
            <p>
              Αυτόματο sync: pull στο login, push μετά από κάθε αλλαγή (Upstash Redis στο Vercel).
              {lastSync ? (
                <>
                  <br />
                  Τελευταίο sync: {lastSync}
                </>
              ) : null}
            </p>
          </div>
          <div className="settings-form-row-content settings-backup-panel">
            <label className="admin-check" style={{ maxWidth: 280 }}>
              <span>Αυτόματο sync</span>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => void handleToggleAutoSync(e.target.checked)}
              />
            </label>
            <Button
              type="button"
              className="settings-backup-action"
              disabled={syncing !== null}
              onClick={() => void handlePushMirror()}
            >
              {syncing === 'push' ? 'Push…' : 'Push mirror συλλόγου'}
            </Button>
            <Button
              type="button"
              className="settings-backup-action"
              disabled={syncing !== null}
              onClick={() => void handlePullMirror()}
            >
              {syncing === 'pull' ? 'Pull…' : 'Pull / επαναφορά από mirror'}
            </Button>
          </div>
        </div>

        {isDemoClub ? (
          <div className="settings-form-row settings-backup-block">
            <div className="settings-form-row-label settings-backup-copy">
              <strong>Δεδομένα παρουσίασης DEMO</strong>
              <p>Επαναφορτώνει το ενσωματωμένο δείγμα παρουσίασης.</p>
            </div>
            <div className="settings-form-row-content settings-backup-panel">
              <Button type="button" className="settings-backup-action" onClick={handleReseedDemo}>
                Επαναφόρτωση DEMO δεδομένων
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}
    </section>
  );
}
