/**
 * Auth utilities using Web Crypto (no external deps — works in Cloudflare Workers).
 * Password hashing: PBKDF2-SHA256 with per-user salt.
 */

const SESSION_COOKIE = 'simcity_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(salt);
}

export async function verifyPassword(password, saltHex, hashHex) {
  const computed = await hashPassword(password, saltHex);
  return computed === hashHex;
}

export function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function signPayload(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function createSessionToken(userId, secret) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}:${expires}`;
  const sig = await signPayload(payload, secret);
  return `${payload}:${sig}`;
}

export async function parseSessionToken(token, secret) {
  if (!token) return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const userId = parseInt(parts[0], 10);
  const expires = parseInt(parts[1], 10);
  const sig = parts[2];
  if (!userId || !expires || !sig) return null;
  if (Date.now() > expires) return null;
  const payload = `${userId}:${expires}`;
  const expected = await signPayload(payload, secret);
  if (sig !== expected) return null;
  return { userId, expires };
}

export function getSessionFromRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function sessionCookieHeader(token, secure = true) {
  const flags = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_MS / 1000}`,
  ];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}

export function clearSessionCookie(secure = true) {
  const flags = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}

export { SESSION_COOKIE };
