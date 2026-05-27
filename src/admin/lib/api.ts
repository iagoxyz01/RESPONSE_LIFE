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
  role: 'master' | 'moderator' | 'financial' | 'support' | string;
  permissions?: string[];
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
  if (res.status === 401) { clearToken(); }
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
    list: (page = 1, params?: { status?: string; search?: string; date_from?: string; date_to?: string; payment_method?: string }) => {
      const q = new URLSearchParams({ page: String(page) });
      if (params?.status) q.set('status', params.status);
      if (params?.search) q.set('search', params.search);
      if (params?.date_from) q.set('date_from', params.date_from);
      if (params?.date_to) q.set('date_to', params.date_to);
      if (params?.payment_method) q.set('payment_method', params.payment_method);
      return request(`requests?${q}`);
    },
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
    list: (page = 1, params?: { search?: string; action?: string; admin_id?: string }) => {
      const q = new URLSearchParams({ page: String(page) });
      if (params?.search) q.set('search', params.search);
      if (params?.action) q.set('action', params.action);
      if (params?.admin_id) q.set('admin_id', params.admin_id);
      return request(`logs?${q}`);
    },
  },

  support: {
    list: (status = 'open') => request(`support?status=${status}`),
    update: (id: string, status: string) =>
      request(`support/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  },

  admins: {
    list: () => request('admins'),
    get: (id: string) => request(`admins/${id}`),
    create: (data: { email: string; full_name: string; password: string; role?: string; role_id?: string; permissions?: string[] }) =>
      request('admins', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`admins/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deactivate: (id: string) => request(`admins/${id}`, { method: 'DELETE' }),
  },

  roles: {
    list: () => request('roles'),
    get: (id: string) => request(`roles/${id}`),
    create: (data: { name: string; description?: string; permissions: string[] }) =>
      request('roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`roles/${id}`, { method: 'DELETE' }),
  },

  sessions: {
    list: () => request('sessions'),
    revoke: (id: string) => request(`sessions/${id}`, { method: 'DELETE' }),
  },
};

export const ALL_PERMISSIONS = [
  { key: 'view_users',         label: 'Ver usuários',          group: 'Usuários' },
  { key: 'ban_users',          label: 'Banir usuários',         group: 'Usuários' },
  { key: 'approve_caregivers', label: 'Aprovar cuidadores',     group: 'Cuidadores' },
  { key: 'approve_documents',  label: 'Aprovar documentos',     group: 'Identidade' },
  { key: 'view_requests',      label: 'Ver atendimentos',       group: 'Atendimentos' },
  { key: 'view_financial',     label: 'Ver financeiro',         group: 'Financeiro' },
  { key: 'approve_withdrawals',label: 'Aprovar saques',         group: 'Financeiro' },
  { key: 'view_support',       label: 'Ver suporte',            group: 'Suporte' },
  { key: 'view_logs',          label: 'Ver logs',               group: 'Logs' },
  { key: 'edit_settings',      label: 'Editar configurações',   group: 'Sistema' },
  { key: 'create_admins',      label: 'Criar administradores',  group: 'Sistema' },
] as const;

export type Permission = typeof ALL_PERMISSIONS[number]['key'];
