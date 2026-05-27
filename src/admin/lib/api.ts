const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`;

export function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

export function setToken(token: string): void {
  localStorage.setItem('admin_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

export function getAdmin(): AdminUser | null {
  const s = localStorage.getItem('admin_user');
  return s ? JSON.parse(s) : null;
}

export function setAdmin(admin: AdminUser): void {
  localStorage.setItem('admin_user', JSON.stringify(admin));
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'master' | 'moderator' | 'financial' | 'support';
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(`${BASE}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Token': token } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (res.status === 401) { clearToken(); window.location.href = '/admin'; }
  return data;
}

export const api = {
  login: (email: string, password: string, totp_token?: string) =>
    request('auth', { method: 'POST', body: JSON.stringify({ email, password, totp_token }) }),

  me: () => request('me'),

  dashboard: () => request('dashboard'),

  users: {
    list: (page = 1, search = '') => request(`users?page=${page}&search=${encodeURIComponent(search)}`),
    get: (id: string) => request(`users/${id}`),
    update: (id: string, data: any) => request(`users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    ban: (id: string) => request(`users/${id}`, { method: 'DELETE' }),
  },

  caregivers: {
    list: (page = 1) => request(`caregivers?page=${page}`),
    get: (id: string) => request(`caregivers/${id}`),
    action: (id: string, action: string, data?: any) =>
      request(`caregivers/${id}`, { method: 'PUT', body: JSON.stringify({ action, ...data }) }),
  },

  requests: {
    list: (page = 1, status = '') => request(`requests?page=${page}&status=${status}`),
    get: (id: string) => request(`requests/${id}`),
  },

  financial: {
    overview: () => request('financial/overview'),
    withdrawal: (id: string, action: 'approve' | 'reject') =>
      request(`financial/withdrawals/${id}`, { method: 'PUT', body: JSON.stringify({ action }) }),
  },

  identity: {
    list: (status = 'pending') => request(`identity?status=${status}`),
    action: (id: string, action: string, reason?: string) =>
      request(`identity/${id}`, { method: 'PUT', body: JSON.stringify({ action, reason }) }),
  },

  logs: {
    list: (page = 1) => request(`logs?page=${page}`),
  },

  support: {
    list: (status = 'open') => request(`support?status=${status}`),
    update: (id: string, status: string) =>
      request(`support/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  },
};
