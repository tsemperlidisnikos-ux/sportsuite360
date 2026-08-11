import { useRef, useState, type ChangeEvent } from 'react';
import * as backendSyncService from '../api/services/backendSyncService';
import { getSession, saveUsers } from '../auth/auth';
import { getClubById, saveClubs } from '../auth/clubs';
import { Button } from './ui/Button';
import {
  clearDataCache,
  replaceAllClubsData,
  replaceClubData,
  replaceData,
  reseedDemoShowcase,
} from '../data/repository';
import { isDemoClubName } from '../data/demoShowcase';
import { getPreviewClubId, savePlatformConfig } from '../platform/platformConfig';
import {
  downloadBackupZip,
  formatBackupError,
  isQuotaError,
  pickAppDataForRestore,
  readBackupFile,
  stripHeavyMedia,
} from '../utils/backupArchive';

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState('Δεν επιλέχθηκε κανένα αρχείο.');
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);

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

  function persistAppData(data: ReturnType<typeof pickAppDataForRestore>, stripped: boolean) {
    if (!data) throw new Error('Το backup δεν περιέχει δεδομένα συλλόγου.');
    const payload = stripped ? stripHeavyMedia(data) : data;
    if (clubId) {
      replaceClubData(clubId, payload);
    } else {
      replaceData(payload);
    }
  }

  async function applyBackupFile(file: File) {
    try {
      const parsed = await readBackupFile(file);
      const clubData = pickAppDataForRestore(parsed, clubId);

      try {
        persistAppData(clubData, false);
      } catch (err) {
        if (isQuotaError(err)) {
          persistAppData(clubData, true);
          flash(
            'Η επαναφορά ολοκληρώθηκε χωρίς βαριές φωτογραφίες (όριο χώρου browser). Ανανέωση…',
          );
          clearDataCache();
          window.setTimeout(() => window.location.reload(), 700);
          return;
        }
        throw err;
      }

      // Club restore: do NOT overwrite all users/clubs from another device by default
      // (that would break the current Vercel login). Platform config is optional.
      const restoreAccounts = window.confirm(
        'Να εισαχθούν επίσης χρήστες & κατάλογος συλλόγων από το backup;\n\n' +
          'Επιλέξτε OK μόνο αν θέλετε πλήρη αντικατάσταση λογαριασμών.\n' +
          'Συνήθως για μεταφορά δεδομένων σε άλλο browser πατήστε Άκυρο ' +
          '(κρατάτε την τρέχουσα σύνδεση, φορτώνονται μόνο τα δεδομένα συλλόγου).',
      );

      if (restoreAccounts) {
        if (parsed.platformConfig) savePlatformConfig(parsed.platformConfig);
        if (parsed.users?.length) saveUsers(parsed.users);
        if (parsed.clubs?.length) saveClubs(parsed.clubs);
        if (parsed.appDataByClub && Object.keys(parsed.appDataByClub).length > 1) {
          try {
            replaceAllClubsData(parsed.appDataByClub);
          } catch {
            /* already wrote current club */
          }
        }
      }

      flash('Η επαναφορά ολοκληρώθηκε. Ανανέωση σελίδας…');
      clearDataCache();
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      setMessage('');
      setError(formatBackupError(err));
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
    // allow re-selecting the same file
    event.target.value = '';
  }

  return (
    <section className="settings-backup">
      <header className="settings-backup-head">
        <h2>Αντίγραφα ασφαλείας</h2>
        <p>
          Backup και επαναφορά όλων των δεδομένων του συλλόγου σας (κινήσεις, μητρώο,
          προϋπολογισμοί, ομάδες, αθλήματα).
        </p>
      </header>

      <div className="settings-backup-block">
        <div className="settings-backup-copy">
          <h3>Λήψη backup</h3>
          <p>Κατεβάζει αρχείο ZIP με όλα τα δεδομένα του συλλόγου.</p>
        </div>
        <div className="settings-backup-panel">
          <Button type="button" className="settings-backup-action" onClick={handleBackupExport}>
            Λήψη backup συλλόγου (ZIP)
          </Button>
        </div>
      </div>

      <div className="settings-backup-block">
        <div className="settings-backup-copy">
          <h3>Επαναφορά από backup</h3>
          <p>
            Εισαγωγή προηγούμενου backup. Τα δεδομένα εφαρμόζονται στον{' '}
            <strong>τρέχοντα σύλλογο</strong> (ακόμα κι αν το backup έγινε από άλλο
            browser / localhost).
          </p>
        </div>
        <div className="settings-backup-panel">
          <input
            ref={fileRef}
            type="file"
            accept="application/zip,.zip,application/json,.json"
            hidden
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="settings-backup-file-btn"
            onClick={() => fileRef.current?.click()}
          >
            Επιλογή αρχείου
          </button>
          <span className="settings-backup-file-name">{fileLabel}</span>
          <p className="settings-hint">Επιλέξτε αρχείο .zip (ή παλιό .json) από προηγούμενο backup.</p>
        </div>
      </div>

      <div className="settings-backup-block">
        <div className="settings-backup-copy">
          <h3>Cloud mirror (πειραματικό)</h3>
          <p>
            Push / Pull δεδομένων συλλόγου μέσω `/api/sync/mirror`. Με Upstash Redis
            (`UPSTASH_REDIS_REST_*` ή `KV_REST_API_*`) η αποθήκευση είναι μόνιμη· αλλιώς
            memory ανά instance. Το Pull αντικαθιστά τα τοπικά δεδομένα.
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
            <p>
              Επαναφορτώνει πλήρες δείγμα (αθλητές, τμήματα, οικονομικά, αποθήκη, ανακοινώσεις
              κ.λπ.) για επίδειξη της εφαρμογής.
            </p>
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
