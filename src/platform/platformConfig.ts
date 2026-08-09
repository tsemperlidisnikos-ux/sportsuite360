import {
  DEFAULT_EXPENSE_DESCRIPTIONS,
  DEFAULT_INCOME_DESCRIPTIONS,
  EXPENSE_SUBCATEGORIES,
  INCOME_SUBCATEGORIES,
} from '../shared/financeCategories';

export const SCF_MODULES = [
  { id: 'dashboard', label: 'DASHBOARD', path: '/' },
  { id: 'income', label: 'ΕΣΟΔΑ', path: '/finance' },
  { id: 'expense', label: 'ΕΞΟΔΑ', path: '/finance' },
  { id: 'budget', label: 'ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ', path: '/finance' },
  { id: 'reports', label: 'ΕΚΤΥΠΩΣΕΙΣ', path: '/finance' },
] as const;

export type ScfModuleId = (typeof SCF_MODULES)[number]['id'];

export const ACADEMY_MODULES = [
  { id: 'dashboard', label: 'Επισκόπηση', path: '/' },
  { id: 'athletes', label: 'Αθλητές', path: '/athletes' },
  { id: 'staff', label: 'Προσωπικό', path: '/staff' },
  { id: 'coaches', label: 'Προπονητές', path: '/coaches' },
  { id: 'classes', label: 'Τμήματα', path: '/classes' },
  { id: 'trainings', label: 'Προπονήσεις', path: '/trainings' },
  { id: 'schedule', label: 'Πρόγραμμα', path: '/schedule' },
  { id: 'attendance', label: 'Παρουσίες', path: '/attendance' },
  { id: 'associations', label: 'Σωματείο', path: '/associations' },
  { id: 'sports', label: 'Άθλημα', path: '/sports' },
  { id: 'announcements', label: 'Ανακοινώσεις', path: '/announcements' },
  { id: 'prints', label: 'Εκτυπώσεις', path: '/prints' },
  { id: 'warehouse', label: 'Αποθήκη', path: '/warehouse' },
  { id: 'fees', label: 'Συνδρομές / Πληρωμές', path: '/fees' },
  { id: 'transactions', label: 'Συναλλαγές', path: '/transactions' },
  { id: 'finance', label: 'Οικονομικά', path: '/finance' },
] as const;

export type AcademyModuleId = (typeof ACADEMY_MODULES)[number]['id'];

export const SCF_CLUB_ROLES = ['admin', 'treasurer', 'secretariat', 'readonly'] as const;
export type ScfClubRole = (typeof SCF_CLUB_ROLES)[number];

export const SCF_CLUB_ROLE_LABELS: Record<ScfClubRole, string> = {
  admin: 'Διαχειριστής συλλόγου',
  treasurer: 'Ταμίας',
  secretariat: 'Γραμματεία',
  readonly: 'Μόνο ανάγνωση',
};

export const SCF_PERMISSIONS = [
  'viewFinance',
  'writeFinance',
  'deleteFinance',
  'viewRegistry',
  'writeRegistry',
  'deleteRegistry',
  'writeBudget',
  'viewReports',
  'manageBackup',
  'manageTeam',
] as const;

export type ScfPermission = (typeof SCF_PERMISSIONS)[number];

export const SCF_PERMISSION_LABELS: Record<ScfPermission, string> = {
  viewFinance: 'Προβολή εσόδων/εξόδων',
  writeFinance: 'Καταχώρηση/επεξεργασία κινήσεων',
  deleteFinance: 'Διαγραφή κινήσεων',
  viewRegistry: 'Προβολή μητρώου',
  writeRegistry: 'Καταχώρηση/επεξεργασία μητρώου',
  deleteRegistry: 'Διαγραφή μητρώου',
  writeBudget: 'Προϋπολογισμός',
  viewReports: 'Εκτυπώσεις / αναφορές',
  manageBackup: 'Backup συλλόγου',
  manageTeam: 'Διαχείριση χρηστών/ρόλων',
};

export const DEFAULT_SCF_ROLE_PERMISSIONS: Record<ScfClubRole, ScfPermission[]> = {
  admin: [...SCF_PERMISSIONS],
  treasurer: [
    'viewFinance',
    'writeFinance',
    'deleteFinance',
    'viewRegistry',
    'writeBudget',
    'viewReports',
  ],
  secretariat: ['viewFinance', 'viewRegistry', 'writeRegistry', 'deleteRegistry', 'viewReports'],
  readonly: ['viewFinance', 'viewRegistry', 'viewReports'],
};

export const ACADEMY_ROLES = ['admin', 'coach', 'secretariat', 'athlete', 'parent'] as const;
export type AcademyRole = (typeof ACADEMY_ROLES)[number];

export const ACADEMY_ROLE_LABELS: Record<AcademyRole, string> = {
  admin: 'Διαχειριστής συλλόγου',
  coach: 'Προπονητής',
  secretariat: 'Γραμματεία',
  athlete: 'Αθλητής',
  parent: 'Γονέας',
};

export const ACADEMY_PERMISSIONS = [
  'manage_teams',
  'manage_athletes',
  'manage_matches',
  'manage_trainings',
  'send_announcements',
  'view_analytics',
  'manage_channels',
  'manage_finance',
  'manage_staff',
] as const;

export type AcademyPermission = (typeof ACADEMY_PERMISSIONS)[number];

export const ACADEMY_PERMISSION_LABELS: Record<AcademyPermission, string> = {
  manage_teams: 'Διαχείριση τμημάτων',
  manage_athletes: 'Διαχείριση αθλητών',
  manage_matches: 'Διαχείριση αγώνων',
  manage_trainings: 'Διαχείριση προπονήσεων',
  send_announcements: 'Αποστολή ανακοινώσεων',
  view_analytics: 'Προβολή αναλυτικών',
  manage_channels: 'Διαχείριση καναλιών',
  manage_finance: 'Διαχείριση οικονομικών',
  manage_staff: 'Διαχείριση προσωπικού',
};

export const DEFAULT_ACADEMY_ROLE_PERMISSIONS: Record<AcademyRole, AcademyPermission[]> = {
  admin: [...ACADEMY_PERMISSIONS],
  coach: ['manage_teams', 'manage_athletes', 'manage_trainings', 'send_announcements'],
  secretariat: [
    'manage_athletes',
    'manage_teams',
    'send_announcements',
    'manage_staff',
    'manage_finance',
  ],
  athlete: [],
  parent: [],
};

export type PlatformConfig = {
  scfModulesByClub: Record<string, ScfModuleId[]>;
  academyModulesByClub: Record<string, AcademyModuleId[]>;
  scfRolePermissions: Record<ScfClubRole, ScfPermission[]>;
  academyRolePermissions: Record<AcademyRole, AcademyPermission[]>;
  incomeCategories: string[];
  expenseCategories: string[];
  incomeDescriptions: Record<string, string[]>;
  expenseDescriptions: Record<string, string[]>;
  registryKinds: string[];
  seasons: string[];
};

const CONFIG_KEY = 'academyhub-platform-config-v3';
const LEGACY_CONFIG_KEYS = [
  'academyhub-platform-config-v2',
  'academyhub-platform-config-v1',
] as const;
const PREVIEW_KEY = 'academyhub-preview-club-v1';

function defaultDescriptions(
  map: Record<string, readonly string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(map).map(([key, values]) => [key, [...values]]),
  );
}

export function defaultPlatformConfig(): PlatformConfig {
  return {
    scfModulesByClub: {},
    academyModulesByClub: {},
    scfRolePermissions: structuredClone(DEFAULT_SCF_ROLE_PERMISSIONS),
    academyRolePermissions: structuredClone(DEFAULT_ACADEMY_ROLE_PERMISSIONS),
    incomeCategories: [...INCOME_SUBCATEGORIES],
    expenseCategories: [...EXPENSE_SUBCATEGORIES],
    incomeDescriptions: defaultDescriptions(DEFAULT_INCOME_DESCRIPTIONS),
    expenseDescriptions: defaultDescriptions(DEFAULT_EXPENSE_DESCRIPTIONS),
    registryKinds: ['ΑΘΛΗΤΕΣ', 'ΜΕΛΗ'],
    seasons: ['2025–2026', '2026–2027'],
  };
}

/** Επαναφέρει κατηγορίες εσόδων/εξόδων και περιγραφές στις προεπιλογές SCF. */
export function resetFinanceCatalogDefaults(config?: PlatformConfig): PlatformConfig {
  const current = config ?? loadPlatformConfigRaw();
  const next: PlatformConfig = {
    ...current,
    incomeCategories: [...INCOME_SUBCATEGORIES],
    expenseCategories: [...EXPENSE_SUBCATEGORIES],
    incomeDescriptions: defaultDescriptions(DEFAULT_INCOME_DESCRIPTIONS),
    expenseDescriptions: defaultDescriptions(DEFAULT_EXPENSE_DESCRIPTIONS),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function loadPlatformConfigRaw(): PlatformConfig {
  const base = defaultPlatformConfig();
  try {
    let raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      for (const key of LEGACY_CONFIG_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PlatformConfig>;
    return {
      ...base,
      ...parsed,
      scfRolePermissions: {
        ...base.scfRolePermissions,
        ...(parsed.scfRolePermissions ?? {}),
      },
      academyRolePermissions: {
        ...base.academyRolePermissions,
        ...(parsed.academyRolePermissions ?? {}),
      },
      incomeDescriptions: {
        ...base.incomeDescriptions,
        ...(parsed.incomeDescriptions ?? {}),
      },
      expenseDescriptions: {
        ...base.expenseDescriptions,
        ...(parsed.expenseDescriptions ?? {}),
      },
      incomeCategories:
        parsed.incomeCategories && parsed.incomeCategories.length > 0
          ? parsed.incomeCategories
          : base.incomeCategories,
      expenseCategories:
        parsed.expenseCategories && parsed.expenseCategories.length > 0
          ? parsed.expenseCategories
          : base.expenseCategories,
    };
  } catch {
    return base;
  }
}

export function loadPlatformConfig(): PlatformConfig {
  const base = defaultPlatformConfig();
  try {
    const hasCurrent = Boolean(localStorage.getItem(CONFIG_KEY));
    if (!hasCurrent) {
      // Μετάβαση: κρατάμε modules/permissions, κατηγορίες = defaults SCF
      let legacyRaw: string | null = null;
      for (const key of LEGACY_CONFIG_KEYS) {
        legacyRaw = localStorage.getItem(key);
        if (legacyRaw) break;
      }
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as Partial<PlatformConfig>;
        const migrated: PlatformConfig = {
          ...base,
          scfModulesByClub: parsed.scfModulesByClub ?? {},
          academyModulesByClub: parsed.academyModulesByClub ?? {},
          scfRolePermissions: {
            ...base.scfRolePermissions,
            ...(parsed.scfRolePermissions ?? {}),
          },
          academyRolePermissions: {
            ...base.academyRolePermissions,
            ...(parsed.academyRolePermissions ?? {}),
          },
          registryKinds:
            parsed.registryKinds && parsed.registryKinds.length > 0
              ? parsed.registryKinds
              : base.registryKinds,
          seasons: parsed.seasons && parsed.seasons.length > 0 ? parsed.seasons : base.seasons,
          incomeCategories: [...INCOME_SUBCATEGORIES],
          expenseCategories: [...EXPENSE_SUBCATEGORIES],
          incomeDescriptions: defaultDescriptions(DEFAULT_INCOME_DESCRIPTIONS),
          expenseDescriptions: defaultDescriptions(DEFAULT_EXPENSE_DESCRIPTIONS),
        };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(migrated));
        return migrated;
      }
      localStorage.setItem(CONFIG_KEY, JSON.stringify(base));
      return base;
    }

    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(base));
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<PlatformConfig>;
    const incomeCategories =
      parsed.incomeCategories && parsed.incomeCategories.length > 0
        ? mergeUnique(parsed.incomeCategories, INCOME_SUBCATEGORIES)
        : [...INCOME_SUBCATEGORIES];
    const expenseCategories =
      parsed.expenseCategories && parsed.expenseCategories.length > 0
        ? mergeUnique(parsed.expenseCategories, EXPENSE_SUBCATEGORIES)
        : [...EXPENSE_SUBCATEGORIES];

    const next: PlatformConfig = {
      ...base,
      ...parsed,
      scfRolePermissions: {
        ...base.scfRolePermissions,
        ...(parsed.scfRolePermissions ?? {}),
      },
      academyRolePermissions: {
        ...base.academyRolePermissions,
        ...(parsed.academyRolePermissions ?? {}),
      },
      incomeCategories,
      expenseCategories,
      incomeDescriptions: mergeDescriptions(
        defaultDescriptions(DEFAULT_INCOME_DESCRIPTIONS),
        parsed.incomeDescriptions,
        incomeCategories,
      ),
      expenseDescriptions: mergeDescriptions(
        defaultDescriptions(DEFAULT_EXPENSE_DESCRIPTIONS),
        parsed.expenseDescriptions,
        expenseCategories,
      ),
    };
    return next;
  } catch {
    return base;
  }
}

function mergeUnique(current: string[], defaults: readonly string[]): string[] {
  const set = new Set([...defaults, ...current]);
  return [...set];
}

function mergeDescriptions(
  defaults: Record<string, string[]>,
  stored: Record<string, string[]> | undefined,
  categories: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const category of categories) {
    const fromDefault = defaults[category] ?? [];
    const fromStored = stored?.[category] ?? [];
    if (fromStored.length === 0) {
      result[category] = [...fromDefault];
    } else {
      result[category] = [...new Set([...fromDefault, ...fromStored])];
    }
  }
  return result;
}

export function savePlatformConfig(config: PlatformConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function getScfModulesForClub(clubId: string): ScfModuleId[] {
  const config = loadPlatformConfig();
  const allowed = new Set(SCF_MODULES.map((m) => m.id));
  const stored = config.scfModulesByClub[clubId] ?? SCF_MODULES.map((m) => m.id);
  const filtered = stored.filter((id): id is ScfModuleId => allowed.has(id as ScfModuleId));
  return filtered.length > 0 ? filtered : SCF_MODULES.map((m) => m.id);
}

export function getAcademyModulesForClub(clubId: string): AcademyModuleId[] {
  const config = loadPlatformConfig();
  const allIds = ACADEMY_MODULES.map((m) => m.id);
  const stored = config.academyModulesByClub[clubId];
  if (!stored) return allIds;
  const allowed = new Set(allIds);
  const filtered = stored.filter((id): id is AcademyModuleId => allowed.has(id as AcademyModuleId));
  // Newer modules (e.g. warehouse) appear even if older club configs omit them
  for (const id of ['warehouse'] as const) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  return filtered.length > 0 ? filtered : allIds;
}

export function startPreview(clubId: string): void {
  localStorage.setItem(PREVIEW_KEY, clubId);
}

export function endPreview(): void {
  localStorage.removeItem(PREVIEW_KEY);
}

export function getPreviewClubId(): string | null {
  return localStorage.getItem(PREVIEW_KEY);
}

export function isPreviewMode(): boolean {
  return Boolean(getPreviewClubId());
}
