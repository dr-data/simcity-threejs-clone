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

export function formatRestoreCode(hsuId, token) {
  return `${normalizeHsuId(hsuId)}-${String(token || '').toUpperCase()}`;
}

export function parseRestoreCode(raw) {
  const value = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  const match = value.match(/^(S\d{6,8})-([A-Z0-9]{4})$/);
  if (!match) return null;
  return { hsuId: match[1].toLowerCase(), token: match[2] };
}
