/**
 * Optional password-protected backups.
 *
 * The envelope keeps only the KDF and cipher parameters in the clear; the app
 * state itself is AES-GCM encrypted with a PBKDF2-SHA256 key. WebCrypto is
 * available in every browser Sekeping supports (and in the Android WebView).
 */

export const ENCRYPTED_FORMAT = 'sekeping-encrypted';
const ITERATIONS = 310_000;

export interface EncryptedEnvelope {
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  createdAt: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  payload: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedExport(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as Partial<EncryptedEnvelope>;
    return parsed?.format === ENCRYPTED_FORMAT && typeof parsed.payload === 'string';
  } catch {
    return false;
  }
}

export async function encryptJson(data: unknown, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const envelope: EncryptedEnvelope = {
    format: ENCRYPTED_FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    payload: toBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptJson(text: string, password: string): Promise<unknown> {
  const envelope = JSON.parse(text) as Partial<EncryptedEnvelope>;
  if (envelope?.format !== ENCRYPTED_FORMAT || !envelope.payload || !envelope.kdf || !envelope.cipher) {
    throw new Error('format');
  }
  const salt = fromBase64(envelope.kdf.salt);
  const iterations = Number(envelope.kdf.iterations) || ITERATIONS;
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = fromBase64(envelope.payload);
  const iv = fromBase64(envelope.cipher.iv);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
