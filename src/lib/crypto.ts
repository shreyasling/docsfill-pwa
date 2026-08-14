// Client-side end-to-end encryption for profile data.
//
// All profile PII is encrypted in the browser (AES-GCM 256) before it ever
// reaches Supabase, and decrypted only after it's fetched back. The passphrase
// and the derived key NEVER leave the device — the database only ever stores
// ciphertext. The derived key is cached in sessionStorage (per tab session,
// per user) so the user unlocks once per session, not on every navigation.

const PBKDF2_ITERS = 150_000;
const IV_BYTES = 12;
const SALT_BYTES = 16;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** WebCrypto's SubtleCrypto is only available in a secure context (HTTPS or
 *  localhost). Over a plain LAN IP it's undefined — detect that up front so the
 *  UI can explain it instead of failing with a cryptic error. */
export function isCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    (typeof window === 'undefined' || window.isSecureContext !== false)
  );
}

function bufToB64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Copies any Uint8Array into a fresh ArrayBuffer-backed view so it satisfies
 *  WebCrypto's strict `BufferSource` typing (never a SharedArrayBuffer). */
function asBuf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(u.length);
  out.set(u);
  return out;
}

/** A fresh random PBKDF2 salt, base64-encoded, created once per vault. */
export function newSaltB64(): string {
  return bufToB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer);
}

/** Derives an AES-GCM key from a passphrase + salt. Extractable so it can be
 *  cached (raw) in sessionStorage for the session. */
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    asBuf(textEncoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts a JS value to a base64 string of `iv || ciphertext`. */
export async function encryptJSON(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = asBuf(textEncoder.encode(JSON.stringify(value)));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return bufToB64(combined.buffer);
}

/** Decrypts a base64 `iv || ciphertext` blob back to a JS value. Throws on a
 *  wrong key (used to validate the passphrase on unlock). */
export async function decryptJSON<T>(key: CryptoKey, blobB64: string): Promise<T> {
  const combined = b64ToBytes(blobB64);
  const iv = combined.slice(0, IV_BYTES);
  const ct = combined.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(textDecoder.decode(pt)) as T;
}

// ---- Session key cache (in-memory + sessionStorage, never localStorage) ----

let memoryKey: CryptoKey | null = null;
let memoryKeyUser: string | null = null;

const storageKey = (userId: string) => `docfill.vk.${userId}`;

export function getVaultKey(): CryptoKey | null {
  return memoryKey;
}

export async function cacheVaultKey(userId: string, key: CryptoKey): Promise<void> {
  memoryKey = key;
  memoryKeyUser = userId;
  const raw = await crypto.subtle.exportKey('raw', key);
  try {
    sessionStorage.setItem(storageKey(userId), bufToB64(raw));
  } catch {
    /* private mode / storage full — key stays in memory only */
  }
}

/** Restores a cached key for this session (e.g. after a page reload). */
export async function restoreVaultKey(userId: string): Promise<CryptoKey | null> {
  if (memoryKey && memoryKeyUser === userId) return memoryKey;
  const raw = sessionStorage.getItem(storageKey(userId));
  if (!raw) return null;
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBytes(raw), 'AES-GCM', true, [
      'encrypt',
      'decrypt',
    ]);
    memoryKey = key;
    memoryKeyUser = userId;
    return key;
  } catch {
    return null;
  }
}

export function clearVaultKey(userId?: string): void {
  memoryKey = null;
  memoryKeyUser = null;
  try {
    if (userId) sessionStorage.removeItem(storageKey(userId));
    else {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('docfill.vk.')) sessionStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}
