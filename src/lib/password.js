// Password hashing using Web Crypto API (PBKDF2 with SHA-256)
// Safe for browser environment — no Node.js dependencies

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes.buffer;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return bits;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const derived = await deriveKey(password, salt.buffer);
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt.buffer)}:${bufToHex(derived)}`;
}

export async function verifyPassword(password, hash) {
  if (!hash || !hash.startsWith('pbkdf2:')) return false;
  const parts = hash.split(':');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuf(parts[2]);
  const storedKey = parts[3];

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return bufToHex(derived) === storedKey;
}
