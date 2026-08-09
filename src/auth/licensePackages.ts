export interface LicensePackage {
  id: string;
  name: string;
  athleteLicenses: number;
  monthlyPrice: number;
  yearlyPrice: number;
  active: boolean;
}

const PACKAGES_KEY = 'academyhub-license-packages-v1';

const defaultPackages: LicensePackage[] = [
  {
    id: 'pkg_starter',
    name: 'Starter',
    athleteLicenses: 10,
    monthlyPrice: 29,
    yearlyPrice: 290,
    active: true,
  },
  {
    id: 'pkg_club',
    name: 'Club',
    athleteLicenses: 50,
    monthlyPrice: 79,
    yearlyPrice: 790,
    active: true,
  },
  {
    id: 'pkg_pro',
    name: 'Pro',
    athleteLicenses: 150,
    monthlyPrice: 149,
    yearlyPrice: 1490,
    active: true,
  },
];

export function getLicensePackages(): LicensePackage[] {
  try {
    const raw = localStorage.getItem(PACKAGES_KEY);
    if (!raw) {
      localStorage.setItem(PACKAGES_KEY, JSON.stringify(defaultPackages));
      return structuredClone(defaultPackages);
    }
    return JSON.parse(raw) as LicensePackage[];
  } catch {
    return structuredClone(defaultPackages);
  }
}

export function saveLicensePackages(packages: LicensePackage[]): void {
  localStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
}
