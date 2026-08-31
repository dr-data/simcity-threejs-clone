/**
 * API client for auth, scores, and leaderboard.
 */
import { resolveApiBase } from './apiConfig.js';

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

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
  claim: (hsuId, lock, boardCode) =>
    request('/api/auth/claim', {
      method: 'POST',
      body: JSON.stringify({ username: hsuId, password: lock, boardCode }),
    }),
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/me'),
  submitScore: (stats) =>
    request('/api/scores', { method: 'POST', body: JSON.stringify(stats) }),
  liveScore: (stats) =>
    request('/api/scores/live', { method: 'POST', body: JSON.stringify(stats) }),
  leaderboard: () => request('/api/leaderboard'),
  saveCityCode: (file) =>
    request('/api/city-codes', { method: 'POST', body: JSON.stringify({ file }) }),
  loadCityCode: (code) => request(`/api/city-codes/${encodeURIComponent(code)}`),
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
  adminGetClassCode: () => request('/api/admin/class-code'),
  adminSetClassCode: (code) =>
    request('/api/admin/class-code', { method: 'POST', body: JSON.stringify({ code }) }),
  adminResetLock: (id, lock) =>
    request(`/api/admin/users/${id}/reset-lock`, {
      method: 'POST',
      body: JSON.stringify(lock ? { lock } : {}),
    }),
  adminAuditLog: () => request('/api/admin/audit-log'),
  adminSessions: (userId) =>
    request(`/api/admin/sessions${userId ? `?user_id=${userId}` : ''}`),
  adminDeleteSession: (id) =>
    request(`/api/admin/sessions/${id}`, { method: 'DELETE' }),
  disasterLog: () => request('/api/disaster-log'),
  aiTip: (stats) =>
    request('/api/ai/tip', { method: 'POST', body: JSON.stringify(stats) }),
  aiSessionReview: (stats) =>
    request('/api/ai/session-review', { method: 'POST', body: JSON.stringify(stats) }),
};

export function getApiBase() {
  return API_BASE;
}
