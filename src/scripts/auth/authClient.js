/**
 * API client for auth, scores, and leaderboard.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const authClient = {
  signup: (username, password, email) =>
    request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    }),
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/me'),
  resetRequest: (email) =>
    request('/api/auth/reset-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  reset: (token, password) =>
    request('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  submitScore: (stats) =>
    request('/api/scores', { method: 'POST', body: JSON.stringify(stats) }),
  leaderboard: () => request('/api/leaderboard'),
  adminUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/users?${q}`);
  },
  adminUser: (id) => request(`/api/admin/users/${id}`),
  adminUpdateUser: (id, data) =>
    request(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteUser: (id, soft = false) =>
    request(`/api/admin/users/${id}?soft=${soft}`, { method: 'DELETE' }),
  adminResetLeaderboard: () =>
    request('/api/admin/leaderboard/reset', { method: 'POST' }),
  adminHideLeaderboard: (hidden) =>
    request('/api/admin/leaderboard/hide', {
      method: 'POST',
      body: JSON.stringify({ hidden }),
    }),
  adminAuditLog: () => request('/api/admin/audit-log'),
  adminSessions: (userId) =>
    request(`/api/admin/sessions${userId ? `?user_id=${userId}` : ''}`),
  adminDeleteSession: (id) =>
    request(`/api/admin/sessions/${id}`, { method: 'DELETE' }),
};

export function getApiBase() {
  return API_BASE;
}
