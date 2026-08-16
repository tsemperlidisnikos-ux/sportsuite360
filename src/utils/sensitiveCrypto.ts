/**
 * Field-level AES-256-GCM for sensitive student data before cloud mirror sync.
 * Reuses the same key derivation family as AMKA (club-scoped).
 */
import {
  decryptAmka,
  encryptAmka,
  isAmkaEncrypted,
} from './amkaCrypto';

export const SENSITIVE_ENC_PREFIX = 'enc:pii:v1:';

const SENSITIVE_FIELDS = [
  'amka',
  'doctorName',
  'doctorPhone',
  'bloodType',
  'allergies',
  'chronicConditions',
  'medication',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelation',
  'emergencyAltPhone',
] as const;

type SensitiveStudent = Partial<Record<(typeof SENSITIVE_FIELDS)[number], string>> & {
  amka?: string;
};

function isPiiEncrypted(value: string | undefined | null): boolean {
  return Boolean(
    value && (value.startsWith(SENSITIVE_ENC_PREFIX) || value.startsWith('enc:amka:v1:')),
  );
}

async function encryptField(plain: string, clubId: string): Promise<string> {
  const trimmed = plain.trim();
  if (!trimmed || isPiiEncrypted(trimmed)) return trimmed;
  const cipher = await encryptAmka(trimmed, clubId);
  return cipher.replace(/^enc:amka:v1:/, SENSITIVE_ENC_PREFIX);
}

async function decryptField(value: string, clubId: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(SENSITIVE_ENC_PREFIX)) {
    return decryptAmka(trimmed.replace(SENSITIVE_ENC_PREFIX, 'enc:amka:v1:'), clubId);
  }
  if (isAmkaEncrypted(trimmed)) return decryptAmka(trimmed, clubId);
  return trimmed;
}

/** Deep-clone AppData-like payload and encrypt sensitive student fields for cloud. */
export async function encryptSensitivePayloadForCloud<T extends { students?: SensitiveStudent[] }>(
  payload: T,
  clubId: string,
): Promise<T> {
  const clone = structuredClone(payload);
  if (!Array.isArray(clone.students)) return clone;
  for (const student of clone.students) {
    for (const field of SENSITIVE_FIELDS) {
      const value = student[field];
      if (!value?.trim() || isPiiEncrypted(value)) continue;
      student[field] = await encryptField(value, clubId);
    }
  }
  return clone;
}

export async function decryptSensitivePayloadFromCloud<T extends { students?: SensitiveStudent[] }>(
  payload: T,
  clubId: string,
): Promise<T> {
  const clone = structuredClone(payload);
  if (!Array.isArray(clone.students)) return clone;
  for (const student of clone.students) {
    for (const field of SENSITIVE_FIELDS) {
      const value = student[field];
      if (!value?.trim() || !isPiiEncrypted(value)) continue;
      try {
        student[field] = await decryptField(value, clubId);
      } catch {
        /* keep ciphertext if decrypt fails */
      }
    }
  }
  return clone;
}
