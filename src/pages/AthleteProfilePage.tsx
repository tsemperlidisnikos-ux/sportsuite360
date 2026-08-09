import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import * as studentsService from '../api/services/studentsService';
import { Button } from '../components/ui/Button';
import { useAppData } from '../hooks/useAppData';
import type { StudentInput } from '../schemas';
import type { Gender, Student } from '../types';
import { buildHealthCardPdf } from '../utils/healthCardPdf';

const MONTH_LABELS = [
  'Αύγουστος',
  'Σεπτέμβριος',
  'Οκτώβριος',
  'Νοέμβριος',
  'Δεκέμβριος',
  'Ιανουάριος',
  'Φεβρουάριος',
  'Μάρτιος',
  'Απρίλιος',
  'Μάιος',
  'Ιούνιος',
  'Ιούλιος',
];

function seasonMonths(startYear: number) {
  return MONTH_LABELS.map((label, index) => {
    const year = index < 5 ? startYear : startYear + 1;
    const month = ((index + 7) % 12) + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return { label: `${label} ${year}`, key, year, month };
  });
}

function toForm(student: Student): StudentInput {
  return {
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    phone: student.phone,
    birthDate: student.birthDate,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    classId: student.classId,
    status: student.status,
    monthlyFee: student.monthlyFee,
    amka: student.amka ?? '',
    gender: student.gender ?? '',
    fatherFirstName: student.fatherFirstName ?? '',
    motherFirstName: student.motherFirstName ?? '',
    fatherEmail: student.fatherEmail ?? '',
    motherEmail: student.motherEmail ?? '',
    motherPhone: student.motherPhone ?? '',
    address: student.address ?? '',
    postalCode: student.postalCode ?? '',
    city: student.city ?? '',
    clubName: student.clubName ?? 'AcademyHub',
    registrationNumber: student.registrationNumber ?? '',
    sport: student.sport ?? '',
    healthCardStatus: student.healthCardStatus ?? '',
    healthCard: student.healthCard ?? student.healthCardStatus === 'Έγκυρη',
    uniformReceived: student.uniformReceived ?? false,
    uniformSize: student.uniformSize ?? '',
    registrationFee: student.registrationFee ?? 0,
    registrationCharge: student.registrationCharge ?? (student.registrationFee ?? 0) > 0,
    monthlyCharge: student.monthlyCharge ?? true,
    seasonTicket: student.seasonTicket ?? false,
    subscriptionDiscount: student.subscriptionDiscount ?? false,
    discountAmount: student.discountAmount ?? 0,
    discountReason: student.discountReason ?? '',
    comments: student.comments ?? '',
    photoUrl: student.photoUrl ?? null,
    gdprConsent: student.gdprConsent ?? 'pending',
    gdprItems: student.gdprItems ?? {
      personalData: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      photoUse: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      gallery: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      communication: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      medical: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
    },
  };
}

const DISCOUNT_REASONS = [
  { value: '', label: '—' },
  { value: 'siblings', label: 'Αδέλφια' },
  { value: 'annual', label: 'Ετήσια συνδρομή' },
  { value: 'social', label: 'Κοινωνικό κριτήριο' },
  { value: 'other', label: 'Άλλο' },
];

const YES_NO = [
  { value: 'yes', label: 'Ναι' },
  { value: 'no', label: 'Όχι' },
];

const UNIFORM_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export function AthleteProfilePage() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, refresh } = useAppData();
  const student = data.students.find((s) => s.id === athleteId);

  const [editing, setEditing] = useState(
    Boolean((location.state as { editing?: boolean } | null)?.editing),
  );
  const [form, setForm] = useState<StudentInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [seasonStart, setSeasonStart] = useState(2026);
  const [gdprOpen, setGdprOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(false);
  const [loadingHealthCardPreview, setLoadingHealthCardPreview] = useState(false);
  const healthCardPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (student) setForm(toForm(student));
  }, [student]);

  useEffect(() => {
    if ((location.state as { editing?: boolean } | null)?.editing) {
      setEditing(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    return () => {
      if (healthCardPreviewUrlRef.current) {
        URL.revokeObjectURL(healthCardPreviewUrlRef.current);
      }
    };
  }, []);

  const months = useMemo(() => seasonMonths(seasonStart), [seasonStart]);

  const clubOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...(data.associations ?? [])
        .filter((a) => a.active)
        .map((a) => ({ value: a.name, label: a.name })),
    ],
    [data.associations],
  );

  const sportOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...(data.sports ?? [])
        .filter((s) => s.active)
        .map((s) => ({ value: s.name, label: s.name })),
    ],
    [data.sports],
  );

  const financeRows = useMemo(() => {
    if (!student) return [];
    const athleteTx = (data.transactions ?? []).filter((t) => t.athleteId === student.id);
    return months.map((m) => {
      const monthTx = athleteTx.filter((t) => t.month === m.month && t.year === m.year);
      const charge = monthTx
        .filter((t) => t.type === 'charge')
        .reduce((sum, t) => sum + t.amount, 0);
      const payment = monthTx
        .filter((t) => t.type === 'payment')
        .reduce((sum, t) => sum + t.amount, 0);
      const attendance = data.attendance.filter(
        (a) => a.studentId === student.id && a.date.startsWith(m.key),
      );
      const present = attendance.filter((a) => a.present).length;
      const absent = attendance.filter((a) => !a.present).length;
      return {
        ...m,
        charge,
        payment,
        balance: charge - payment,
        trainings: attendance.length,
        present,
        absent,
      };
    });
  }, [months, student, data.transactions, data.attendance]);

  const totals = useMemo(
    () =>
      financeRows.reduce(
        (acc, row) => ({
          charge: acc.charge + row.charge,
          payment: acc.payment + row.payment,
          balance: acc.balance + row.balance,
          trainings: acc.trainings + row.trainings,
          present: acc.present + row.present,
          absent: acc.absent + row.absent,
        }),
        { charge: 0, payment: 0, balance: 0, trainings: 0, present: 0, absent: 0 },
      ),
    [financeRows],
  );

  if (!student || !form) {
    return (
      <div className="stack-lg">
        <p className="form-error">Ο αθλητής δεν βρέθηκε.</p>
        <Link className="btn btn-primary" to="/athletes">
          Πίσω στους αθλητές
        </Link>
      </div>
    );
  }

  function setField<K extends keyof StudentInput>(key: K, value: StudentInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form || !student) return;
    setSaving(true);
    setError('');
    const payload: StudentInput = {
      ...form,
      guardianName: form.fatherFirstName
        ? `${form.fatherFirstName} ${form.lastName}`.trim()
        : form.guardianName,
      guardianPhone: form.phone || form.guardianPhone,
    };
    const result = await studentsService.updateStudent(student.id, payload);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    setEditing(false);
    refresh();
  }

  function handleCancel() {
    if (!student) return;
    setForm(toForm(student));
    setEditing(false);
    setError('');
  }

  function handlePhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setField('photoUrl', String(reader.result));
      setEditing(true);
    };
    reader.readAsDataURL(file);
  }

  async function openHealthCardPreview() {
    if (!form) return;
    setLoadingHealthCardPreview(true);
    setError('');
    const result = await buildHealthCardPdf({
      sport: form.sport,
      amka: form.amka,
      gender: form.gender,
      lastName: form.lastName,
      firstName: form.firstName,
      email: form.email,
      birthDate: form.birthDate,
      registrationNumber: form.registrationNumber,
      clubName: form.clubName,
      fatherFirstName: form.fatherFirstName,
      motherFirstName: form.motherFirstName,
      guardianPhone: form.guardianPhone,
      motherPhone: form.motherPhone,
      fatherEmail: form.fatherEmail,
      motherEmail: form.motherEmail,
      photoUrl: form.photoUrl,
    });
    setLoadingHealthCardPreview(false);
    if (!result.success || !result.data) {
      setError(result.error ?? 'Αποτυχία δημιουργίας PDF κάρτας υγείας');
      return;
    }

    if (healthCardPreviewUrlRef.current) {
      URL.revokeObjectURL(healthCardPreviewUrlRef.current);
    }
    const pdfUrl = URL.createObjectURL(result.data);
    healthCardPreviewUrlRef.current = pdfUrl;

    const features = [
      'popup=yes',
      'noopener=no',
      'noreferrer=no',
      `width=${screen.availWidth}`,
      `height=${screen.availHeight}`,
      'left=0',
      'top=0',
    ].join(',');

    const previewWindow = window.open('', 'healthCardPreview', features);
    if (!previewWindow) {
      setError('Επίτρεψε τα pop-up για την προεπισκόπηση κάρτας υγείας');
      return;
    }

    previewWindow.opener = null;
    previewWindow.document.write(`<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <title>Προεπισκόπηση κάρτας υγείας</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      height: 100%;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #525659;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 20px;
      background: #fff;
      border-bottom: 1px solid #cfe0db;
    }
    h1 {
      margin: 0;
      font-size: 18px;
      color: #111;
    }
    .actions { display: flex; gap: 10px; }
    button {
      border: 0;
      border-radius: 10px;
      padding: 8px 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-print {
      background: #0f766e;
      color: #fff;
    }
    .btn-close {
      background: #e6f4f1;
      color: #1a2e2a;
      border: 1px solid #cfe0db;
    }
    iframe {
      display: block;
      width: 100%;
      height: calc(100% - 61px);
      border: 0;
      background: #525659;
    }
  </style>
</head>
<body>
  <header>
    <h1>Προεπισκόπηση κάρτας υγείας</h1>
    <div class="actions">
      <button class="btn-print" type="button" onclick="document.getElementById('pdf').contentWindow.print()">Εκτύπωση</button>
      <button class="btn-close" type="button" onclick="window.close()">Κλείσιμο</button>
    </div>
  </header>
  <iframe id="pdf" title="Κάρτα υγείας" src="${pdfUrl}"></iframe>
  <script>
    try {
      window.moveTo(0, 0);
      window.resizeTo(screen.availWidth, screen.availHeight);
    } catch (e) {}
  </script>
</body>
</html>`);
    previewWindow.document.close();
    try {
      previewWindow.focus();
    } catch {
      // ignore
    }
  }

  const textInput = (
    value: string | undefined,
    onChange: (v: string) => void,
    opts?: { type?: string; className?: string; upper?: boolean },
  ) => (
    <input
      type={opts?.type ?? 'text'}
      className={`profile-row-input${opts?.className ? ` ${opts.className}` : ''}${opts?.upper ? ' profile-row-input--uppercase' : ''}`}
      value={value ?? ''}
      disabled={!editing}
      onChange={(e) =>
        onChange(opts?.upper ? e.target.value.toUpperCase() : e.target.value)
      }
    />
  );

  const yesNo = (value: boolean, onChange: (v: boolean) => void) => (
    <select
      className="profile-row-input profile-yes-no-select"
      value={value ? 'yes' : 'no'}
      disabled={!editing}
      onChange={(e) => onChange(e.target.value === 'yes')}
    >
      {YES_NO.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const classLabel =
    data.classes.find((c) => c.id === form.classId)?.name ||
    'Δεν έχει οριστεί σε τμήμα.';

  return (
    <div className="athlete-profile-page">
      <header className="ap-page-header">
        <div>
          <button type="button" className="text-link" onClick={() => navigate('/athletes')}>
            ← Αθλητές
          </button>
          <h1>
            {student.lastName} {student.firstName}
          </h1>
        </div>
        <div className="ap-page-actions">
          {!editing ? (
            <Button type="button" onClick={() => setEditing(true)}>
              Επεξεργασία προφίλ
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Ακύρωση
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </Button>
            </>
          )}
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="athlete-profile-grid">
        <section className="page-panel page-panel--profile-personal">
          <div className="athlete-finance-header profile-personal-header">
            <span className="profile-personal-header-spacer" aria-hidden="true" />
            <h2 className="athlete-finance-title">Προσωπικά</h2>
            <span className="profile-personal-header-spacer" aria-hidden="true" />
          </div>

          <div className="profile-personal-body">
            <div className="profile-personal-split">
              <div className="profile-fields">
                <div className="profile-row profile-row--assoc-team profile-row--amka-gender">
                  <span className="profile-row-label">ΑΜΚΑ</span>
                  <div className="profile-assoc-team-row">
                    <div className="profile-assoc-team-cell">
                      {textInput(form.amka, (v) => setField('amka', v))}
                    </div>
                    <span className="profile-assoc-team-gap-label profile-assoc-team-gap-label--gender">
                      Φύλο
                    </span>
                    <div className="profile-assoc-team-cell">
                      <select
                        className="profile-row-input profile-row-input--uppercase"
                        value={form.gender ?? ''}
                        disabled={!editing}
                        onChange={(e) => setField('gender', e.target.value as Gender)}
                      >
                        <option value="">—</option>
                        <option value="boy">ΑΓΟΡΙ</option>
                        <option value="girl">ΚΟΡΙΤΣΙ</option>
                        <option value="other">ΑΛΛΟ</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="profile-row profile-row--compact profile-row--name">
                  <span className="profile-row-label">Επώνυμο</span>
                  <div className="profile-row-value">
                    {textInput(form.lastName, (v) => setField('lastName', v), { upper: true })}
                  </div>
                </div>

                <div className="profile-row profile-row--compact profile-row--name">
                  <span className="profile-row-label">Όνομα</span>
                  <div className="profile-row-value">
                    {textInput(form.firstName, (v) => setField('firstName', v), {
                      upper: true,
                    })}
                  </div>
                </div>

                <div className="profile-row profile-row--compact">
                  <span className="profile-row-label">Ημερομηνία γέννησης</span>
                  <div className="profile-row-value">
                    {textInput(form.birthDate, (v) => setField('birthDate', v), {
                      type: 'date',
                      className: 'profile-row-input--date',
                    })}
                  </div>
                </div>

                <div className="profile-row profile-row--assoc-team">
                  <span className="profile-row-label">Email αθλητή / τριας</span>
                  <div className="profile-assoc-team-row">
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--email-contact">
                      {textInput(form.email, (v) => setField('email', v), {
                        type: 'email',
                        className: 'profile-row-input--email-contact',
                      })}
                    </div>
                    <span className="profile-assoc-team-gap-label">Τηλέφωνο αθλητή / τριας</span>
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--phone">
                      {textInput(form.phone, (v) => setField('phone', v), {
                        type: 'tel',
                        className: 'profile-row-input--phone',
                      })}
                    </div>
                  </div>
                </div>

                <div className="profile-row profile-row--assoc-team">
                  <span className="profile-row-label">Πατρώνυμο</span>
                  <div className="profile-assoc-team-row profile-assoc-team-row--patronymic">
                    <div className="profile-assoc-team-cell">
                      {textInput(form.fatherFirstName, (v) => setField('fatherFirstName', v), {
                        upper: true,
                      })}
                    </div>
                    <span className="profile-assoc-team-gap-label">Μητρώνυμο</span>
                    <div className="profile-assoc-team-cell">
                      {textInput(form.motherFirstName, (v) => setField('motherFirstName', v), {
                        upper: true,
                      })}
                    </div>
                  </div>
                </div>

                <div className="profile-row profile-row--assoc-team">
                  <span className="profile-row-label">Email πατρός</span>
                  <div className="profile-assoc-team-row profile-assoc-team-row--parents-email">
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--email-contact">
                      {textInput(form.fatherEmail, (v) => setField('fatherEmail', v), {
                        type: 'email',
                        className: 'profile-row-input--email-contact',
                      })}
                    </div>
                    <span className="profile-assoc-team-gap-label">Email μητρός</span>
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--email-contact">
                      {textInput(form.motherEmail, (v) => setField('motherEmail', v), {
                        type: 'email',
                        className: 'profile-row-input--email-contact',
                      })}
                    </div>
                  </div>
                </div>

                <div className="profile-row profile-row--assoc-team">
                  <span className="profile-row-label">Τηλέφωνο πατρός</span>
                  <div className="profile-assoc-team-row">
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--phone">
                      {textInput(form.guardianPhone, (v) => setField('guardianPhone', v), {
                        type: 'tel',
                        className: 'profile-row-input--phone',
                      })}
                    </div>
                    <span className="profile-assoc-team-gap-label">Τηλέφωνο μητρός</span>
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--phone">
                      {textInput(form.motherPhone, (v) => setField('motherPhone', v), {
                        type: 'tel',
                        className: 'profile-row-input--phone',
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="profile-photo-aside">
                <div className="profile-photo-section">
                  <div className="profile-photo-frame">
                    {form.photoUrl ? (
                      <img
                        src={form.photoUrl}
                        alt="Φωτογραφία αθλητή"
                        className="profile-photo-preview"
                      />
                    ) : (
                      <div className="profile-photo-preview profile-photo-preview--empty" />
                    )}
                    <div className="profile-photo-actions">
                      <label className="profile-photo-upload">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            handlePhoto(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                        <span className="btn-secondary btn-sm">Ανέβασμα</span>
                      </label>
                      {form.photoUrl ? (
                        <button
                          type="button"
                          className="btn-red btn-sm"
                          onClick={() => {
                            setField('photoUrl', null);
                            setEditing(true);
                          }}
                        >
                          Διαγραφή
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-fields">
              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Διεύθυνση</span>
                <div className="profile-assoc-team-row profile-assoc-team-row--address">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--address">
                    {textInput(form.address, (v) => setField('address', v), { upper: true })}
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Τ.Κ. / Πόλη</span>
                <div className="profile-assoc-team-row profile-assoc-team-row--postal-city">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--postal">
                    {textInput(form.postalCode, (v) => setField('postalCode', v), {
                      className: 'profile-row-input--postal',
                    })}
                  </div>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--city">
                    {textInput(form.city, (v) => setField('city', v), { upper: true })}
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Σωματείο</span>
                <div className="profile-assoc-team-row profile-assoc-team-row--registration">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--association">
                    <select
                      className="profile-row-input"
                      value={form.clubName ?? ''}
                      disabled={!editing}
                      onChange={(e) => setField('clubName', e.target.value)}
                    >
                      {clubOptions.map((o) => (
                        <option key={o.value || 'empty'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="profile-assoc-team-gap-label">Τμήμα</span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--team">
                    {editing ? (
                      <select
                        className="profile-row-input"
                        value={form.classId ?? ''}
                        onChange={(e) => setField('classId', e.target.value || null)}
                      >
                        <option value="">Δεν έχει οριστεί σε τμήμα.</option>
                        {data.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="profile-team-inline-field">
                        <span
                          className={
                            form.classId ? undefined : 'profile-team-inline-empty'
                          }
                        >
                          {classLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Αρ. Δελτίου</span>
                <div className="profile-assoc-team-row profile-assoc-team-row--registration-sport-health">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--registration-no">
                    {textInput(form.registrationNumber, (v) => setField('registrationNumber', v), {
                      className: 'profile-registration-card-input',
                    })}
                  </div>
                  <span className="profile-assoc-team-gap-label">Άθλημα</span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--sport">
                    <select
                      className="profile-row-input profile-sport-input"
                      value={form.sport ?? ''}
                      disabled={!editing}
                      onChange={(e) => setField('sport', e.target.value)}
                    >
                      {sportOptions.map((o) => (
                        <option key={o.value || 'empty'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="profile-assoc-team-gap-label">Κάρτα υγείας</span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--health">
                    <div className="profile-health-card-row">
                      {yesNo(Boolean(form.healthCard), (v) => {
                        setField('healthCard', v);
                        setField('healthCardStatus', v ? 'Έγκυρη' : 'Όχι');
                      })}
                      {form.healthCard ? (
                        <button
                          type="button"
                          className="btn-sm profile-health-card-preview-btn"
                          disabled={loadingHealthCardPreview}
                          onClick={() => void openHealthCardPreview()}
                        >
                          {loadingHealthCardPreview ? 'Φόρτωση...' : 'Προεπισκόπηση'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Παραλαβή στολής</span>
                <div className="profile-assoc-team-row profile-assoc-team-row--uniform">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--yes-no">
                    {yesNo(Boolean(form.uniformReceived), (v) =>
                      setField('uniformReceived', v),
                    )}
                  </div>
                  <div className="profile-uniform-size-group">
                    <span className="profile-assoc-team-gap-label profile-assoc-team-gap-label--tight">
                      Μέγεθος Στολής
                    </span>
                    <div className="profile-assoc-team-cell profile-assoc-team-cell--uniform-size">
                      <select
                        className="profile-row-input profile-uniform-size-input"
                        value={form.uniformSize ?? ''}
                        disabled={!editing}
                        onChange={(e) => setField('uniformSize', e.target.value)}
                      >
                        <option value="">—</option>
                        {UNIFORM_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Χρέωση Εγγραφής</span>
                <div className="profile-triple-row profile-triple-row--fees">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--yes-no">
                    {yesNo(Boolean(form.registrationCharge), (v) =>
                      setField('registrationCharge', v),
                    )}
                  </div>
                  <span className="profile-assoc-team-gap-label">Χρέωση Μήνα</span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--yes-no">
                    {yesNo(form.monthlyCharge !== false, (v) => setField('monthlyCharge', v))}
                  </div>
                  <span className="profile-assoc-team-gap-label">Εισιτήριο Διαρκείας</span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--yes-no">
                    {yesNo(Boolean(form.seasonTicket), (v) => setField('seasonTicket', v))}
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--assoc-team">
                <span className="profile-row-label">Έκπτωση συνδρομής</span>
                <div className="profile-assoc-team-row profile-assoc-team-row--discount">
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--yes-no">
                    {yesNo(Boolean(form.subscriptionDiscount), (v) =>
                      setField('subscriptionDiscount', v),
                    )}
                  </div>
                  <span className="profile-assoc-team-gap-label profile-assoc-team-gap-label--tight">
                    Μηνιαίο ποσό έκπτωσης
                  </span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--discount">
                    <div className="profile-currency-input">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="profile-row-input profile-discount-amount-input"
                        value={form.discountAmount ?? 0}
                        disabled={!editing}
                        onChange={(e) =>
                          setField('discountAmount', Number(e.target.value))
                        }
                      />
                      <span className="profile-currency-suffix" aria-hidden="true">
                        €
                      </span>
                    </div>
                  </div>
                  <span className="profile-assoc-team-gap-label">Λόγος έκπτωσης</span>
                  <div className="profile-assoc-team-cell profile-assoc-team-cell--discount-reason">
                    <select
                      className="profile-row-input profile-discount-reason-input"
                      value={form.discountReason ?? ''}
                      disabled={!editing}
                      onChange={(e) => setField('discountReason', e.target.value)}
                    >
                      {DISCOUNT_REASONS.map((o) => (
                        <option key={o.value || 'empty'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="profile-row profile-row--comments">
                <span className="profile-row-label">Σχόλια</span>
                <div className="profile-row-value">
                  <textarea
                    className="profile-row-input profile-row-input--comments profile-row-input--uppercase"
                    rows={3}
                    disabled={!editing}
                    value={form.comments ?? ''}
                    onChange={(e) => setField('comments', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="ap-gdpr-block">
                <button
                  type="button"
                  className="ap-gdpr-toggle"
                  onClick={() => setGdprOpen((v) => !v)}
                >
                  <span>GDPR / Συναίνεση ανηλίκων</span>
                  {gdprOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <div className="ap-gdpr-pills">
                  <span
                    className={`ap-pill ${
                      form.gdprConsent === 'full' || form.gdprConsent === 'locked'
                        ? 'ap-pill-ok'
                        : ''
                    }`}
                  >
                    {form.gdprConsent === 'full' || form.gdprConsent === 'locked'
                      ? 'Πλήρης συναίνεση'
                      : 'Εκκρεμής συναίνεση'}
                  </span>
                  <span
                    className={`ap-pill ${form.gdprConsent === 'locked' ? 'ap-pill-locked' : ''}`}
                  >
                    {form.gdprConsent === 'locked' ? 'Κλειδωμένο' : 'Ξεκλείδωτο'}
                  </span>
                </div>
                {gdprOpen ? (
                  <ul className="ap-gdpr-list">
                    {(
                      [
                        ['personalData', 'Επεξεργασία προσωπικών δεδομένων'],
                        ['photoUse', 'Χρήση φωτογραφίας'],
                        ['gallery', 'Δημοσίευση gallery'],
                        ['communication', 'Επικοινωνία'],
                        ['medical', 'Ιατρικά δεδομένα'],
                      ] as const
                    ).map(([key, label]) => (
                      <li key={key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(form.gdprItems?.[key])}
                            disabled={!editing || form.gdprConsent === 'locked'}
                            onChange={(e) => {
                              const next = {
                                personalData: false,
                                photoUse: false,
                                gallery: false,
                                communication: false,
                                medical: false,
                                ...form.gdprItems,
                                [key]: e.target.checked,
                              };
                              setField('gdprItems', next);
                              const allOn = Object.values(next).every(Boolean);
                              setField('gdprConsent', allOn ? 'full' : 'pending');
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <button
                type="button"
                className="ap-progress-bar"
                onClick={() => setProgressOpen((v) => !v)}
              >
                <span>Αναφορά προόδου</span>
                {progressOpen ? <ChevronUp size={16} /> : <ChevronRight size={16} />}
              </button>
              {progressOpen ? (
                <div className="ap-progress-panel">
                  Δεν υπάρχουν ακόμη καταχωρήσεις αναφοράς προόδου για αυτόν τον αθλητή.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="ap-right-stack">
          <section className="ap-panel ap-panel-finance">
            <div className="ap-panel-header ap-season-header">
              <button
                type="button"
                className="ap-nav-btn"
                aria-label="Προηγούμενη σεζόν"
                onClick={() => setSeasonStart((y) => y - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <h2>
                {seasonStart} - {seasonStart + 1}
              </h2>
              <button
                type="button"
                className="ap-nav-btn"
                aria-label="Επόμενη σεζόν"
                onClick={() => setSeasonStart((y) => y + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="ap-finance-wrap">
              <table className="ap-finance-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Μήνας/Έτος</th>
                    <th colSpan={3}>ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ</th>
                    <th colSpan={3}>ΠΑΡΟΥΣΙΟΛΟΓΙΟ</th>
                  </tr>
                  <tr>
                    <th>Χρέωση</th>
                    <th>Πληρωμή</th>
                    <th className="ap-balance-col">Υπόλοιπο</th>
                    <th>Προπονήσεις</th>
                    <th>Παρουσίες</th>
                    <th>Απουσίες</th>
                  </tr>
                </thead>
                <tbody>
                  {financeRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.charge.toFixed(2)}</td>
                      <td>{row.payment.toFixed(2)}</td>
                      <td className="ap-balance-col">{row.balance.toFixed(2)}</td>
                      <td>{row.trainings || ''}</td>
                      <td>{row.present || ''}</td>
                      <td>{row.absent || ''}</td>
                    </tr>
                  ))}
                  <tr className="ap-total-row">
                    <td>Σύνολο</td>
                    <td>{totals.charge.toFixed(2)}</td>
                    <td>{totals.payment.toFixed(2)}</td>
                    <td className="ap-balance-col">{totals.balance.toFixed(2)}</td>
                    <td>{totals.trainings}</td>
                    <td>{totals.present}</td>
                    <td>{totals.absent}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="ap-panel ap-panel-announcements">
            <div className="ap-panel-header">
              <h2>
                Ανακοινώσεις {seasonStart}-{seasonStart + 1}
              </h2>
            </div>
            <div className="ap-announcements-body">
              <table className="ap-announcements-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ημερομηνία Ανακοίνωσης</th>
                    <th>Τίτλος</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="ap-empty-msg">
                      Δεν υπάρχουν email ή ενημερώσεις για αυτόν τον αθλητή
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
