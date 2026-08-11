import { useRef, useState, type ChangeEvent } from 'react';
import * as backendSyncService from '../api/services/backendSyncService';
import { getSession, saveUsers } from '../auth/auth';
import { saveClubs } from '../auth/clubs';
import { Button } from './ui/Button';
import { replaceAllClubsData, replaceData } from '../data/repository';
import { getPreviewClubId, savePlatformConfig } from '../platform/platformConfig';
import { downloadBackupZip, readBackupFile } from '../utils/backupArchive';

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState('Δεν επιλέχθηκε κανένα αρχείο.');
  const [syncing, setSyncing] = useState(false);

  const clubId = getPreviewClubId() ?? getSession()?.clubId ?? null;

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
    setSyncing(true);
    setError('');
    const result = await backendSyncService.pushClubMirror(clubId);
    setSyncing(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία push');
      return;
    }
    flash(
      `Cloud mirror ενημερώθηκε${result.data?.updatedAt ? ` · ${result.data.updatedAt}` : ''}.`,
    );
  }

  async function applyBackupFile(file: File) {
    try {
      const parsed = await readBackupFile(file);

      if (parsed.appDataByClub && Object.keys(parsed.appDataByClub).length > 0) {
        replaceAllClubsData(parsed.appDataByClub);
      } else if (parsed.appData) {
        replaceData(parsed.appData);
      }
      if (parsed.platformConfig) savePlatformConfig(parsed.platformConfig);
      if (parsed.users?.length) saveUsers(parsed.users);
      if (parsed.clubs?.length) saveClubs(parsed.clubs);

      flash('Η επαναφορά ολοκληρώθηκε. Ανανέωση σελίδας…');
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : 'Μη έγκυρο αρχείο backup.');
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
          <p>Εισαγωγή προηγούμενου backup συλλόγου. Αντικαθιστά τα υπάρχοντα δεδομένα.</p>
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
            Push δεδομένων συλλόγου στο `/api/sync/mirror` (βάση για μελλοντικό backend). Προσωρινή
            αποθήκευση ανά instance Vercel μέχρι DB/KV.
          </p>
        </div>
        <div className="settings-backup-panel">
          <Button
            type="button"
            className="settings-backup-action"
            disabled={syncing || !clubId}
            onClick={() => void handlePushMirror()}
          >
            {syncing ? 'Συγχρονισμός…' : 'Push mirror συλλόγου'}
          </Button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}
    </section>
  );
}
