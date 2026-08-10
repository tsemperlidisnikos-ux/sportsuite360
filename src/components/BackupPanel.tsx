import { useRef, useState, type ChangeEvent } from 'react';
import { saveUsers } from '../auth/auth';
import { saveClubs } from '../auth/clubs';
import { Button } from './ui/Button';
import { replaceData } from '../data/repository';
import { savePlatformConfig } from '../platform/platformConfig';
import { downloadBackupZip, readBackupFile } from '../utils/backupArchive';

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState('Δεν επιλέχθηκε κανένα αρχείο.');

  function flash(ok: string) {
    setError('');
    setMessage(ok);
  }

  function handleBackupExport() {
    downloadBackupZip();
    flash('Το backup ZIP κατέβηκε.');
  }

  async function applyBackupFile(file: File) {
    try {
      const parsed = await readBackupFile(file);

      if (parsed.appData) replaceData(parsed.appData);
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
          <div className="ta-table">
            <div className="ta-row ta-header" aria-hidden="true">
              <div className="ta-title">Τίτλος</div>
              <div className="ta-analysis">Ανάλυση</div>
            </div>
            <div className="ta-row">
              <div className="ta-title">Περιεχόμενο</div>
              <div className="ta-analysis">
                ομάδες · αθλήματα · κινήσεις · μητρώο · προϋπολογισμοί · ενεργές καρτέλες
              </div>
            </div>
          </div>
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
          <div className="ta-table">
            <div className="ta-row ta-header" aria-hidden="true">
              <div className="ta-title">Τίτλος</div>
              <div className="ta-analysis">Ανάλυση</div>
            </div>
            <div className="ta-row">
              <div className="ta-title">Αρχείο</div>
              <div className="ta-analysis settings-backup-file-cell">
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
              </div>
            </div>
          </div>
          <p className="settings-hint">Επιλέξτε αρχείο .zip (ή παλιό .json) από προηγούμενο backup.</p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}
    </section>
  );
}
