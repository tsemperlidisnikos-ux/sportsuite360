/** AES-256-GCM for AMKA at rest (Web Crypto). Prefix marks ciphertext. */

export const AMKA_ENC_PREFIX = 'enc:amka:v1:';

const APP_SALT = 'SportSuite360-AMKA-AES256-v1';
const PBKDF2_ITERATIONS = 100_000;

const keyCache = new Map<string, CryptoKey>();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isAmkaEncrypted(value: string | undefined | null): boolean {
  return Boolean(value && value.startsWith(AMKA_ENC_PREFIX));
}

async function deriveKey(clubId: string): Promise<CryptoKey> {
  const cached = keyCache.get(clubId);
  if (cached) return cached;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${APP_SALT}|${clubId}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const salt = new TextEncoder().encode(APP_SALT);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  keyCache.set(clubId, key);
  return key;
}

export async function encryptAmka(plain: string, clubId: string): Promise<string> {
  const trimmed = plain.trim();
  if (!trimmed) return '';
  if (isAmkaEncrypted(trimmed)) return trimmed;

  const key = await deriveKey(clubId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(trimmed),
  );
  const cipher = new Uint8Array(cipherBuf);
  return `${AMKA_ENC_PREFIX}${toBase64(iv)}.${toBase64(cipher)}`;
}

export async function decryptAmka(value: string, clubId: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!isAmkaEncrypted(trimmed)) return trimmed;

  const payload = trimmed.slice(AMKA_ENC_PREFIX.length);
  const [ivB64, cipherB64] = payload.split('.');
  if (!ivB64 || !cipherB64) return '';

  const key = await deriveKey(clubId);
  const ivBytes = fromBase64(ivB64);
  const cipherBytes = fromBase64(cipherB64);
  const iv = ivBytes.buffer.slice(
    ivBytes.byteOffset,
    ivBytes.byteOffset + ivBytes.byteLength,
  ) as ArrayBuffer;
  const cipher = cipherBytes.buffer.slice(
    cipherBytes.byteOffset,
    cipherBytes.byteOffset + cipherBytes.byteLength,
  ) as ArrayBuffer;
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher,
  );
  return new TextDecoder().decode(plainBuf);
}

export async function encryptStudentAmkaFields(
  students: Array<{ amka?: string }>,
  clubId: string,
): Promise<boolean> {
  let changed = false;
  for (const student of students) {
    const amka = student.amka?.trim();
    if (!amka || isAmkaEncrypted(amka)) continue;
    student.amka = await encryptAmka(amka, clubId);
    changed = true;
  }
  return changed;
}

export async function decryptStudentAmkaFields(
  students: Array<{ amka?: string }>,
  clubId: string,
): Promise<boolean> {
  let changed = false;
  for (const student of students) {
    const amka = student.amka?.trim();
    if (!amka || !isAmkaEncrypted(amka)) continue;
    try {
      student.amka = await decryptAmka(amka, clubId);
      changed = true;
    } catch {
      /* keep ciphertext if key/context mismatch */
    }
  }
  return changed;
}
