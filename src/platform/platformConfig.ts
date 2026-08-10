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
  { id: 'settings', label: 'Ρυθμίσεις', path: '/settings' },
  { id: 'finance', label: 'Οικονομικά', path: '/finance' },
] as const;

export type AcademyModuleId = (typeof ACADEMY_MODULES)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Δικαιώματα ρόλων συλλόγου                                                  */
/* -------------------------------------------------------------------------- */

export const CLUB_ROLES = ['admin', 'secretariat', 'coach', 'athlete', 'parent'] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const CLUB_ROLE_LABELS: Record<ClubRole, string> = {
  admin: 'Διαχειριστής συλλόγου',
  coach: 'Προπονητής',
  secretariat: 'Γραμματεία',
  athlete: 'Αθλητής',
  parent: 'Γονέας',
};

/** Δικαιώματα = πρόσβαση σε καρτέλες μενού (χωρίς dashboard). */
export const CLUB_PERMISSIONS = [
  'athletes',
  'staff',
  'coaches',
  'classes',
  'trainings',
  'schedule',
  'attendance',
  'announcements',
  'prints',
  'warehouse',
  'fees',
  'transactions',
  'settings',
  'finance',
] as const;

export type ClubPermission = (typeof CLUB_PERMISSIONS)[number];

export const CLUB_PERMISSION_LABELS: Record<ClubPermission, string> = {
  athletes: 'Αθλητές',
  staff: 'Προσωπικό',
  coaches: 'Προπονητές',
  classes: 'Τμήματα',
  trainings: 'Προπονήσεις',
  schedule: 'Πρόγραμμα',
  attendance: 'Παρουσίες',
  announcements: 'Ανακοινώσεις',
  prints: 'Εκτυπώσεις',
  warehouse: 'Αποθήκη',
  fees: 'Συνδρομές / Πληρωμές',
  transactions: 'Συναλλαγές',
  settings: 'Ρυθμίσεις',
  finance: 'Οικονομικά',
};

export const DEFAULT_CLUB_ROLE_PERMISSIONS: Record<ClubRole, ClubPermission[]> = {
  admin: [...CLUB_PERMISSIONS],
  coach: [
    'athletes',
    'classes',
    'trainings',
    'schedule',
    'attendance',
    'announcements',
  ],
  secretariat: [
    'athletes',
    'staff',
    'coaches',
    'classes',
    'announcements',
    'prints',
    'warehouse',
    'fees',
    'transactions',
    'settings',
    'finance',
  ],
  athlete: [],
  parent: [],
};

export type PlatformConfig = {
  scfModulesByClub: Record<string, ScfModuleId[]>;
  academyModulesByClub: Record<string, AcademyModuleId[]>;
  clubRolePermissions: Record<ClubRole, ClubPermission[]>;
  incomeCategories: string[];
  expenseCategories: string[];
  incomeDescriptions: Record<string, string[]>;
  expenseDescriptions: Record<string, string[]>;
  registryKinds: string[];
  seasons: string[];
  appLogoUrl?: string | null;
  appName?: string;
};

const CONFIG_KEY = 'academyhub-platform-config-v5';
const LEGACY_CONFIG_KEYS = [
  'academyhub-platform-config-v4',
  'academyhub-platform-config-v3',
  'academyhub-platform-config-v2',
  'academyhub-platform-config-v1',
] as const;
const PREVIEW_KEY = 'academyhub-preview-club-v1';
const FINANCE_DEFAULTS_KEY = 'academyhub-finance-catalog-defaults-v1';
const REMOVED_INCOME_CATEGORIES = new Set(['ΣΥΝΔΡΟΜΕΣ ΑΘΛΗΤΩΝ', 'ΣΥΝΔΡΟΜΕΣ ΜΕΛΩΝ']);

type FinanceCatalogSeed = {
  incomeCategories: string[];
  expenseCategories: string[];
  incomeDescriptions: Record<string, string[]>;
  expenseDescriptions: Record<string, string[]>;
};

function defaultDescriptions(
  map: Record<string, readonly string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(map).map(([key, values]) => [key, [...values]]),
  );
}

function builtInFinanceCatalogSeed(): FinanceCatalogSeed {
  return {
    incomeCategories: [...INCOME_SUBCATEGORIES].filter(
      (item) => !REMOVED_INCOME_CATEGORIES.has(item),
    ),
    expenseCategories: [...EXPENSE_SUBCATEGORIES],
    incomeDescriptions: defaultDescriptions(DEFAULT_INCOME_DESCRIPTIONS),
    expenseDescriptions: defaultDescriptions(DEFAULT_EXPENSE_DESCRIPTIONS),
  };
}

/** Προεπιλογές καταλόγου: όσα έχουν οριστεί στην εφαρμογή, αλλιώς built-in. */
export function getFinanceCatalogSeed(): FinanceCatalogSeed {
  try {
    const raw = localStorage.getItem(FINANCE_DEFAULTS_KEY);
    if (!raw) return builtInFinanceCatalogSeed();
    const parsed = JSON.parse(raw) as Partial<FinanceCatalogSeed>;
    if (!parsed.incomeCategories?.length || !parsed.expenseCategories?.length) {
      return builtInFinanceCatalogSeed();
    }
    return {
      incomeCategories: parsed.incomeCategories.filter(
        (item) => !REMOVED_INCOME_CATEGORIES.has(item),
      ),
      expenseCategories: [...parsed.expenseCategories],
      incomeDescriptions: parsed.incomeDescriptions
        ? structuredClone(parsed.incomeDescriptions)
        : {},
      expenseDescriptions: parsed.expenseDescriptions
        ? structuredClone(parsed.expenseDescriptions)
        : {},
    };
  } catch {
    return builtInFinanceCatalogSeed();
  }
}

/** Αποθηκεύει τις τρέχουσες κατηγορίες/υποκατηγορίες ως by-default για όλα. */
export function saveFinanceCatalogAsDefaults(config: PlatformConfig): FinanceCatalogSeed {
  const seed: FinanceCatalogSeed = {
    incomeCategories: config.incomeCategories.filter(
      (item) => !REMOVED_INCOME_CATEGORIES.has(item),
    ),
    expenseCategories: [...config.expenseCategories],
    incomeDescriptions: structuredClone(config.incomeDescriptions),
    expenseDescriptions: structuredClone(config.expenseDescriptions),
  };
  localStorage.setItem(FINANCE_DEFAULTS_KEY, JSON.stringify(seed));
  return seed;
}

function sanitizeClubRolePermissions(
  stored: Partial<Record<ClubRole, string[]>> | undefined,
): Record<ClubRole, ClubPermission[]> {
  const allowed = new Set<string>(CLUB_PERMISSIONS);
  const result = structuredClone(DEFAULT_CLUB_ROLE_PERMISSIONS);
  if (!stored) return result;
  for (const role of CLUB_ROLES) {
    const list = stored[role];
    if (!list) continue;
    result[role] = list.filter((p): p is ClubPermission => allowed.has(p));
  }
  return result;
}

export function defaultPlatformConfig(): PlatformConfig {
  const seed = getFinanceCatalogSeed();
  return {
    scfModulesByClub: {},
    academyModulesByClub: {},
    clubRolePermissions: structuredClone(DEFAULT_CLUB_ROLE_PERMISSIONS),
    incomeCategories: [...seed.incomeCategories],
    expenseCategories: [...seed.expenseCategories],
    incomeDescriptions: structuredClone(seed.incomeDescriptions),
    expenseDescriptions: structuredClone(seed.expenseDescriptions),
    registryKinds: ['ΑΘΛΗΤΕΣ', 'ΜΕΛΗ'],
    seasons: ['2025–2026', '2026–2027'],
    appLogoUrl: null,
    appName: 'SPORTSUITE 360',
  };
}

/** Επαναφέρει κατηγορίες/περιγραφές στις αποθηκευμένες προεπιλογές (by default). */
export function resetFinanceCatalogDefaults(config?: PlatformConfig): PlatformConfig {
  const current = config ?? loadPlatformConfigRaw();
  const seed = getFinanceCatalogSeed();
  const next: PlatformConfig = {
    ...current,
    incomeCategories: [...seed.incomeCategories],
    expenseCategories: [...seed.expenseCategories],
    incomeDescriptions: structuredClone(seed.incomeDescriptions),
    expenseDescriptions: structuredClone(seed.expenseDescriptions),
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
      clubRolePermissions: sanitizeClubRolePermissions(
        (parsed as { clubRolePermissions?: Partial<Record<ClubRole, string[]>> })
          .clubRolePermissions,
      ),
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
          ? parsed.incomeCategories.filter((item) => !REMOVED_INCOME_CATEGORIES.has(item))
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
      let legacyRaw: string | null = null;
      for (const key of LEGACY_CONFIG_KEYS) {
        legacyRaw = localStorage.getItem(key);
        if (legacyRaw) break;
      }
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as Partial<PlatformConfig>;
        const seed = getFinanceCatalogSeed();
        const migrated: PlatformConfig = {
          ...base,
          scfModulesByClub: parsed.scfModulesByClub ?? {},
          academyModulesByClub: parsed.academyModulesByClub ?? {},
          clubRolePermissions: sanitizeClubRolePermissions(
            (parsed as { clubRolePermissions?: Partial<Record<ClubRole, string[]>> })
              .clubRolePermissions,
          ),
          registryKinds:
            parsed.registryKinds && parsed.registryKinds.length > 0
              ? parsed.registryKinds
              : base.registryKinds,
          seasons: parsed.seasons && parsed.seasons.length > 0 ? parsed.seasons : base.seasons,
          incomeCategories:
            parsed.incomeCategories && parsed.incomeCategories.length > 0
              ? parsed.incomeCategories.filter((item) => !REMOVED_INCOME_CATEGORIES.has(item))
              : [...seed.incomeCategories],
          expenseCategories:
            parsed.expenseCategories && parsed.expenseCategories.length > 0
              ? [...parsed.expenseCategories]
              : [...seed.expenseCategories],
          incomeDescriptions: resolveCatalogDescriptions(
            seed.incomeDescriptions,
            parsed.incomeDescriptions,
            parsed.incomeCategories && parsed.incomeCategories.length > 0
              ? parsed.incomeCategories.filter((item) => !REMOVED_INCOME_CATEGORIES.has(item))
              : seed.incomeCategories,
          ),
          expenseDescriptions: resolveCatalogDescriptions(
            seed.expenseDescriptions,
            parsed.expenseDescriptions,
            parsed.expenseCategories && parsed.expenseCategories.length > 0
              ? parsed.expenseCategories
              : seed.expenseCategories,
          ),
          appLogoUrl: parsed.appLogoUrl ?? base.appLogoUrl,
          appName: parsed.appName ?? base.appName,
        };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(migrated));
        if (!localStorage.getItem(FINANCE_DEFAULTS_KEY)) {
          saveFinanceCatalogAsDefaults(migrated);
        }
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
    const seed = getFinanceCatalogSeed();
    const incomeCategories =
      parsed.incomeCategories && parsed.incomeCategories.length > 0
        ? parsed.incomeCategories.filter((item) => !REMOVED_INCOME_CATEGORIES.has(item))
        : [...seed.incomeCategories];
    const expenseCategories =
      parsed.expenseCategories && parsed.expenseCategories.length > 0
        ? [...parsed.expenseCategories]
        : [...seed.expenseCategories];

    const next: PlatformConfig = {
      ...base,
      ...parsed,
      clubRolePermissions: sanitizeClubRolePermissions(
        (parsed as { clubRolePermissions?: Partial<Record<ClubRole, string[]>> })
          .clubRolePermissions,
      ),
      incomeCategories,
      expenseCategories,
      incomeDescriptions: resolveCatalogDescriptions(
        seed.incomeDescriptions,
        parsed.incomeDescriptions,
        incomeCategories,
      ),
      expenseDescriptions: resolveCatalogDescriptions(
        seed.expenseDescriptions,
        parsed.expenseDescriptions,
        expenseCategories,
      ),
    };
    if (!localStorage.getItem(FINANCE_DEFAULTS_KEY)) {
      saveFinanceCatalogAsDefaults(next);
    }
    return next;
  } catch {
    return base;
  }
}

/** Κρατά τις αποθηκευμένες υποκατηγορίες· δεν επαναφέρει διαγραμμένες τιμές από defaults. */
function resolveCatalogDescriptions(
  defaults: Record<string, string[]>,
  stored: Record<string, string[]> | undefined,
  categories: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const category of categories) {
    if (stored && Object.prototype.hasOwnProperty.call(stored, category)) {
      result[category] = [...(stored[category] ?? [])];
    } else {
      result[category] = [...(defaults[category] ?? [])];
    }
  }
  return result;
}

export function savePlatformConfig(config: PlatformConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('academyhub-platform-updated'));
}

export function getAppName(): string {
  return loadPlatformConfig().appName?.trim() || 'SPORTSUITE 360';
}

export function getAppLogoUrl(): string | null {
  return loadPlatformConfig().appLogoUrl ?? null;
}

export function updateAppLogo(logoUrl: string | null): PlatformConfig {
  const next = { ...loadPlatformConfig(), appLogoUrl: logoUrl };
  savePlatformConfig(next);
  return next;
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
  for (const id of ['warehouse', 'settings'] as const) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  return filtered.length > 0 ? filtered : allIds;
}

/** Καθολικές προεπιλογές δικαιωμάτων — ισχύουν για όλα τα σωματεία. */
export function getDefaultClubRolePermissions(): Record<ClubRole, ClubPermission[]> {
  return structuredClone(loadPlatformConfig().clubRolePermissions);
}

export function getPermissionsForClubRole(role: ClubRole): ClubPermission[] {
  return [...(loadPlatformConfig().clubRolePermissions[role] ?? [])];
}

export function isClubRole(role: string): role is ClubRole {
  return (CLUB_ROLES as readonly string[]).includes(role);
}

export function roleHasClubPermission(role: string, permission: ClubPermission): boolean {
  if (role === 'platform_admin') return true;
  if (!isClubRole(role)) return false;
  return getPermissionsForClubRole(role).includes(permission);
}

export function getEffectiveClubPermissions(user: {
  role: string;
  permissions?: string[] | null;
}): ClubPermission[] {
  if (user.role === 'platform_admin') return [...CLUB_PERMISSIONS];
  if (user.permissions) {
    const allowed = new Set<string>(CLUB_PERMISSIONS);
    return user.permissions.filter((p): p is ClubPermission => allowed.has(p));
  }
  if (isClubRole(user.role)) return getPermissionsForClubRole(user.role);
  return [];
}

export function userHasClubPermission(
  user: { role: string; permissions?: string[] | null },
  permission: ClubPermission,
): boolean {
  if (user.role === 'platform_admin') return true;
  return getEffectiveClubPermissions(user).includes(permission);
}

/** Έλεγχος πρόσβασης σε καρτέλα μενού (καθολικά defaults ρόλου ή overrides χρήστη). */
export function roleCanAccessModule(role: string, moduleId: AcademyModuleId): boolean {
  return userCanAccessModule({ role }, moduleId);
}

export function userCanAccessModule(
  user: { role: string; permissions?: string[] | null },
  moduleId: AcademyModuleId,
): boolean {
  if (user.role === 'platform_admin') return true;
  if (moduleId === 'dashboard') return true;
  if (moduleId === 'associations' || moduleId === 'sports') {
    return userHasClubPermission(user, 'settings');
  }
  if ((CLUB_PERMISSIONS as readonly string[]).includes(moduleId)) {
    return userHasClubPermission(user, moduleId as ClubPermission);
  }
  return false;
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
