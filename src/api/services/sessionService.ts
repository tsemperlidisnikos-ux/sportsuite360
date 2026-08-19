import { applyPlatformBranding } from '../../platform/platformConfig';
import { apiClient } from '../apiClient';
import { syncAuthHeaders } from '../syncAuth';

const TOKEN_KEY = 'academyhub-session-token-v1';

export type ServerSessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  clubId?: string | null;
  active?: boolean;
};

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export async function serverLogin(email: string, password: string) {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account?kind=session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      token?: string;
      user?: ServerSessionUser;
      branding?: {
        appearanceTheme?: string;
        appName?: string;
        appLogoUrl?: string | null;
      };
    };
    if (!response.ok || !json.ok || !json.token || !json.user) {
      throw new Error(json.error || `Session login HTTP ${response.status}`);
    }
    setSessionToken(json.token);
    if (json.branding) {
      applyPlatformBranding(json.branding);
    }
    return { token: json.token, user: json.user };
  });
}

export async function serverVerifySession() {
  return apiClient(async () => {
    const token = getSessionToken();
    if (!token) throw new Error('No session token');
    const response = await fetch('/api/sync/account?kind=session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; user?: unknown };
    if (!response.ok || !json.ok) {
      setSessionToken(null);
      throw new Error(json.error || 'Invalid session');
    }
    return json.user;
  });
}

export async function requestPasswordReset(email: string) {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account?kind=session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'forgot',
        email,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      }),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      emailed?: boolean;
    };
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Forgot HTTP ${response.status}`);
    }
    return {
      message: json.message ?? 'OK',
      emailed: Boolean(json.emailed),
    };
  });
}

export async function resetPasswordWithToken(resetToken: string, newPassword: string) {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account?kind=session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', resetToken, newPassword }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; email?: string };
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Reset HTTP ${response.status}`);
    }
    return { email: json.email ?? null };
  });
}

export async function uploadClubPhotoBlob(input: {
  clubId: string;
  fileName: string;
  contentType: string;
  dataBase64: string;
}) {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account?kind=media', {
      method: 'POST',
      headers: syncAuthHeaders(),
      body: JSON.stringify(input),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      url?: string;
    };
    if (!response.ok || !json.ok || !json.url) {
      throw new Error(json.error || `Media upload HTTP ${response.status}`);
    }
    return { url: json.url };
  });
}

export async function updateCloudClubLogo(clubId: string, logoUrl: string | null) {
  return apiClient(async () => {
    const response = await fetch('/api/sync/account?kind=club-profile', {
      method: 'PATCH',
      headers: syncAuthHeaders(),
      body: JSON.stringify({ clubId, logoUrl }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; updatedAt?: string };
    if (!response.ok || !json.ok) {
      throw new Error(json.error || `Club profile HTTP ${response.status}`);
    }
    return { updatedAt: json.updatedAt ?? null };
  });
}
