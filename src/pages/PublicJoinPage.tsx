import { type FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as publicJoinService from '../api/services/publicJoinService';
import {
  getClubPublicRegistration,
  getClubs,
  slugifyClubName,
} from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { getClubData } from '../data/repository';
import type { RegistrationApplicationKind } from '../types';

export function PublicJoinPage() {
  const { slug = '' } = useParams();
  const club = useMemo(() => {
    const normalized = slug.trim().toLowerCase();
    const enabled = getClubs().find((c) => {
      const s = (c.publicRegistration?.slug || slugifyClubName(c.name)).toLowerCase();
      return s === normalized;
    });
    return enabled ?? null;
  }, [slug]);

  const settings = club ? getClubPublicRegistration(club.id) : null;
  const data = club ? getClubData(club.id) : null;
  const classes = (data?.classes ?? []).filter((c) => c.name);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'' | 'boy' | 'girl' | 'other'>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [email, setEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [kind, setKind] = useState<RegistrationApplicationKind>('full');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  const hero = settings?.heroImageUrl || club?.logoUrl || null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!club || !settings?.enabled) return;
    setSaving(true);
    setError('');
    setDone('');
    const result = await publicJoinService.submitPublicJoin({
      clubId: club.id,
      firstName,
      lastName,
      birthDate,
      gender,
      guardianName,
      guardianPhone,
      email,
      classId: classId || null,
      kind,
      notes,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Αποτυχία υποβολής');
      return;
    }
    setDone(result.data?.message ?? 'Η αίτηση καταχωρήθηκε.');
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setGender('');
    setGuardianName('');
    setGuardianPhone('');
    setEmail('');
    setClassId('');
    setNotes('');
    setKind('full');
  }

  if (!club) {
    return (
      <div className="public-join-page">
        <div className="public-join-card">
          <h1>Ο σύνδεσμος δεν βρέθηκε</h1>
          <p className="muted">Ελέγξτε το URL ή επικοινωνήστε με τον σύλλογο.</p>
          <Link to="/login" className="text-link">
            Σύνδεση →
          </Link>
        </div>
      </div>
    );
  }

  if (!settings?.enabled) {
    return (
      <div className="public-join-page">
        <div className="public-join-card">
          <h1>{club.name}</h1>
          <p className="muted">Η δημόσια εγγραφή δεν είναι ενεργή αυτή τη στιγμή.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-join-page">
      <div className="public-join-shell">
        <header className="public-join-hero">
          {hero ? (
            <img className="public-join-hero-img" src={hero} alt={club.name} />
          ) : (
            <div className="public-join-hero-fallback">
              <span>{club.name.slice(0, 1)}</span>
            </div>
          )}
          <div className="public-join-hero-copy">
            <p className="public-join-eyebrow">Δημόσια εγγραφή</p>
            <h1>{club.name}</h1>
            {club.city ? <p className="muted">{club.city}</p> : null}
          </div>
        </header>

        <form className="public-join-card" onSubmit={(e) => void handleSubmit(e)}>
          <h2>Φόρμα εγγραφής αθλητή</h2>
          <p className="lede">Συμπληρώστε τα στοιχεία. Θα ενημερωθείτε μετά τον έλεγχο από τον σύλλογο.</p>

          <div className="public-join-grid">
            <label className="field">
              <span className="field-label">Όνομα *</span>
              <input
                className="field-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Επώνυμο *</span>
              <input
                className="field-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Ημ/νία γέννησης</span>
              <input
                className="field-input"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Φύλο</span>
              <select
                className="field-input"
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
              >
                <option value="">—</option>
                <option value="boy">Αγόρι</option>
                <option value="girl">Κορίτσι</option>
                <option value="other">Άλλο</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Κηδεμόνας *</span>
              <input
                className="field-input"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Τηλ. κηδεμόνα *</span>
              <input
                className="field-input"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Τμήμα</span>
              <select
                className="field-input"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">—</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                    {cls.sport ? ` · ${cls.sport}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="public-join-kind">
            <legend>Τύπος αίτησης</legend>
            <label>
              <input
                type="radio"
                name="kind"
                checked={kind === 'full'}
                onChange={() => setKind('full')}
              />
              Πλήρης εγγραφή
            </label>
            {settings.allowTrial ? (
              <label>
                <input
                  type="radio"
                  name="kind"
                  checked={kind === 'trial'}
                  onChange={() => setKind('trial')}
                />
                Δοκιμαστική προπόνηση
              </label>
            ) : null}
            {settings.allowWaitlist ? (
              <label>
                <input
                  type="radio"
                  name="kind"
                  checked={kind === 'waitlist'}
                  onChange={() => setKind('waitlist')}
                />
                Λίστα αναμονής
              </label>
            ) : null}
          </fieldset>

          <label className="field">
            <span className="field-label">Σχόλια</span>
            <textarea
              className="field-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {done ? <p className="settings-success">{done}</p> : null}

          <Button type="submit" disabled={saving}>
            {saving ? 'Υποβολή…' : 'Υποβολή αίτησης'}
          </Button>
        </form>
      </div>
    </div>
  );
}
