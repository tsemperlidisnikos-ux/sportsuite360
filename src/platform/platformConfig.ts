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
  { id: 'calendar', label: 'Ημερολόγιο', path: '/calendar' },
  { id: 'athletes', label: 'Αθλητές', path: '/athletes' },
  { id: 'staff', label: 'Προσωπικό', path: '/staff' },
  { id: 'coaches', label: 'Προπονητές', path: '/coaches' },
  { id: 'classes', label: 'Τμήματα', path: '/classes' },
  { id: 'parents', label: 'Γονείς', path: '/parents' },
  { id: 'trainings', label: 'Προπονήσεις', path: '/trainings' },
  { id: 'matches', label: 'Αγώνες', path: '/matches' },
  { id: 'schedule', label: 'Πρόγραμμα', path: '/schedule' },
  { id: 'attendance', label: 'Παρουσίες', path: '/attendance' },
  { id: 'associations', label: 'Σωματείο', path: '/associations' },
  { id: 'sports', label: 'Άθλημα', path: '/sports' },
  { id: 'announcements', label: 'Ανακοινώσεις', path: '/announcements' },
  { id: 'prints', label: 'Εκτυπώσεις', path: '/prints' },
  { id: 'photos', label: 'Φωτογραφίες', path: '/photos' },
  { id: 'warehouse', label: 'Αποθήκη', path: '/warehouse' },
  { id: 'fees', label: 'Συνδρομές / Πληρωμές', path: '/fees' },
  { id: 'transactions', label: 'Συναλλαγές', path: '/transactions' },
  { id: 'partnerBusinesses', label: 'Συμβεβλημένες Επιχειρήσεις', path: '/partner-businesses' },
  { id: 'settings', label: 'Ρυθμίσεις', path: '/settings' },
  { id: 'finance', label: 'Οικονομικά', path: '/finance' },
] as const;

export type AcademyModuleId = (typeof ACADEMY_MODULES)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Δικαιώματα ρόλων συλλόγου                                                  */
/* -------------------------------------------------------------------------- */

export const CLUB_ROLES = [
  'admin',
  'doctor',
  'secretariat',
  'coach',
  'staff',
  'athlete',
  'parent',
] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const CLUB_ROLE_LABELS: Record<ClubRole, string> = {
  admin: 'Διαχειριστής συλλόγου',
  doctor: 'Ιατρός',
  coach: 'Προπονητής',
  secretariat: 'Γραμματεία',
  staff: 'Προσωπικό',
  athlete: 'Αθλητής',
  parent: 'Γονέας',
};

/** Δικαιώματα = πρόσβαση σε καρτέλες μενού (χωρίς dashboard). */
export const CLUB_PERMISSIONS = [
  'calendar',
  'athletes',
  'staff',
  'coaches',
  'classes',
  'parents',
  'trainings',
  'matches',
  'schedule',
  'attendance',
  'announcements',
  'prints',
  'photos',
  'warehouse',
  'fees',
  'transactions',
  'partnerBusinesses',
  'settings',
  'finance',
] as const;

export type ClubPermission = (typeof CLUB_PERMISSIONS)[number];

export const CLUB_PERMISSION_LABELS: Record<ClubPermission, string> = {
  calendar: 'Ημερολόγιο',
  athletes: 'Αθλητές',
  staff: 'Προσωπικό',
  coaches: 'Προπονητές',
  classes: 'Τμήματα',
  parents: 'Γονείς',
  trainings: 'Προπονήσεις',
  matches: 'Αγώνες',
  schedule: 'Πρόγραμμα',
  attendance: 'Παρουσίες',
  announcements: 'Ανακοινώσεις',
  prints: 'Εκτυπώσεις',
  photos: 'Φωτογραφίες',
  warehouse: 'Αποθήκη',
  fees: 'Συνδρομές / Πληρωμές',
  transactions: 'Συναλλαγές',
  partnerBusinesses: 'Συμβεβλημένες Επιχειρήσεις',
  settings: 'Ρυθμίσεις',
  finance: 'Οικονομικά',
};

export const DEFAULT_CLUB_ROLE_PERMISSIONS: Record<ClubRole, ClubPermission[]> = {
  admin: [...CLUB_PERMISSIONS],
  doctor: ['calendar', 'athletes', 'announcements', 'settings'],
  coach: [
    'calendar',
    'athletes',
    'classes',
    'trainings',
    'matches',
    'schedule',
    'attendance',
    'announcements',
    'settings',
  ],
  secretariat: [
    'calendar',
    'athletes',
    'staff',
    'coaches',
    'classes',
    'parents',
    'announcements',
    'prints',
    'photos',
    'warehouse',
    'fees',
    'transactions',
    'partnerBusinesses',
    'settings',
    'finance',
  ],
  staff: ['calendar'],
  athlete: ['schedule', 'attendance', 'fees', 'announcements', 'settings'],
  parent: ['fees', 'announcements', 'settings'],
};

export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
export type BackupDeliveryMode = 'download' | 'cloud' | 'both';

/** Κανόνας προγραμματισμένου backup (ώρα τοπική του browser). */
export type BackupScheduleRule = {
  enabled: boolean;
  frequency: BackupFrequency;
  /** HH:mm τοπική ώρα */
  timeLocal: string;
  /** 0=Κυρ … 6=Σαβ (μόνο weekly) */
  dayOfWeek?: number;
  /** 1–28 (μόνο monthly) */
  dayOfMonth?: number;
  /** download = αρχείο, cloud = Redis mirror, both = και τα δύο */
  mode: BackupDeliveryMode;
  lastRunAt?: string | null;
};

export type PlatformBackupSchedules = {
  /** Πλήρες backup εφαρμογής (users, clubs, config, όλα τα δεδομένα). */
  fullApp: BackupScheduleRule;
  /** Backup δεδομένων κάθε συλλόγου / χρήστη πλατφόρμας. */
  perClub: BackupScheduleRule;
  /**
   * Σύλλογοι που συμμετέχουν στο per-club backup.
   * Κενό = όλοι οι σύλλογοι.
   */
  clubIds: string[];
};

export function defaultBackupScheduleRule(
  overrides?: Partial<BackupScheduleRule>,
): BackupScheduleRule {
  return {
    enabled: false,
    frequency: 'daily',
    timeLocal: '02:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    mode: 'download',
    lastRunAt: null,
    ...overrides,
  };
}

export function defaultBackupSchedules(): PlatformBackupSchedules {
  return {
    fullApp: defaultBackupScheduleRule({ mode: 'download' }),
    perClub: defaultBackupScheduleRule({ mode: 'cloud' }),
    clubIds: [],
  };
}

/** Εμφάνιση εφαρμογής — ορίζεται από Platform Admin. */
export type AppearanceTheme = 'classic' | 'navy-amber';

export const APPEARANCE_THEMES: Array<{
  id: AppearanceTheme;
  label: string;
  description: string;
}> = [
  {
    id: 'classic',
    label: 'Κλασική (τρέχουσα)',
    description: 'Teal / mint εμφάνιση όπως σήμερα.',
  },
  {
    id: 'navy-amber',
    label: 'Navy + Amber',
    description: 'Σκούρο navy + amber (όπως το mockup παρουσιών), σε όλη την εφαρμογή.',
  },
];

export function sanitizeAppearanceTheme(value: unknown): AppearanceTheme {
  if (value === 'classic') return 'classic';
  if (value === 'navy-amber') return 'navy-amber';
  /* Default for new / unset configs: Navy + Amber redesign */
  return 'navy-amber';
}

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
  /** classic = υπάρχον UI · navy-amber = νέο finance-dense look */
  appearanceTheme?: AppearanceTheme;
  backupSchedules?: PlatformBackupSchedules;
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
    // Newer modules: εμφανίζονται δίπλα στις Ρυθμίσεις αν ο ρόλος τις είχε ήδη
    if (result[role].includes('settings') && !result[role].includes('partnerBusinesses')) {
      const settingsIndex = result[role].indexOf('settings');
      result[role].splice(settingsIndex, 0, 'partnerBusinesses');
    }
    if (result[role].includes('prints') && !result[role].includes('photos')) {
      const printsIndex = result[role].indexOf('prints');
      result[role].splice(printsIndex + 1, 0, 'photos');
    }
    if (result[role].includes('classes') && !result[role].includes('parents')) {
      const classesIndex = result[role].indexOf('classes');
      result[role].splice(classesIndex + 1, 0, 'parents');
    }
    if (result[role].includes('trainings') && !result[role].includes('matches')) {
      const trainingsIndex = result[role].indexOf('trainings');
      result[role].splice(trainingsIndex + 1, 0, 'matches');
    }
    if (!result[role].includes('calendar')) {
      const hasRelated =
        result[role].includes('schedule') ||
        result[role].includes('trainings') ||
        result[role].includes('settings');
      if (hasRelated) result[role] = ['calendar', ...result[role]];
    }
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
    appearanceTheme: 'navy-amber',
    backupSchedules: defaultBackupSchedules(),
  };
}

function sanitizeBackupSchedules(
  stored: Partial<PlatformBackupSchedules> | undefined,
): PlatformBackupSchedules {
  const base = defaultBackupSchedules();
  if (!stored) return base;
  const mergeRule = (
    rule: Partial<BackupScheduleRule> | undefined,
    fallback: BackupScheduleRule,
  ): BackupScheduleRule => ({
    ...fallback,
    ...(rule ?? {}),
    enabled: Boolean(rule?.enabled),
    frequency:
      rule?.frequency === 'weekly' || rule?.frequency === 'monthly' || rule?.frequency === 'daily'
        ? rule.frequency
        : fallback.frequency,
    timeLocal:
      typeof rule?.timeLocal === 'string' && /^\d{2}:\d{2}$/.test(rule.timeLocal)
        ? rule.timeLocal
        : fallback.timeLocal,
    mode:
      rule?.mode === 'cloud' || rule?.mode === 'both' || rule?.mode === 'download'
        ? rule.mode
        : fallback.mode,
    lastRunAt: rule?.lastRunAt ?? null,
  });
  return {
    fullApp: mergeRule(stored.fullApp, base.fullApp),
    perClub: mergeRule(stored.perClub, base.perClub),
    clubIds: Array.isArray(stored.clubIds)
      ? stored.clubIds.filter((id): id is string => typeof id === 'string')
      : [],
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
      backupSchedules: sanitizeBackupSchedules(parsed.backupSchedules),
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
          appearanceTheme: sanitizeAppearanceTheme(parsed.appearanceTheme),
          backupSchedules: sanitizeBackupSchedules(parsed.backupSchedules),
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
      backupSchedules: sanitizeBackupSchedules(parsed.backupSchedules),
      appearanceTheme: sanitizeAppearanceTheme(parsed.appearanceTheme),
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

export function getBackupSchedules(): PlatformBackupSchedules {
  return sanitizeBackupSchedules(loadPlatformConfig().backupSchedules);
}

export function saveBackupSchedules(schedules: PlatformBackupSchedules): PlatformConfig {
  const next: PlatformConfig = {
    ...loadPlatformConfig(),
    backupSchedules: sanitizeBackupSchedules(schedules),
  };
  savePlatformConfig(next);
  return next;
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
  const next: PlatformConfig = {
    ...config,
    appearanceTheme: sanitizeAppearanceTheme(config.appearanceTheme),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  applyAppearanceTheme(next.appearanceTheme);
  window.dispatchEvent(new CustomEvent('academyhub-platform-updated'));
}

export function getAppName(): string {
  return loadPlatformConfig().appName?.trim() || 'SPORTSUITE 360';
}

export function getAppLogoUrl(): string | null {
  return loadPlatformConfig().appLogoUrl ?? null;
}

export function getAppearanceTheme(): AppearanceTheme {
  return sanitizeAppearanceTheme(loadPlatformConfig().appearanceTheme);
}

export function applyAppearanceTheme(theme?: AppearanceTheme): void {
  if (typeof document === 'undefined') return;
  const resolved = sanitizeAppearanceTheme(theme ?? getAppearanceTheme());
  document.documentElement.setAttribute('data-appearance', resolved);
}

export function setAppearanceTheme(theme: AppearanceTheme): PlatformConfig {
  const next: PlatformConfig = {
    ...loadPlatformConfig(),
    appearanceTheme: sanitizeAppearanceTheme(theme),
  };
  savePlatformConfig(next);
  return next;
}

const APPEARANCE_ROLLOUT_KEY = 'academyhub-navy-amber-rollout-v1';

/** Εφαρμόζει το θέμα στην εκκίνηση και σε κάθε platform update. */
export function startAppearanceTheme(): void {
  try {
    /* One-time rollout: activate Navy + Amber across the app (can revert in Platform Admin). */
    if (!localStorage.getItem(APPEARANCE_ROLLOUT_KEY)) {
      const next: PlatformConfig = {
        ...loadPlatformConfig(),
        appearanceTheme: 'navy-amber',
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      localStorage.setItem(APPEARANCE_ROLLOUT_KEY, '1');
    }
  } catch {
    /* ignore */
  }
  applyAppearanceTheme();
  window.addEventListener('academyhub-platform-updated', () => {
    applyAppearanceTheme();
  });
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
  for (const id of [
    'calendar',
    'parents',
    'photos',
    'warehouse',
    'partnerBusinesses',
    'settings',
    'matches',
  ] as const) {
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
  window.dispatchEvent(new CustomEvent('academyhub-platform-updated'));
}

export function endPreview(): void {
  localStorage.removeItem(PREVIEW_KEY);
  window.dispatchEvent(new CustomEvent('academyhub-platform-updated'));
}

export function getPreviewClubId(): string | null {
  return localStorage.getItem(PREVIEW_KEY);
}

export function isPreviewMode(): boolean {
  return Boolean(getPreviewClubId());
}
