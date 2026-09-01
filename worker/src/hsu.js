export function normalizeHsuId(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function isHsuId(raw) {
  return /^s\d{6,8}$/.test(normalizeHsuId(raw));
}

export function isLoginId(raw) {
  const id = normalizeHsuId(raw);
  return id === 'admin' || isHsuId(id);
}

export function parseRestoreCode(raw) {
  const value = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  const match = value.match(/^(S\d{6,8})-([A-Z0-9]{4})$/);
  if (!match) return null;
  return { hsuId: match[1].toLowerCase(), token: match[2] };
}

export function randomRestoreToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
