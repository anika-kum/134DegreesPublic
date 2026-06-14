// Central API client. All requests flow through `request()`, which attaches
// the JWT Bearer token from AsyncStorage and throws on non-2xx responses.
// BASE falls back to localhost so backend unit tests work without a .env file.

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

// Clears stored credentials — called automatically on 401 so a stale JWT
// (e.g. after the dev DB is wiped) never leaves the app stuck in a broken state.
async function clearSession() {
  await AsyncStorage.multiRemove(['token', 'user']);
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (res.status === 401) {
    await clearSession();
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth — register returns a token; login returns the same shape
  register: (body: object) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  updateProfile: (body: object) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  // Projects — all query params are optional; undefined values are stripped from the query string
  getProjects: (params?: { district?: number; status?: string; type?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) : '';
    return request(`/projects${qs}`);
  },
  getProject: (id: number) => request(`/projects/${id}`),
  // advocate POST increments coalition_count + logs the advocacy action in DB
  advocate: (id: number, body: object) => request(`/projects/${id}/advocate`, { method: 'POST', body: JSON.stringify(body) }),
  subscribe: (id: number) => request(`/projects/${id}/subscribe`, { method: 'POST' }),
  unsubscribe: (id: number) => request(`/projects/${id}/subscribe`, { method: 'DELETE' }),
  getSubscriptions: () => request('/projects/user/subscriptions'),

  // Advocacy — generate calls Claude; history returns the last 50 logged actions
  generateContent: (body: object) => request('/advocacy/generate', { method: 'POST', body: JSON.stringify(body) }),
  getHistory: () => request('/advocacy/history'),

  // Resources — filter by type or district; citywide resources (district=null) always included
  getResources: (params?: { type?: string; district?: number }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) : '';
    return request(`/resources${qs}`);
  },

  // Stats: dashboard aggregate counts. Reps: all government levels for a district
  getStats: () => request('/stats'),
  getReps: (district: number) => request(`/reps/${district}`),

  // Bills: LegiScan-scraped housing legislation, optionally filtered by level or state
  getBills: (params?: { level?: string; state?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as string[][]) : '';
    return request(`/bills${qs}`);
  },
  getBill: (id: number) => request(`/bills/${id}`),

  // Last updated timestamp for the nightly data refresh footnote
  getLastUpdated: () => request('/last-updated'),
};
