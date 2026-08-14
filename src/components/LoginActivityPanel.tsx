import { useEffect, useMemo, useState } from 'react';
import {
  fetchLoginActivity,
  type LoginActivityEvent,
} from '../api/services/loginActivityService';
import { roleLabels, type UserRole } from '../auth/auth';
import { getClubs } from '../auth/clubs';
import { Button } from './ui/Button';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function roleLabel(role: string): string {
  return roleLabels[role as UserRole] ?? role;
}

export function LoginActivityPanel({
  onSaved,
}: {
  onSaved?: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<LoginActivityEvent[]>([]);
  const [durable, setDurable] = useState<boolean | null>(null);
  const [clubFilter, setClubFilter] = useState('');
  const [query, setQuery] = useState('');

  const clubs = useMemo(() => getClubs(), []);

  async function load() {
    setLoading(true);
    try {
      const result = await fetchLoginActivity(150);
      if (!result.success || !result.data) {
        onSaved?.(result.error ?? 'Αποτυχία φόρτωσης ιστορικού εισόδων');
        return;
      }
      setEvents(result.data.events);
      setDurable(result.data.durable);
      onSaved?.(
        result.data.durable
          ? `Φορτώθηκαν ${result.data.events.length} είσοδοι (cloud).`
          : `Φορτώθηκαν ${result.data.events.length} είσοδοι (τοπικά / memory).`,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (clubFilter && (e.clubId ?? '') !== clubFilter) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.clubName ?? '').toLowerCase().includes(q) ||
        roleLabel(e.role).toLowerCase().includes(q)
      );
    });
  }, [events, clubFilter, query]);

  return (
    <div className="entry-form admin-entry login-activity-panel">
      <p className="admin-entry-note">
        Ποιος μπήκε, σε ποιον σύλλογο, ρόλος και ώρα. Αποθηκεύεται στο cloud (Blob/Redis) ώστε να
        φαίνεται από κάθε συσκευή.
        {durable === true ? ' Cloud: ενεργό.' : durable === false ? ' Cloud: ανενεργό.' : ''}
      </p>

      <div className="club-users-grid">
        <label className="field">
          <span>Σύλλογος</span>
          <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
            <option value="">Όλοι</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Αναζήτηση</span>
          <input
            type="search"
            value={query}
            placeholder="Όνομα, email…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="admin-entry-actions">
        <Button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Φόρτωση…' : 'Ανανέωση'}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="admin-entry-note" style={{ marginTop: '0.75rem' }}>
          {loading ? 'Φόρτωση…' : 'Δεν υπάρχουν καταγραφές ακόμα.'}
        </p>
      ) : (
        <div className="records-table login-activity-scroll">
          <table>
            <thead>
              <tr>
                {(['Ώρα', 'Χρήστης', 'Σύλλογος', 'Ρόλος', 'Τύπος'] as const).map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="login-activity-when">{formatWhen(e.at)}</td>
                  <td>
                    <div className="login-activity-name">{e.fullName}</div>
                    <div className="login-activity-email">{e.email}</div>
                  </td>
                  <td>{e.clubName ?? '—'}</td>
                  <td>{roleLabel(e.role)}</td>
                  <td>{e.source === 'impersonate' ? 'Impersonate' : 'Σύνδεση'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
