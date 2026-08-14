import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as publicClubCloudService from '../api/services/publicClubCloudService';
import * as publicJoinService from '../api/services/publicJoinService';
import type { RemotePublicClub } from '../api/services/publicClubCloudService';
import {
  getClubPublicRegistration,
  getClubs,
  slugifyClubName,
} from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { getClubData } from '../data/repository';
import { DEFAULT_TERMS_OF_USE_HTML } from '../shared/termsDefaults';
import type { RegistrationApplicationKind } from '../types';

type JoinClubView = {
  source: 'local' | 'remote';
  clubId: string;
  slug: string;
  name: string;
  city: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  enabled: boolean;
  allowTrial: boolean;
  allowWaitlist: boolean;
  classes: Array<{ id: string; name: string; sport?: string }>;
  termsHtml: string;
};

function fromRemote(club: RemotePublicClub): JoinClubView {
  return {
    source: 'remote',
    clubId: club.clubId,
    slug: club.slug,
    name: club.name,
    city: club.city || '',
    logoUrl: club.logoUrl,
    heroImageUrl: club.heroImageUrl,
    enabled: club.enabled,
    allowTrial: club.allowTrial,
    allowWaitlist: club.allowWaitlist,
    classes: club.classes ?? [],
    termsHtml: club.termsHtml?.trim() || DEFAULT_TERMS_OF_USE_HTML,
  };
}

export function PublicJoinPage() {
  const { slug = '' } = useParams();
  const [club, setClub] = useState<JoinClubView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'' | 'boy' | 'girl' | 'other'>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<RegistrationApplicationKind>('full');
  const [notes, setNotes] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError('');
      const normalized = slug.trim().toLowerCase();
      const local = getClubs().find((c) => {
        const s = (c.publicRegistration?.slug || slugifyClubName(c.name)).toLowerCase();
        return s === normalized;
      });
      if (local) {
        const settings = getClubPublicRegistration(local.id);
        const data = getClubData(local.id);
        if (!cancelled) {
          setClub({
            source: 'local',
            clubId: local.id,
            slug: settings.slug,
            name: local.name,
            city: local.city || '',
            logoUrl: local.logoUrl ?? null,
            heroImageUrl: settings.heroImageUrl ?? null,
            enabled: settings.enabled,
            allowTrial: settings.allowTrial,
            allowWaitlist: settings.allowWaitlist,
            classes: (data.classes ?? []).filter((c) => c.name),
            termsHtml: data.termsOfUseHtml?.trim() || DEFAULT_TERMS_OF_USE_HTML,
          });
          setLoading(false);
        }
        return;
      }

      const remote = await publicClubCloudService.fetchPublicClubBySlug(normalized);
      if (cancelled) return;
      if (!remote.success || !remote.data?.club) {
        setClub(null);
        setLoadError(remote.error ?? 'Ο σύνδεσμος δεν βρέθηκε.');
        setLoading(false);
        return;
      }
      setClub(fromRemote(remote.data.club));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const hero = useMemo(
    () => club?.heroImageUrl || club?.logoUrl || null,
    [club?.heroImageUrl, club?.logoUrl],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!club || !club.enabled) return;
    if (!acceptedTerms) {
      setError('Πρέπει να αποδεχτείτε τους όρους χρήσης / GDPR.');
      return;
    }
    setSaving(true);
    setError('');
    setDone('');

    const payload = {
      firstName,
      lastName,
      birthDate,
      gender,
      guardianName,
      guardianPhone,
      email,
      classId: null,
      kind,
      notes,
      acceptedTerms,
    };

    let message = '';
    if (club.source === 'local') {
      const localResult = await publicJoinService.submitPublicJoin({
        clubId: club.clubId,
        ...payload,
      });
      if (!localResult.success) {
        setSaving(false);
        setError(localResult.error ?? 'Αποτυχία υποβολής');
        return;
      }
      message = localResult.data?.message ?? 'Η αίτηση καταχωρήθηκε.';
      if (localResult.data?.guardianEmailSent) {
        message += ' Στάλθηκε email επιβεβαίωσης.';
      }
      // Also push to cloud so other devices / staff pull can see it.
      void publicClubCloudService.submitPublicJoinRemote({
        slug: club.slug,
        ...payload,
      });
    } else {
      const remoteResult = await publicClubCloudService.submitPublicJoinRemote({
        slug: club.slug,
        ...payload,
      });
      if (!remoteResult.success || !remoteResult.data) {
        setSaving(false);
        setError(remoteResult.error ?? 'Αποτυχία υποβολής');
        return;
      }
      message = remoteResult.data.message;
      if (remoteResult.data.guardianEmailSent) {
        message += ' Στάλθηκε email επιβεβαίωσης.';
      }
    }

    setSaving(false);
    setDone(message);
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
    setAcceptedTerms(false);
  }

  if (loading) {
    return (
      <div className="public-join-page">
        <div className="public-join-card">
          <h1>Φόρτωση…</h1>
          <p className="muted">Ελέγχουμε τον σύνδεσμο εγγραφής.</p>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="public-join-page">
        <div className="public-join-card">
          <h1>Ο σύνδεσμος δεν βρέθηκε</h1>
          <p className="muted">{loadError || 'Ελέγξτε το URL ή επικοινωνήστε με τον σύλλογο.'}</p>
          <Link to="/login" className="text-link">
            Σύνδεση →
          </Link>
        </div>
      </div>
    );
  }

  if (!club.enabled) {
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
          <p className="lede">
            Συμπληρώστε τα στοιχεία. Θα ενημερωθείτε μετά τον έλεγχο από τον σύλλογο.
          </p>

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
              <span className="field-label">Γονέας *</span>
              <input
                className="field-input"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Τηλ. γονέα *</span>
              <input
                className="field-input"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Email γονέα</span>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Για επιβεβαίωση αίτησης"
              />
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
            {club.allowTrial ? (
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
            {club.allowWaitlist ? (
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

          <div className="public-join-terms">
            {club.termsHtml ? (
              <details className="public-join-terms-details">
                <summary>Όροι χρήσης / πολιτική απορρήτου</summary>
                <div
                  className="public-join-terms-body"
                  dangerouslySetInnerHTML={{ __html: club.termsHtml }}
                />
              </details>
            ) : (
              <p className="muted">
                Με την υποβολή δηλώνετε ότι συναινείτε στην επεξεργασία των προσωπικών δεδομένων
                από τον σύλλογο για σκοπούς εγγραφής.
              </p>
            )}
            <label className="public-reg-check">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
              />
              <span>Αποδέχομαι τους όρους χρήσης και τη συναίνεση GDPR *</span>
            </label>
          </div>

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
