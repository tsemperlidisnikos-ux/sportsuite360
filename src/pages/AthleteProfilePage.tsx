import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HeartPulse,
  History,
  IdCard,
  Shield,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import * as studentsService from '../api/services/studentsService';
import * as progressReportsService from '../api/services/progressReportsService';
import * as amkaAuditService from '../api/services/amkaAuditService';
import { getSession } from '../auth/auth';
import { getClubById, ensureSessionClub } from '../auth/clubs';
import { Button } from '../components/ui/Button';
import { useAppData } from '../hooks/useAppData';
import type { StudentInput } from '../schemas';
import type { Gender, Student } from '../types';
import { buildHealthCardPdf } from '../utils/healthCardPdf';
import { sizeChartOptGroups } from '../utils/sizeChartOptions';
import { formatDate } from '../utils/labels';
import { localDateIso } from '../utils/dates';
import { getPreviewClubId } from '../platform/platformConfig';
import {
  AMKA_CONSENT_CHECKBOX,
  AMKA_CONSENT_LABEL,
  AMKA_CONSENT_TITLE,
  AMKA_PRIVACY_SECTION_HTML,
  MEDICAL_ACCESS_HINT,
} from '../shared/termsDefaults';
import { canAccessAmka, canAccessMedical, formatAmkaForViewer } from '../utils/amkaAccess';

type ProfileTab =
  | 'personal'
  | 'guardians'
  | 'identity'
  | 'fees'
  | 'health'
  | 'gdpr'
  | 'progress'
  | 'history';

function isAthleteMinor(birthDate: string | undefined): boolean {
  if (!birthDate) return true;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return true;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age < 18;
}
const PROFILE_TABS: { id: ProfileTab; label: string; icon: typeof User }[] = [
  { id: 'personal', label: 'Προσωπικά Στοιχεία', icon: User },
  { id: 'guardians', label: 'Γονείς', icon: Users },
  { id: 'identity', label: 'AMKA & Ταυτοποίηση', icon: IdCard },
  { id: 'fees', label: 'Συνδρομές / Οφειλές', icon: CreditCard },
  { id: 'health', label: 'Κάρτα Υγείας', icon: HeartPulse },
  { id: 'gdpr', label: 'Συγκαταθέσεις (GDPR)', icon: ShieldCheck },
  { id: 'progress', label: 'Πρόοδος', icon: TrendingUp },
  { id: 'history', label: 'Ιστορικό', icon: History },
];

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

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function seasonMonths(startYear: number) {
  return MONTH_LABELS.map((label, index) => {
    const year = index < 5 ? startYear : startYear + 1;
    const month = ((index + 7) % 12) + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return { label: `${label} ${year}`, key, year, month };
  });
}

function ageFromBirthDate(birthDate: string | undefined) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function statusBadgeLabel(status: Student['status']) {
  if (status === 'active') return 'ΕΝΕΡΓΟΣ';
  if (status === 'trial') return 'ΔΟΚΙΜΗ';
  return 'ΑΝΕΝΕΡΓΟΣ';
}

function statusText(status: Student['status']) {
  if (status === 'active') return 'Ενεργός';
  if (status === 'trial') return 'Δοκιμή';
  return 'Ανενεργός';
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
    clubName: student.clubName ?? '',
    registrationNumber: student.registrationNumber ?? '',
    sport: student.sport ?? '',
    healthCardStatus: student.healthCardStatus ?? '',
    healthCard: student.healthCard ?? student.healthCardStatus === 'Έγκυρη',
    healthCardExpires: student.healthCardExpires ?? '',
    consentExpires: student.consentExpires ?? '',
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
    gdprItems: {
      personalData: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      photoUse: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      gallery: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      communication: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      medical: student.gdprConsent === 'full' || student.gdprConsent === 'locked',
      amkaHealthCard: false,
      ...student.gdprItems,
    },
    amkaConsentAt: student.amkaConsentAt ?? '',
    healthCardSealedAt: student.healthCardSealedAt ?? '',
    placeOfBirth: student.placeOfBirth ?? '',
    nationality: student.nationality ?? '',
    communicationLanguage: student.communicationLanguage ?? 'Ελληνικά',
    county: student.county ?? '',
    jerseyNumber: student.jerseyNumber ?? '',
    position: student.position ?? '',
    athleticLevel: student.athleticLevel ?? '',
    athleticStartDate: student.athleticStartDate ?? '',
    coachName: student.coachName ?? '',
    emergencyName: student.emergencyName ?? student.guardianName ?? '',
    emergencyPhone: student.emergencyPhone ?? student.guardianPhone ?? '',
    emergencyRelation: student.emergencyRelation ?? '',
    emergencyAltPhone: student.emergencyAltPhone ?? '',
    doctorName: student.doctorName ?? '',
    doctorPhone: student.doctorPhone ?? '',
    bloodType: student.bloodType ?? '',
    allergies: student.allergies ?? '',
    chronicConditions: student.chronicConditions ?? '',
    medication: student.medication ?? '',
    registrationExpires: student.registrationExpires ?? '',
    autoRenewal: student.autoRenewal ?? false,
  };
}

function ApField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`ap-field ${className}`.trim()}>
      <span className="ap-field-label">{label}</span>
      {children}
    </label>
  );
}

function ApCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ap-card ${className}`.trim()}>
      <h3 className="ap-card-title">{title}</h3>
      {children}
    </section>
  );
}

export function AthleteProfilePage() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, refresh } = useAppData();
  const session = getSession();
  const amkaAllowed = canAccessAmka(session?.role);
  const medicalAllowed = canAccessMedical(session?.role);
  const student = data.students.find((s) => s.id === athleteId);

  const [editing, setEditing] = useState(
    Boolean((location.state as { editing?: boolean } | null)?.editing),
  );
  const [profileTab, setProfileTab] = useState<ProfileTab>('personal');
  const [form, setForm] = useState<StudentInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [seasonStart, setSeasonStart] = useState(2026);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [progressRating, setProgressRating] = useState(3);
  const [progressDate, setProgressDate] = useState(localDateIso);
  const [progressError, setProgressError] = useState('');
  const [progressSaving, setProgressSaving] = useState(false);
  const [loadingHealthCardPreview, setLoadingHealthCardPreview] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const healthCardPreviewUrlRef = useRef<string | null>(null);
  const amkaViewLoggedRef = useRef<string | null>(null);

  const uniformSizeOptions = useMemo(() => {
    const groups = sizeChartOptGroups(data.sizeChart);
    const all = new Set(groups.flatMap((g) => g.sizes.map((s) => s.toUpperCase())));
    const current = (form?.uniformSize ?? student?.uniformSize ?? '').trim();
    if (current && !all.has(current.toUpperCase())) {
      return [...groups, { category: 'custom' as const, label: 'Τρέχον', sizes: [current] }];
    }
    return groups;
  }, [data.sizeChart, form?.uniformSize, student?.uniformSize]);

  const athleteIds = useMemo(
    () =>
      [...data.students]
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'el'),
        )
        .map((s) => s.id),
    [data.students],
  );

  const athleteIndex = athleteId ? athleteIds.indexOf(athleteId) : -1;
  const prevAthleteId = athleteIndex > 0 ? athleteIds[athleteIndex - 1] : null;
  const nextAthleteId =
    athleteIndex >= 0 && athleteIndex < athleteIds.length - 1
      ? athleteIds[athleteIndex + 1]
      : null;

  useEffect(() => {
    if (student) setForm(toForm(student));
  }, [student]);

  useEffect(() => {
    if (!amkaAllowed || !student || !session) return;
    if (profileTab !== 'identity' && profileTab !== 'health') return;
    const amkaValue = (student.amka ?? '').trim();
    if (!amkaValue) return;
    const key = `${student.id}:${profileTab}`;
    if (amkaViewLoggedRef.current === key) return;
    amkaViewLoggedRef.current = key;
    void amkaAuditService.recordAmkaAccess({
      userId: session.id,
      userName: session.fullName || session.email || session.id,
      athleteId: student.id,
      athleteName: `${student.lastName} ${student.firstName}`.trim(),
      action: 'view',
    });
  }, [amkaAllowed, profileTab, session, student]);

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

  const clubOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: '', label: '—' }];
    const seen = new Set<string>();

    const push = (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value: trimmed, label: trimmed });
    };

    for (const assoc of data.associations ?? []) {
      if (assoc.active === false) continue;
      push(assoc.name);
    }

    const session = getSession();
    const clubId = getPreviewClubId() ?? session?.clubId ?? null;
    const club = clubId ? getClubById(clubId) : ensureSessionClub(session);
    if (club?.name) push(club.name);

    push(form?.clubName ?? '');

    return options;
  }, [data.associations, form?.clubName]);

  const sportOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: '', label: '—' }];
    const seen = new Set<string>();
    for (const sport of data.sports ?? []) {
      if (sport.active === false) continue;
      const name = sport.name.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      options.push({ value: name, label: name });
    }
    const current = (form?.sport ?? '').trim();
    if (current && !seen.has(current.toLowerCase())) {
      options.push({ value: current, label: current });
    }
    return options;
  }, [data.sports, form?.sport]);

  const coachOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...(data.coaches ?? [])
        .filter((c) => c.active)
        .map((c) => ({
          value: `${c.firstName} ${c.lastName}`.trim(),
          label: `${c.firstName} ${c.lastName}`.trim(),
        })),
    ],
    [data.coaches],
  );

  const financeRows = useMemo(() => {
    if (!student) return [];
    const athleteTx = (data.transactions ?? []).filter((t) => t.athleteId === student.id);
    return months.map((m) => {
      const monthTx = athleteTx.filter(
        (t) => Number(t.month) === m.month && Number(t.year) === m.year,
      );
      const charge = monthTx
        .filter((t) => t.type === 'charge')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const payment = monthTx
        .filter((t) => t.type === 'payment')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
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

  const progressReports = useMemo(
    () => (data.progressReports ?? []).filter((r) => r.athleteId === athleteId),
    [data.progressReports, athleteId],
  );

  if (session?.role === 'doctor') {
    return <Navigate to="/athletes" replace />;
  }

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
    const amkaValue = amkaAllowed ? (form.amka ?? '').trim() : (student.amka ?? '').trim();
    if (amkaAllowed && amkaValue && !form.gdprItems?.amkaHealthCard) {
      setSaving(false);
      setError(
        isAthleteMinor(form.birthDate)
          ? 'Απαιτείται ρητή συγκατάθεση γονέα για τη συλλογή του ΑΜΚΑ.'
          : 'Απαιτείται ρητή συγκατάθεση για τη συλλογή και επεξεργασία του ΑΜΚΑ.',
      );
      return;
    }
    const previousAmka = (student.amka ?? '').trim();
    const payload: StudentInput = {
      ...form,
      amka: amkaValue,
      amkaConsentAt: amkaValue
        ? form.amkaConsentAt || localDateIso()
        : '',
      // Preserve medical fields when role cannot access them
      doctorName: medicalAllowed ? form.doctorName : student.doctorName,
      doctorPhone: medicalAllowed ? form.doctorPhone : student.doctorPhone,
      bloodType: medicalAllowed ? form.bloodType : student.bloodType,
      allergies: medicalAllowed ? form.allergies : student.allergies,
      chronicConditions: medicalAllowed ? form.chronicConditions : student.chronicConditions,
      medication: medicalAllowed ? form.medication : student.medication,
      gdprItems: {
        personalData: Boolean(form.gdprItems?.personalData),
        photoUse: Boolean(form.gdprItems?.photoUse),
        gallery: Boolean(form.gdprItems?.gallery),
        communication: Boolean(form.gdprItems?.communication),
        medical: Boolean(form.gdprItems?.medical),
        amkaHealthCard: amkaValue ? Boolean(form.gdprItems?.amkaHealthCard) : false,
      },
      guardianName:
        form.guardianName ||
        (form.fatherFirstName
          ? `${form.fatherFirstName} ${form.lastName}`.trim()
          : form.guardianName),
      guardianPhone: form.guardianPhone || form.emergencyPhone || form.phone || '',
    };
    const result = await studentsService.updateStudent(student.id, payload);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα αποθήκευσης');
      return;
    }
    if (amkaAllowed && session) {
      const athleteName = `${payload.lastName} ${payload.firstName}`.trim();
      if (amkaValue !== previousAmka) {
        void amkaAuditService.recordAmkaAccess({
          userId: session.id,
          userName: session.fullName || session.email || session.id,
          athleteId: student.id,
          athleteName,
          action: amkaValue ? 'edit' : 'delete',
        });
      } else if (amkaValue && form.gdprItems?.amkaHealthCard && !student.gdprItems?.amkaHealthCard) {
        void amkaAuditService.recordAmkaAccess({
          userId: session.id,
          userName: session.fullName || session.email || session.id,
          athleteId: student.id,
          athleteName,
          action: 'consent',
        });
      }
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
    if (!amkaAllowed) {
      setError('Η προεπισκόπηση κάρτας υγείας με ΑΜΚΑ είναι διαθέσιμη μόνο σε διαχειριστή/ιατρό.');
      return;
    }
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
    html, body { margin: 0; height: 100%; font-family: "Segoe UI", system-ui, sans-serif; background: #525659; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #cfe0db; }
    iframe { width: 100%; height: calc(100% - 64px); border: 0; }
  </style>
</head>
<body>
  <header>
    <strong>Κάρτα υγείας — προεπισκόπηση</strong>
    <button type="button" onclick="window.close()">Κλείσιμο</button>
  </header>
  <iframe title="Κάρτα υγείας" src="${pdfUrl}"></iframe>
</body>
</html>`);
    previewWindow.document.close();
    try {
      previewWindow.focus();
    } catch {
      // ignore
    }
  }

  const inputClass = 'ap-input';
  const disabled = !editing;

  const textInput = (
    value: string | undefined,
    onChange: (v: string) => void,
    opts?: { type?: string; upper?: boolean; placeholder?: string },
  ) => (
    <input
      type={opts?.type ?? 'text'}
      className={inputClass}
      value={value ?? ''}
      disabled={disabled}
      placeholder={opts?.placeholder}
      onChange={(e) =>
        onChange(opts?.upper ? e.target.value.toUpperCase() : e.target.value)
      }
    />
  );

  const yesNo = (value: boolean, onChange: (v: boolean) => void) => (
    <select
      className={inputClass}
      value={value ? 'yes' : 'no'}
      disabled={disabled}
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
    data.classes.find((c) => c.id === form.classId)?.name || '—';
  const classCoachId = data.classes.find((c) => c.id === form.classId)?.coachId;
  const linkedCoach = data.coaches.find((c) => c.id === classCoachId);
  const coachDisplay =
    form.coachName ||
    (linkedCoach ? `${linkedCoach.firstName} ${linkedCoach.lastName}` : '');
  const age = ageFromBirthDate(form.birthDate);

  return (
    <div className="athlete-profile-page ap-shell">
      <nav className="ap-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="ap-crumb-link" onClick={() => navigate('/athletes')}>
          Αθλητές
        </button>
        <span className="ap-crumb-sep">›</span>
        <span>Προφίλ Αθλητή</span>
      </nav>

      <header className="ap-hero">
        <div className="ap-hero-main">
          <div className="ap-hero-photo-wrap">
            {form.photoUrl ? (
              <img src={form.photoUrl} alt="" className="ap-hero-photo" />
            ) : (
              <div className="ap-hero-photo ap-hero-photo--empty" aria-hidden="true" />
            )}
            {editing ? (
              <div className="ap-hero-photo-actions">
                <label className="ap-hero-photo-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handlePhoto(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  Αλλαγή
                </label>
                {form.photoUrl ? (
                  <button
                    type="button"
                    className="ap-hero-photo-delete"
                    onClick={() => setField('photoUrl', null)}
                  >
                    Διαγραφή
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="ap-hero-copy">
            <div className="ap-hero-title-row">
              <h1>
                {form.firstName} {form.lastName}
              </h1>
              <span className={`ap-status-badge ap-status-badge--${form.status}`}>
                {statusBadgeLabel(form.status)}
              </span>
            </div>
            <p className="ap-hero-meta">
              <span>Κωδ. Αθλητή: {form.registrationNumber || student.id.slice(-8).toUpperCase()}</span>
              <span className="ap-hero-dot">·</span>
              <span>Ημ/νία Εγγραφής: {formatDate(student.enrolledAt)}</span>
            </p>
            <div className="ap-hero-stats">
              <div className="ap-hero-stat">
                <Calendar size={16} aria-hidden />
                <span>
                  {form.birthDate
                    ? `${formatDate(form.birthDate)}${age != null ? ` (${age} ετών)` : ''}`
                    : '—'}
                </span>
              </div>
              <div className="ap-hero-stat">
                <Shield size={16} aria-hidden />
                <span>ΑΜΚΑ {formatAmkaForViewer(form.amka, amkaAllowed)}</span>
              </div>
              <div className="ap-hero-stat">
                <Users size={16} aria-hidden />
                <span>{classLabel}</span>
              </div>
              <div className="ap-hero-stat">
                <span className={`ap-live-dot ap-live-dot--${form.status}`} aria-hidden />
                <span>Κατάσταση {statusText(form.status)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ap-hero-actions">
          <div className="ap-actions-menu">
            <button
              type="button"
              className="ap-actions-btn"
              onClick={() => setActionsOpen((v) => !v)}
              aria-expanded={actionsOpen}
            >
              Ενέργειες
              <ChevronDown size={14} className={actionsOpen ? 'ap-chevron-open' : ''} />
            </button>
            {actionsOpen ? (
              <div className="ap-actions-dropdown">
                {!editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setActionsOpen(false);
                    }}
                  >
                    Επεξεργασία προφίλ
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setProfileTab('health');
                    setActionsOpen(false);
                    void openHealthCardPreview();
                  }}
                >
                  Προεπισκόπηση κάρτας υγείας
                </button>
                {form.photoUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setField('photoUrl', null);
                      setEditing(true);
                      setActionsOpen(false);
                    }}
                  >
                    Διαγραφή φωτογραφίας
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="ap-pager">
            <button
              type="button"
              className="ap-pager-btn"
              disabled={!prevAthleteId}
              onClick={() => prevAthleteId && navigate(`/athletes/${prevAthleteId}`)}
              aria-label="Προηγούμενος αθλητής"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="ap-pager-btn"
              disabled={!nextAthleteId}
              onClick={() => nextAthleteId && navigate(`/athletes/${nextAthleteId}`)}
              aria-label="Επόμενος αθλητής"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="ap-tabs" role="tablist" aria-label="Υποκατηγορίες προφίλ">
        {PROFILE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={profileTab === id}
            className={`ap-tab ${profileTab === id ? 'active' : ''}`}
            onClick={() => setProfileTab(id)}
          >
            <Icon size={15} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="ap-tab-panels">
        {profileTab === 'personal' ? (
          <div className="ap-two-col">
            <div className="ap-col">
              <ApCard title="Βασικά Στοιχεία">
                <div className="ap-grid-2">
                  <ApField label="Όνομα">
                    {textInput(form.firstName, (v) => setField('firstName', v), { upper: true })}
                  </ApField>
                  <ApField label="Επώνυμο">
                    {textInput(form.lastName, (v) => setField('lastName', v), { upper: true })}
                  </ApField>
                  <ApField label="Πατρώνυμο">
                    {textInput(form.fatherFirstName, (v) => setField('fatherFirstName', v), {
                      upper: true,
                    })}
                  </ApField>
                  <ApField label="Μητρώνυμο">
                    {textInput(form.motherFirstName, (v) => setField('motherFirstName', v), {
                      upper: true,
                    })}
                  </ApField>
                  <ApField label="Ημερομηνία γέννησης">
                    {textInput(form.birthDate, (v) => setField('birthDate', v), { type: 'date' })}
                  </ApField>
                  <ApField label="Φύλο">
                    <select
                      className={inputClass}
                      value={form.gender ?? ''}
                      disabled={disabled}
                      onChange={(e) => setField('gender', e.target.value as Gender)}
                    >
                      <option value="">—</option>
                      <option value="boy">Αγόρι</option>
                      <option value="girl">Κορίτσι</option>
                      <option value="other">Άλλο</option>
                    </select>
                  </ApField>
                  <ApField label="Email αθλητή">
                    {textInput(form.email, (v) => setField('email', v), { type: 'email' })}
                  </ApField>
                  <ApField label="Τηλέφωνο αθλητή">
                    {textInput(form.phone, (v) => setField('phone', v), { type: 'tel' })}
                  </ApField>
                  <ApField label="Διεύθυνση" className="ap-span-2">
                    {textInput(form.address, (v) => setField('address', v), { upper: true })}
                  </ApField>
                  <ApField label="Τ.Κ.">
                    {textInput(form.postalCode, (v) => setField('postalCode', v))}
                  </ApField>
                  <ApField label="Πόλη">
                    {textInput(form.city, (v) => setField('city', v), { upper: true })}
                  </ApField>
                  <ApField label="Νομός" className="ap-span-2">
                    {textInput(form.county, (v) => setField('county', v), { upper: true })}
                  </ApField>
                </div>
              </ApCard>

              <ApCard title="Σημειώσεις">
                <textarea
                  className={`${inputClass} ap-textarea`}
                  rows={4}
                  disabled={disabled}
                  value={form.comments ?? ''}
                  onChange={(e) => setField('comments', e.target.value)}
                  placeholder="Γενικές παρατηρήσεις…"
                />
              </ApCard>

              <div className="ap-reg-footer">
                <ApField label="Κατάσταση">
                  <select
                    className={inputClass}
                    value={form.status}
                    disabled={disabled}
                    onChange={(e) =>
                      setField('status', e.target.value as Student['status'])
                    }
                  >
                    <option value="active">Ενεργός</option>
                    <option value="trial">Δοκιμή</option>
                    <option value="inactive">Ανενεργός</option>
                  </select>
                </ApField>
                <ApField label="Λήξη εγγραφής">
                  {textInput(form.registrationExpires, (v) => setField('registrationExpires', v), {
                    type: 'date',
                  })}
                </ApField>
                <label className="ap-check">
                  <input
                    type="checkbox"
                    checked={Boolean(form.autoRenewal)}
                    disabled={disabled}
                    onChange={(e) => setField('autoRenewal', e.target.checked)}
                  />
                  <span>Αυτόματη Ανανέωση</span>
                </label>
              </div>
            </div>

            <div className="ap-col">
              <ApCard title="Αθλητική Πληροφορία">
                <div className="ap-grid-2">
                  <ApField label="Τμήμα" className="ap-span-2">
                    <select
                      className={inputClass}
                      value={form.classId ?? ''}
                      disabled={disabled}
                      onChange={(e) => setField('classId', e.target.value || null)}
                    >
                      <option value="">Δεν έχει οριστεί σε τμήμα</option>
                      {data.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </ApField>
                  <ApField label="Ημ/νία έναρξης">
                    {textInput(form.athleticStartDate, (v) => setField('athleticStartDate', v), {
                      type: 'date',
                    })}
                  </ApField>
                  <ApField label="Επίπεδο">
                    {textInput(form.athleticLevel, (v) => setField('athleticLevel', v), {
                      upper: true,
                    })}
                  </ApField>
                  <ApField label="Προπονητής" className="ap-span-2">
                    <select
                      className={inputClass}
                      value={coachDisplay}
                      disabled={disabled}
                      onChange={(e) => setField('coachName', e.target.value)}
                    >
                      {coachOptions.map((o) => (
                        <option key={o.value || 'empty'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </ApField>
                </div>
              </ApCard>

              <ApCard title="Στοιχεία Επικοινωνίας Έκτακτης Ανάγκης">
                <div className="ap-grid-2">
                  <ApField label="Ονοματεπώνυμο">
                    {textInput(form.emergencyName, (v) => setField('emergencyName', v), {
                      upper: true,
                    })}
                  </ApField>
                  <ApField label="Τηλέφωνο">
                    {textInput(form.emergencyPhone, (v) => setField('emergencyPhone', v), {
                      type: 'tel',
                    })}
                  </ApField>
                  <ApField label="Σχέση">
                    {textInput(form.emergencyRelation, (v) => setField('emergencyRelation', v), {
                      upper: true,
                    })}
                  </ApField>
                  <ApField label="Εναλλακτικό τηλέφωνο">
                    {textInput(form.emergencyAltPhone, (v) => setField('emergencyAltPhone', v), {
                      type: 'tel',
                    })}
                  </ApField>
                </div>
              </ApCard>

              <ApCard title="Ιατρικές Παρατηρήσεις">
                {medicalAllowed ? (
                  <div className="ap-grid-2">
                    <ApField label="Ιατρός">
                      {textInput(form.doctorName, (v) => setField('doctorName', v), { upper: true })}
                    </ApField>
                    <ApField label="Τηλέφωνο ιατρού">
                      {textInput(form.doctorPhone, (v) => setField('doctorPhone', v), {
                        type: 'tel',
                      })}
                    </ApField>
                    <ApField label="Ομάδα αίματος" className="ap-span-2">
                      <select
                        className={inputClass}
                        value={form.bloodType ?? ''}
                        disabled={disabled}
                        onChange={(e) => setField('bloodType', e.target.value)}
                      >
                        {BLOOD_TYPES.map((t) => (
                          <option key={t || 'empty'} value={t}>
                            {t || '—'}
                          </option>
                        ))}
                      </select>
                    </ApField>
                    <ApField label="Αλλεργίες" className="ap-span-2">
                      <textarea
                        className={`${inputClass} ap-textarea`}
                        rows={2}
                        disabled={disabled}
                        value={form.allergies ?? ''}
                        onChange={(e) => setField('allergies', e.target.value)}
                      />
                    </ApField>
                    <ApField label="Χρόνιες παθήσεις / παρατηρήσεις" className="ap-span-2">
                      <textarea
                        className={`${inputClass} ap-textarea`}
                        rows={2}
                        disabled={disabled}
                        value={form.chronicConditions ?? ''}
                        onChange={(e) => setField('chronicConditions', e.target.value)}
                      />
                    </ApField>
                    <ApField label="Φαρμακευτική αγωγή" className="ap-span-2">
                      <textarea
                        className={`${inputClass} ap-textarea`}
                        rows={2}
                        disabled={disabled}
                        value={form.medication ?? ''}
                        onChange={(e) => setField('medication', e.target.value)}
                      />
                    </ApField>
                  </div>
                ) : (
                  <p className="ap-field-hint">{MEDICAL_ACCESS_HINT}</p>
                )}
              </ApCard>
            </div>
          </div>
        ) : null}

        {profileTab === 'guardians' ? (
          <ApCard title="Γονείς">
            <div className="ap-grid-2">
              <ApField label="Όνομα γονέα">
                {textInput(form.guardianName, (v) => setField('guardianName', v), {
                  upper: true,
                })}
              </ApField>
              <ApField label="Τηλέφωνο γονέα">
                {textInput(form.guardianPhone, (v) => setField('guardianPhone', v), {
                  type: 'tel',
                })}
              </ApField>
              <ApField label="Πατρώνυμο">
                {textInput(form.fatherFirstName, (v) => setField('fatherFirstName', v), {
                  upper: true,
                })}
              </ApField>
              <ApField label="Μητρώνυμο">
                {textInput(form.motherFirstName, (v) => setField('motherFirstName', v), {
                  upper: true,
                })}
              </ApField>
              <ApField label="Email πατρός">
                {textInput(form.fatherEmail, (v) => setField('fatherEmail', v), {
                  type: 'email',
                })}
              </ApField>
              <ApField label="Email μητρός">
                {textInput(form.motherEmail, (v) => setField('motherEmail', v), {
                  type: 'email',
                })}
              </ApField>
              <ApField label="Τηλέφωνο πατρός">
                {textInput(form.guardianPhone, (v) => setField('guardianPhone', v), {
                  type: 'tel',
                })}
              </ApField>
              <ApField label="Τηλέφωνο μητρός">
                {textInput(form.motherPhone, (v) => setField('motherPhone', v), { type: 'tel' })}
              </ApField>
            </div>
          </ApCard>
        ) : null}

        {profileTab === 'identity' ? (
          <ApCard title="AMKA & Ταυτοποίηση">
            {amkaAllowed ? (
              <div
                className="ap-amka-privacy"
                dangerouslySetInnerHTML={{ __html: AMKA_PRIVACY_SECTION_HTML }}
              />
            ) : (
              <p className="ap-field-hint">
                Ο ΑΜΚΑ είναι ορατός μόνο σε διαχειριστή συλλόγου και ιατρό (RBAC).
              </p>
            )}
            <div className="ap-grid-2">
              <ApField label="ΑΜΚΑ">
                {amkaAllowed ? (
                  <>
                    {textInput(form.amka, (v) => setField('amka', v))}
                    {editing ? (
                      <button
                        type="button"
                        className="btn btn-ghost ap-amka-clear"
                        onClick={() => {
                          setField('amka', '');
                          setField('amkaConsentAt', '');
                          setField('gdprItems', {
                            personalData: false,
                            photoUse: false,
                            gallery: false,
                            communication: false,
                            medical: false,
                            ...form.gdprItems,
                            amkaHealthCard: false,
                          });
                        }}
                      >
                        Διαγραφή ΑΜΚΑ
                      </button>
                    ) : null}
                  </>
                ) : (
                  <input
                    className={inputClass}
                    value={formatAmkaForViewer(form.amka, false)}
                    disabled
                    readOnly
                  />
                )}
              </ApField>
              <ApField label="Αρ. δελτίου / κωδικός">
                {textInput(form.registrationNumber, (v) => setField('registrationNumber', v))}
              </ApField>
              {amkaAllowed ? (
                <ApField label={AMKA_CONSENT_TITLE} className="ap-span-2">
                  <p className="ap-field-hint">{AMKA_CONSENT_LABEL}</p>
                  <label className="ap-amka-consent">
                    <input
                      type="checkbox"
                      checked={Boolean(form.gdprItems?.amkaHealthCard)}
                      disabled={!editing}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setField('gdprItems', {
                          personalData: false,
                          photoUse: false,
                          gallery: false,
                          communication: false,
                          medical: false,
                          ...form.gdprItems,
                          amkaHealthCard: checked,
                        });
                        setField('amkaConsentAt', checked ? localDateIso() : '');
                      }}
                    />
                    <span>
                      {AMKA_CONSENT_CHECKBOX}
                      {isAthleteMinor(form.birthDate) ? (
                        <>
                          {' '}
                          <em>(γονέας)</em>
                        </>
                      ) : null}
                    </span>
                  </label>
                </ApField>
              ) : null}
              <ApField label="Σωματείο">
                <select
                  className={inputClass}
                  value={form.clubName ?? ''}
                  disabled={disabled}
                  onChange={(e) => setField('clubName', e.target.value)}
                >
                  {clubOptions.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!disabled && clubOptions.length <= 1 ? (
                  <p className="ap-field-hint">
                    Δεν υπάρχουν σωματεία. Πρόσθεσέ τα από Ρυθμίσεις → Σωματείο.
                  </p>
                ) : null}
              </ApField>
              <ApField label="Άθλημα">
                <select
                  className={inputClass}
                  value={form.sport ?? ''}
                  disabled={disabled}
                  onChange={(e) => setField('sport', e.target.value)}
                >
                  {sportOptions.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </ApField>
              <ApField label="Φύλο">
                <select
                  className={inputClass}
                  value={form.gender ?? ''}
                  disabled={disabled}
                  onChange={(e) => setField('gender', e.target.value as Gender)}
                >
                  <option value="">—</option>
                  <option value="boy">Αγόρι</option>
                  <option value="girl">Κορίτσι</option>
                  <option value="other">Άλλο</option>
                </select>
              </ApField>
              <ApField label="Ημερομηνία γέννησης">
                {textInput(form.birthDate, (v) => setField('birthDate', v), { type: 'date' })}
              </ApField>
            </div>
          </ApCard>
        ) : null}

        {profileTab === 'fees' ? (
          <div className="ap-stack">
            <ApCard title="Συνδρομές & χρεώσεις">
              <div className="ap-grid-2">
                <ApField label="Μηνιαίο δίδακτρο (€)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={form.monthlyFee}
                    disabled={disabled}
                    onChange={(e) => setField('monthlyFee', Number(e.target.value))}
                  />
                </ApField>
                <ApField label="Χρέωση εγγραφής">{yesNo(Boolean(form.registrationCharge), (v) =>
                  setField('registrationCharge', v),
                )}</ApField>
                <ApField label="Χρέωση μήνα">
                  {yesNo(form.monthlyCharge !== false, (v) => setField('monthlyCharge', v))}
                </ApField>
                <ApField label="Εισιτήριο διαρκείας">
                  {yesNo(Boolean(form.seasonTicket), (v) => setField('seasonTicket', v))}
                </ApField>
                <ApField label="Έκπτωση συνδρομής">
                  {yesNo(Boolean(form.subscriptionDiscount), (v) =>
                    setField('subscriptionDiscount', v),
                  )}
                </ApField>
                <ApField label="Μηνιαίο ποσό έκπτωσης (€)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={form.discountAmount ?? 0}
                    disabled={disabled}
                    onChange={(e) => setField('discountAmount', Number(e.target.value))}
                  />
                </ApField>
                <ApField label="Λόγος έκπτωσης" className="ap-span-2">
                  <select
                    className={inputClass}
                    value={form.discountReason ?? ''}
                    disabled={disabled}
                    onChange={(e) => setField('discountReason', e.target.value)}
                  >
                    {DISCOUNT_REASONS.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </ApField>
                <ApField label="Παραλαβή στολής">
                  {yesNo(Boolean(form.uniformReceived), (v) => setField('uniformReceived', v))}
                </ApField>
                <ApField label="Μέγεθος στολής">
                  <select
                    className={inputClass}
                    value={form.uniformSize ?? ''}
                    disabled={disabled}
                    onChange={(e) => setField('uniformSize', e.target.value)}
                  >
                    <option value="">—</option>
                    {uniformSizeOptions.map((group) => (
                      <optgroup key={group.category} label={group.label}>
                        {group.sizes.map((size) => (
                          <option key={`${group.category}-${size}`} value={size}>
                            {size}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </ApField>
              </div>
            </ApCard>

            <ApCard title="Οφειλές σεζόν">
              <div className="ap-season-header">
                <button
                  type="button"
                  className="ap-pager-btn"
                  onClick={() => setSeasonStart((y) => y - 1)}
                  aria-label="Προηγούμενη σεζόν"
                >
                  <ChevronLeft size={16} />
                </button>
                <strong>
                  Σεζόν {seasonStart}–{String(seasonStart + 1).slice(-2)}
                </strong>
                <button
                  type="button"
                  className="ap-pager-btn"
                  onClick={() => setSeasonStart((y) => y + 1)}
                  aria-label="Επόμενη σεζόν"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="ap-finance-wrap">
                <table className="ap-finance-table">
                  <thead>
                    <tr>
                      <th>Μήνας</th>
                      <th>Χρέωση</th>
                      <th>Πληρωμή</th>
                      <th className="ap-balance-col">Υπόλοιπο</th>
                      <th>Παρ.</th>
                      <th>Απ.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeRows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{row.charge.toFixed(2)}</td>
                        <td>{row.payment.toFixed(2)}</td>
                        <td className="ap-balance-col">{row.balance.toFixed(2)}</td>
                        <td>{row.present}</td>
                        <td>{row.absent}</td>
                      </tr>
                    ))}
                    <tr className="ap-total-row">
                      <td>Σύνολο</td>
                      <td>{totals.charge.toFixed(2)}</td>
                      <td>{totals.payment.toFixed(2)}</td>
                      <td className="ap-balance-col">{totals.balance.toFixed(2)}</td>
                      <td>{totals.present}</td>
                      <td>{totals.absent}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ApCard>
          </div>
        ) : null}

        {profileTab === 'health' ? (
          <ApCard title="Κάρτα Υγείας">
            <div className="ap-grid-2">
              <ApField label="Κάρτα υγείας">
                {yesNo(Boolean(form.healthCard), (v) => {
                  setField('healthCard', v);
                  setField('healthCardStatus', v ? 'Έγκυρη' : 'Όχι');
                })}
              </ApField>
              <ApField label="Λήξη κάρτας υγείας">
                {textInput(form.healthCardExpires, (v) => setField('healthCardExpires', v), {
                  type: 'date',
                })}
              </ApField>
              {medicalAllowed ? (
                <>
                  <ApField label="Ομάδα αίματος">
                    <select
                      className={inputClass}
                      value={form.bloodType ?? ''}
                      disabled={disabled}
                      onChange={(e) => setField('bloodType', e.target.value)}
                    >
                      {BLOOD_TYPES.map((t) => (
                        <option key={t || 'empty'} value={t}>
                          {t || '—'}
                        </option>
                      ))}
                    </select>
                  </ApField>
                  <div className="ap-field ap-field-actions">
                    <span className="ap-field-label">Έγγραφο</span>
                    <Button
                      type="button"
                      disabled={loadingHealthCardPreview || !form.healthCard || !amkaAllowed}
                      onClick={() => void openHealthCardPreview()}
                    >
                      {loadingHealthCardPreview ? 'Φόρτωση…' : 'Προεπισκόπηση PDF'}
                    </Button>
                  </div>
                  <ApField label="Αλλεργίες" className="ap-span-2">
                    <textarea
                      className={`${inputClass} ap-textarea`}
                      rows={3}
                      disabled={disabled}
                      value={form.allergies ?? ''}
                      onChange={(e) => setField('allergies', e.target.value)}
                    />
                  </ApField>
                  <ApField label="Χρόνιες παθήσεις" className="ap-span-2">
                    <textarea
                      className={`${inputClass} ap-textarea`}
                      rows={3}
                      disabled={disabled}
                      value={form.chronicConditions ?? ''}
                      onChange={(e) => setField('chronicConditions', e.target.value)}
                    />
                  </ApField>
                </>
              ) : (
                <ApField label="Ιατρικά στοιχεία" className="ap-span-2">
                  <p className="ap-field-hint">{MEDICAL_ACCESS_HINT}</p>
                </ApField>
              )}
            </div>
          </ApCard>
        ) : null}

        {profileTab === 'gdpr' ? (
          <ApCard title="Συγκαταθέσεις (GDPR)">
            <div className="ap-gdpr-pills">
              <span
                className={`ap-pill ${
                  form.gdprConsent === 'full' || form.gdprConsent === 'locked' ? 'ap-pill-ok' : ''
                }`}
              >
                {form.gdprConsent === 'full' || form.gdprConsent === 'locked'
                  ? 'Πλήρης συναίνεση'
                  : 'Εκκρεμής συναίνεση'}
              </span>
              <span className={`ap-pill ${form.gdprConsent === 'locked' ? 'ap-pill-locked' : ''}`}>
                {form.gdprConsent === 'locked' ? 'Κλειδωμένο' : 'Ξεκλείδωτο'}
              </span>
            </div>
            <ApField label="Λήξη συναίνεσης">
              {textInput(form.consentExpires, (v) => setField('consentExpires', v), {
                type: 'date',
              })}
            </ApField>
            <ul className="ap-gdpr-list">
              {(
                [
                  ['personalData', 'Επεξεργασία προσωπικών δεδομένων'],
                  ['photoUse', 'Χρήση φωτογραφίας'],
                  ['gallery', 'Δημοσίευση gallery'],
                  ['communication', 'Επικοινωνία'],
                  ['medical', 'Ιατρικά δεδομένα'],
                  ['amkaHealthCard', `${AMKA_CONSENT_CHECKBOX} — συγκατάθεση ΑΜΚΑ`],
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(form.gdprItems?.[key])}
                      disabled={
                        !editing ||
                        form.gdprConsent === 'locked' ||
                        (key === 'amkaHealthCard' && !amkaAllowed)
                      }
                      onChange={(e) => {
                        if (key === 'amkaHealthCard' && !amkaAllowed) return;
                        const next = {
                          personalData: false,
                          photoUse: false,
                          gallery: false,
                          communication: false,
                          medical: false,
                          amkaHealthCard: false,
                          ...form.gdprItems,
                          [key]: e.target.checked,
                        };
                        setField('gdprItems', next);
                        if (key === 'amkaHealthCard') {
                          setField('amkaConsentAt', e.target.checked ? localDateIso() : '');
                        }
                        const coreOn = (
                          ['personalData', 'photoUse', 'gallery', 'communication', 'medical'] as const
                        ).every((k) => next[k]);
                        setField('gdprConsent', coreOn ? 'full' : 'pending');
                      }}
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ApCard>
        ) : null}

        {profileTab === 'progress' ? (
          <ApCard title="Αναφορές προόδου">
            <div className="ap-stack">
              {progressReports.map((report) => (
                <article key={report.id} className="ap-progress-item">
                  <div className="ap-progress-item-head">
                    <strong>{report.title}</strong>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (!confirm('Διαγραφή αναφοράς;')) return;
                        void progressReportsService
                          .deleteProgressReport(report.id)
                          .then(() => refresh());
                      }}
                    >
                      Διαγραφή
                    </button>
                  </div>
                  <span className="muted">
                    {formatDate(report.date)} · Βαθμός {report.rating}/5 · {report.createdByName}
                  </span>
                  {report.notes ? <p>{report.notes}</p> : null}
                </article>
              ))}
              {progressReports.length === 0 ? (
                <p className="muted">Δεν υπάρχουν ακόμη καταχωρήσεις.</p>
              ) : null}

              <div className="ap-grid-2">
                <ApField label="Ημερομηνία">
                  <input
                    className={inputClass}
                    type="date"
                    value={progressDate}
                    onChange={(e) => setProgressDate(e.target.value)}
                  />
                </ApField>
                <ApField label="Βαθμός (1–5)">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={5}
                    value={progressRating}
                    onChange={(e) => setProgressRating(Number(e.target.value) || 3)}
                  />
                </ApField>
                <ApField label="Τίτλος" className="ap-span-2">
                  <input
                    className={inputClass}
                    value={progressTitle}
                    onChange={(e) => setProgressTitle(e.target.value)}
                    placeholder="π.χ. Τεχνική / φυσική κατάσταση"
                  />
                </ApField>
                <ApField label="Σχόλια" className="ap-span-2">
                  <textarea
                    className={`${inputClass} ap-textarea`}
                    rows={3}
                    value={progressNotes}
                    onChange={(e) => setProgressNotes(e.target.value)}
                  />
                </ApField>
              </div>
              {progressError ? <p className="form-error">{progressError}</p> : null}
              <Button
                type="button"
                disabled={progressSaving}
                onClick={() => {
                  if (!athleteId) return;
                  setProgressSaving(true);
                  setProgressError('');
                  void progressReportsService
                    .createProgressReport({
                      athleteId,
                      date: progressDate,
                      title: progressTitle,
                      notes: progressNotes,
                      rating: progressRating,
                    })
                    .then((result) => {
                      setProgressSaving(false);
                      if (!result.success) {
                        setProgressError(result.error ?? 'Σφάλμα αποθήκευσης');
                        return;
                      }
                      setProgressTitle('');
                      setProgressNotes('');
                      setProgressRating(3);
                      setProgressDate(localDateIso());
                      refresh();
                    });
                }}
              >
                {progressSaving ? 'Αποθήκευση…' : 'Αποθήκευση αναφοράς'}
              </Button>
            </div>
          </ApCard>
        ) : null}

        {profileTab === 'history' ? (
          <div className="ap-stack">
            <ApCard title="Ανακοινώσεις">
              <div className="ap-finance-wrap">
                <table className="ap-announcements-table">
                  <thead>
                    <tr>
                      <th>Ημερομηνία</th>
                      <th>Τίτλος</th>
                      <th>Κοινό</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.announcements ?? []).slice(0, 20).map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.createdAt)}</td>
                        <td>{a.title}</td>
                        <td>
                          {a.audienceRoles?.length
                            ? a.audienceRoles.join(', ')
                            : a.teamsLabel || a.showTo || '—'}
                        </td>
                      </tr>
                    ))}
                    {(data.announcements ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="ap-empty-msg">
                          Δεν υπάρχουν ανακοινώσεις.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </ApCard>
            <ApCard title="Παρουσίες (τρέχουσα σεζόν)">
              <p className="muted">
                Παρουσίες: {totals.present} · Απουσίες: {totals.absent} · Σύνολο καταγραφών:{' '}
                {totals.trainings}
              </p>
            </ApCard>
          </div>
        ) : null}
      </div>

      <footer className="ap-footer-actions">
        {editing ? (
          <>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Ακύρωση
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση Αλλαγών'}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => setEditing(true)}>
            Επεξεργασία προφίλ
          </Button>
        )}
      </footer>
    </div>
  );
}
