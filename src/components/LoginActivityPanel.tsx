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
    <div className="entry-form admin-entry">
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
        <div className="records-table" style={{ marginTop: '0.75rem', maxHeight: 360, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>Ώρα</th>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>Χρήστης</th>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>Σύλλογος</th>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>Ρόλος</th>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>Τύπος</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}>
                    {formatWhen(e.at)}
                  </td>
                  <td style={{ padding: '0.35rem 0.4rem' }}>
                    <div>{e.fullName}</div>
                    <div style={{ opacity: 0.7 }}>{e.email}</div>
                  </td>
                  <td style={{ padding: '0.35rem 0.4rem' }}>{e.clubName ?? '—'}</td>
                  <td style={{ padding: '0.35rem 0.4rem' }}>{roleLabel(e.role)}</td>
                  <td style={{ padding: '0.35rem 0.4rem' }}>
                    {e.source === 'impersonate' ? 'Impersonate' : 'Σύνδεση'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
