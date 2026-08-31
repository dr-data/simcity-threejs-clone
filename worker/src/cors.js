const PRODUCTION_ORIGIN = 'https://classroom-simcity.pages.dev';

export function isAllowedOrigin(origin, allowed = PRODUCTION_ORIGIN) {
  if (!origin) return false;
  if (allowed === '*') return true;
  if (origin === allowed) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return protocol === 'http:' || protocol === 'https:';
    }
    if (hostname === 'classroom-simcity.pages.dev') return true;
    if (hostname.endsWith('.classroom-simcity.pages.dev')) return true;
  } catch {
    return false;
  }
  return false;
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = env?.ALLOWED_ORIGIN || PRODUCTION_ORIGIN;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  if (isAllowedOrigin(origin, allowed)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
