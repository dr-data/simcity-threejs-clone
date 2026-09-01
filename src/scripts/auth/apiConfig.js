export const DEFAULT_API_URL = 'https://classroom-simcity-api.shorlol.workers.dev';

export function resolveApiBase(raw) {
  const value = String(raw || '').trim();
  if (!value || value.includes('YOUR_SUBDOMAIN')) {
    return DEFAULT_API_URL;
  }
  return value.replace(/\/$/, '');
}
