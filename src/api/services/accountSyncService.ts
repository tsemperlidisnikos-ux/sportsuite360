import { apiClient } from '../apiClient';
import { syncAuthHeaders } from '../syncAuth';
import { getUsers, saveUsers, type AppUser } from '../../auth/auth';
import { getClubs, mergeClubCatalog, saveClubs, type Club } from '../../auth/clubs';
import {
  clearStampedRoleDefaultPermissions,
  loadPlatformConfig,
  savePlatformConfig,
  type PlatformConfig,
} from '../../platform/platformConfig';

export type AccountBundlePayload = {
  users: AppUser[];
  clubs: Club[];
  platformConfig?: PlatformConfig | null;
  updatedAt?: string | null;
  durable?: boolean;
};

export async function pushAccountBundle() {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account', {
      method: 'POST',
      headers: syncAuthHeaders(),
      body: JSON.stringify({
        users: getUsers(),
        clubs: getClubs(),
        platformConfig: loadPlatformConfig(),
      }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; updatedAt?: string };
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Account push HTTP ${response.status}`);
    }
    return { updatedAt: json.updatedAt ?? null };
  });
}

export async function pullAccountBundle() {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account', {
      headers: syncAuthHeaders(false),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      users?: AppUser[];
      clubs?: Club[];
      platformConfig?: PlatformConfig | null;
      updatedAt?: string;
      durable?: boolean;
    };
    if (response.status === 404) {
      throw new Error('Δεν υπάρχει cloud account bundle. Κάντε πρώτα Push.');
    }
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Account pull HTTP ${response.status}`);
    }
    if (!Array.isArray(json.users) || !Array.isArray(json.clubs)) {
      throw new Error('Μη έγκυρο account bundle.');
    }
    return {
      users: json.users,
      clubs: json.clubs,
      platformConfig: json.platformConfig ?? null,
      updatedAt: json.updatedAt ?? null,
      durable: Boolean(json.durable),
    } satisfies AccountBundlePayload;
  });
}

/** Εφαρμόζει cloud users/clubs/config τοπικά (source of truth). */
export function applyAccountBundle(
  bundle: AccountBundlePayload,
  options?: { mergeLocalUsers?: boolean },
) {
  if (bundle.platformConfig) {
    savePlatformConfig(bundle.platformConfig);
  }

  const cleanedUsers = clearStampedRoleDefaultPermissions(bundle.users);

  if (options?.mergeLocalUsers) {
    const cloudUsers = cleanedUsers;
    const localUsers = clearStampedRoleDefaultPermissions(getUsers());
    const byId = new Map(cloudUsers.map((u) => [u.id, u]));
    const cloudEmails = new Set(cloudUsers.map((u) => u.email.toLowerCase()));
    for (const local of localUsers) {
      if (byId.has(local.id)) continue;
      if (cloudEmails.has(local.email.toLowerCase())) continue;
      byId.set(local.id, local);
    }
    saveUsers([...byId.values()]);
  } else {
    saveUsers(cleanedUsers);
  }
  saveClubs(mergeClubCatalog(getClubs(), bundle.clubs));
}
