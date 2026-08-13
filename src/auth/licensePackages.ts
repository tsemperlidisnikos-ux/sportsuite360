export interface LicensePackageFeature {
  label: string;
  included: boolean;
}

export interface LicensePackage {
  id: string;
  name: string;
  athleteLicenses: number;
  /** Display price for the billing period (as shown on the card). */
  price: number;
  /** Billing period length in months (admin-configurable). */
  periodMonths: number;
  description: string;
  features: LicensePackageFeature[];
  popular?: boolean;
  active: boolean;
  /** Kept for compatibility with older saved data / reports. */
  monthlyPrice: number;
  yearlyPrice: number;
}

/** Common billing periods the platform admin can assign. */
export const PERIOD_MONTH_OPTIONS = [1, 3, 6, 12, 18, 24, 36] as const;

const PACKAGES_KEY = 'academyhub-license-packages-v2';

/** Athlete license options: 100, 150, …, 1000 */
export const ATHLETE_LICENSE_OPTIONS: number[] = Array.from(
  { length: Math.floor((1000 - 100) / 50) + 1 },
  (_, i) => 100 + i * 50,
);

function clampAthleteLicenses(value: number): number {
  if (!Number.isFinite(value) || value < 100) return 100;
  if (value > 1000) return 1000;
  const stepped = Math.round((value - 100) / 50) * 50 + 100;
  return Math.min(1000, Math.max(100, stepped));
}

const defaultPackages: LicensePackage[] = [
  {
    id: 'pkg_essential',
    name: 'ESSENTIAL',
    athleteLicenses: 100,
    price: 87,
    periodMonths: 3,
    description: 'Ιδανικό για μικρές ομάδες που θέλουν να πληρώνουν κάθε 3 μήνες',
    features: [
      { label: '14 ημέρες δωρεάν δοκιμής', included: true },
      { label: 'Διάρκεια 3 Μήνες', included: true },
      { label: 'Υποστήριξη 1 ώρα / εβδομάδα', included: true },
      { label: 'Καταχώρηση περιεχομένου', included: true },
      { label: 'Υπηρεσία Χορηγών', included: false },
      { label: 'Προώθηση ακαδημίας', included: false },
    ],
    active: true,
    monthlyPrice: 29,
    yearlyPrice: 87,
  },
  {
    id: 'pkg_growth',
    name: 'GROWTH',
    athleteLicenses: 100,
    price: 290,
    periodMonths: 12,
    description: 'Ετήσιο πακέτο για συλλόγους με πολλά μέλη. Περιλαμβάνει έκπτωση 2 μηνών',
    features: [
      { label: '14 ημέρες δωρεάν δοκιμής', included: true },
      { label: 'Διάρκεια 1 Έτος', included: true },
      { label: 'Απεριόριστο Support', included: true },
      { label: 'Καταχώρηση περιεχομένου', included: true },
      { label: 'Υπηρεσία Χορηγών', included: true },
      { label: 'Προώθηση ακαδημίας', included: true },
    ],
    active: true,
    monthlyPrice: 24,
    yearlyPrice: 290,
  },
  {
    id: 'pkg_enterprise',
    name: 'ENTERPRISE',
    athleteLicenses: 600,
    price: 4731,
    periodMonths: 24,
    description: 'Πλάνο για μεγάλους συλλόγους που χρειάζονται έναν σταθερό συνεργάτη στην καλύτερη τιμή!',
    features: [
      { label: '14 ημέρες δωρεάν δοκιμής', included: true },
      { label: 'Διάρκεια 2 Έτη', included: true },
      { label: 'Απεριόριστο Support', included: true },
      { label: 'Καταχώρηση περιεχομένου', included: true },
      { label: 'Υπηρεσία Χορηγών', included: true },
      { label: 'Προώθηση ακαδημίας', included: true },
    ],
    popular: true,
    active: true,
    monthlyPrice: 197,
    yearlyPrice: 2366,
  },
];

function normalizePackage(raw: Partial<LicensePackage> & { id?: string }): LicensePackage | null {
  const fallback = defaultPackages.find((p) => p.id === raw.id) ?? defaultPackages[0];
  if (!raw || typeof raw !== 'object') return null;

  const periodMonths =
    typeof raw.periodMonths === 'number' &&
    Number.isFinite(raw.periodMonths) &&
    raw.periodMonths >= 1 &&
    raw.periodMonths <= 60
      ? Math.round(raw.periodMonths)
      : fallback.periodMonths;

  const price =
    typeof raw.price === 'number' && Number.isFinite(raw.price)
      ? raw.price
      : typeof raw.yearlyPrice === 'number'
        ? raw.yearlyPrice
        : fallback.price;

  return {
    id: typeof raw.id === 'string' ? raw.id : fallback.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : fallback.name,
    athleteLicenses: clampAthleteLicenses(
      typeof raw.athleteLicenses === 'number' ? raw.athleteLicenses : fallback.athleteLicenses,
    ),
    price,
    periodMonths,
    description:
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description
        : fallback.description,
    features: Array.isArray(raw.features) && raw.features.length > 0 ? raw.features : fallback.features,
    popular: Boolean(raw.popular ?? fallback.popular),
    active: raw.active !== false,
    monthlyPrice:
      typeof raw.monthlyPrice === 'number' && Number.isFinite(raw.monthlyPrice)
        ? raw.monthlyPrice
        : Math.round((price / periodMonths) * 100) / 100,
    yearlyPrice:
      typeof raw.yearlyPrice === 'number' && Number.isFinite(raw.yearlyPrice)
        ? raw.yearlyPrice
        : periodMonths === 12
          ? price
          : Math.round((price / periodMonths) * 12 * 100) / 100,
  };
}

export function getLicensePackages(): LicensePackage[] {
  try {
    const raw = localStorage.getItem(PACKAGES_KEY);
    if (!raw) {
      const next = structuredClone(defaultPackages);
      localStorage.setItem(PACKAGES_KEY, JSON.stringify(next));
      return next;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return structuredClone(defaultPackages);
    }
    const normalized = parsed
      .map((item) => normalizePackage(item as Partial<LicensePackage>))
      .filter((item): item is LicensePackage => Boolean(item));
    return normalized.length >= 3 ? normalized.slice(0, 3) : structuredClone(defaultPackages);
  } catch {
    return structuredClone(defaultPackages);
  }
}

export function saveLicensePackages(packages: LicensePackage[]): void {
  const normalized = packages
    .map((pkg) => normalizePackage(pkg))
    .filter((item): item is LicensePackage => Boolean(item));
  localStorage.setItem(PACKAGES_KEY, JSON.stringify(normalized));
}

export function periodLabel(months: number): string {
  const n = Math.max(1, Math.round(months || 1));
  if (n === 1) return '1 μήνα';
  return `${n} μήνες`;
}
