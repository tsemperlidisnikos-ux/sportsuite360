import { getSessionToken } from './services/sessionService';

/**
 * Headers for durable sync APIs (/api/sync/*).
 * Sends sync key and/or server session bearer token.
 */
export function syncAuthHeaders(jsonBody = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (jsonBody) headers['Content-Type'] = 'application/json';
  const key = String(import.meta.env.VITE_SS360_SYNC_SECRET ?? '').trim();
  if (key) headers['x-ss360-sync-key'] = key;
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function isSyncClientKeyConfigured(): boolean {
  return Boolean(String(import.meta.env.VITE_SS360_SYNC_SECRET ?? '').trim());
}
