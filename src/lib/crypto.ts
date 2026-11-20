/**
 * Optional password-protected backups.
 *
 * The envelope keeps only the KDF and cipher parameters in the clear; the app
 * state itself is AES-GCM encrypted with a PBKDF2-SHA256 key. Encryption and
 * decryption run in the Rust core, which is byte-compatible with envelopes
 * written by earlier versions of the app (including the Android WebView).
 */
import { core, coreReady } from './rust';

export const ENCRYPTED_FORMAT = 'sekeping-encrypted';

export interface EncryptedEnvelope {
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  createdAt: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  payload: string;
}

export function isEncryptedExport(text: string): boolean {
  if (coreReady()) return core().is_encrypted_backup(text);
  // Startup can probe a stored backup before the core finishes loading.
  try {
    const parsed = JSON.parse(text) as Partial<EncryptedEnvelope>;
    return parsed?.format === ENCRYPTED_FORMAT && typeof parsed.payload === 'string';
  } catch {
    return false;
  }
}

/** Encrypt any JSON-serializable value and return the envelope JSON. */
export async function encryptJson(data: unknown, password: string): Promise<string> {
  return core().encrypt_backup(JSON.stringify(data), password);
}

/** Decrypt an envelope and parse the JSON it contains. */
export async function decryptJson(text: string, password: string): Promise<unknown> {
  return JSON.parse(core().decrypt_backup(text, password)) as unknown;
}
