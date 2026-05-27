import { useState, useEffect } from 'react';
import {
  UserCog, Plus, Pencil, Trash2, X, Shield, Key, RefreshCw,
  CheckCircle, XCircle, ChevronRight, Lock, Unlock, Tags,
  Eye, EyeOff, Copy, Check, AlertTriangle, Clock, Monitor,
} from 'lucide-react';
import { api, ALL_PERMISSIONS, type AdminUser } from '../lib/api';
import { ROLE_LABELS, ROLE_COLORS } from '../components/AdminLayout';

interface Props { admin: AdminUser; }

type Tab = 'admins' | 'roles';

const PERMISSION_GROUPS = Array.from(new Set(ALL_PERMISSIONS.map(p => p.group)));

function PermissionToggle({
  permissions, onChange,
}: { permissions: string[]; onChange: (p: string[]) => void }) {
  const toggle = (key: string) => {
    onChange(permissions.includes(key) ? permissions.filter(p => p !== key) : [...permissions, key]);
  };
  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map(group => (
        <div key={group}>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{group}</p>
          <div className="space-y-1.5">
            {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => (
              <label key={perm.key} className="flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => toggle(perm.key)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    permissions.includes(perm.key)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-slate-600 group-hover:border-slate-500'
                  }`}
                >
                  {permissions.includes(perm.key) && <Check size={10} className="text-white" />}
                </button>
                <span className="text-slate-300 text-sm">{perm.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Badge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] || 'bg-slate-500/20 text-slate-300';
  const label = ROLE_LABELS[role] || role;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

// ─── Create / Edit Admin Modal ────────────────────────────────────────────────
function AdminFormModal({
  existing, roles, onClose, onSaved,
}: { existing?: any; roles: any[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    full_name: existing?.full_name || '',
    email: existing?.email || '',
    password: '',
    role: existing?.role || 'support',
    role_id: existing?.role_id || '',
    permissions: existing?.permissions || [] as string[],
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { setError('Nome e email são obrigatórios'); return; }
    if (!isEdit && !form.password) { setError('Senha obrigatória'); return; }
    setLoading(true); setError('');
    const payload: any = {
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      role_id: form.role_id || null,
      permissions: form.permissions,
    };
    if (form.password) payload.password = form.password;
    const res = isEdit
      ? await api.admins.update(existing.id, payload)
      : await api.admins.create(payload);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <UserCog size={16} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold">{isEdit ? 'Editar Administrador' : 'Novo Administrador'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Nome completo</label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                type="email" disabled={isEdit}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">{isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</label>
              <div className="relative">
                <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  type={showPass ? 'text' : 'password'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Cargo base</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="support">Suporte</option>
                <option value="moderator">Moderador</option>
                <option value="financial">Financeiro</option>
                <option value="supervisor">Supervisor</option>
                <option value="verifier">Verificador</option>
                <option value="attendant">Atendente</option>
              </select>
            </div>
            {roles.length > 0 && (
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Cargo personalizado (opcional)</label>
                <select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Nenhum --</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <p className="text-slate-600 text-xs mt-1">Se selecionado, usa as permissões do cargo personalizado</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-300 text-sm font-medium">Permissões individuais</p>
              <p className="text-slate-600 text-xs">Sobrescreve o cargo base</p>
            </div>
            <PermissionToggle permissions={form.permissions} onChange={p => setForm(f => ({ ...f, permissions: p }))} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={15} />}
            {isEdit ? 'Salvar alterações' : 'Criar administrador'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Detail Drawer ──────────────────────────────────────────────────────
function AdminDetailDrawer({
  adminId, onClose, onRefresh, currentAdminId,
}: { adminId: string; onClose: () => void; onRefresh: () => void; currentAdminId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [copied, setCopied] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');

  useEffect(() => {
    api.admins.get(adminId).then(res => { setData(res); setLoading(false); });
  }, [adminId]);

  const action = async (act: string, extraData?: any) => {
    setActionLoading(act);
    const res = await api.admins.update(adminId, { action: act, ...extraData });
    if (res.totp_secret) setTotpSecret(res.totp_secret);
    await api.admins.get(adminId).then(r => setData(r));
    setActionLoading('');
    onRefresh();
  };

  const toggleActive = async () => {
    setActionLoading('toggle');
    await api.admins.update(adminId, { active: !data?.admin?.active });
    await api.admins.get(adminId).then(r => setData(r));
    setActionLoading('');
    onRefresh();
  };

  const deactivate = async () => {
    if (!confirm('Desativar este administrador? Todas as sessões serão encerradas.')) return;
    setActionLoading('deactivate');
    await api.admins.deactivate(adminId);
    onClose(); onRefresh();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold">Detalhes do Administrador</h3>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {data?.admin?.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">{data?.admin?.full_name}</p>
                  <p className="text-slate-400 text-sm">{data?.admin?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge role={data?.admin?.role} />
                    {data?.admin?.active
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Ativo</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Inativo</span>
                    }
                    {data?.admin?.totp_enabled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">2FA</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick info */}
              <div className="bg-slate-800/50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Último login</span>
                  <span className="text-slate-300">{data?.admin?.last_login_at ? fmtDate(data.admin.last_login_at) : 'Nunca'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Último IP</span>
                  <span className="text-slate-300 font-mono text-xs">{data?.admin?.last_login_ip || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cadastrado</span>
                  <span className="text-slate-300">{data?.admin?.created_at ? fmtDate(data.admin.created_at) : '-'}</span>
                </div>
              </div>

              {/* TOTP secret reveal */}
              {totpSecret && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-300 text-xs font-semibold mb-1">Chave 2FA gerada — salve agora!</p>
                  <div className="flex items-center gap-2">
                    <code className="text-blue-200 text-xs font-mono flex-1 break-all">{totpSecret}</code>
                    <button onClick={() => { navigator.clipboard.writeText(totpSecret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="p-1.5 text-blue-400 hover:text-blue-200">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {adminId !== currentAdminId && (
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Ações</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={toggleActive} disabled={!!actionLoading}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 ${
                        data?.admin?.active ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      }`}>
                      {data?.admin?.active ? <Lock size={14} /> : <Unlock size={14} />}
                      {data?.admin?.active ? 'Suspender' : 'Reativar'}
                    </button>
                    <button onClick={() => action('revoke_sessions')} disabled={!!actionLoading}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors disabled:opacity-50">
                      <RefreshCw size={14} className={actionLoading === 'revoke_sessions' ? 'animate-spin' : ''} />
                      Encerrar sessões
                    </button>
                    {data?.admin?.totp_enabled ? (
                      <button onClick={() => action('disable_2fa')} disabled={!!actionLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-300 hover:bg-red-500/20 rounded-xl text-sm transition-colors disabled:opacity-50">
                        <ShieldOff size={14} />
                        Desativar 2FA
                      </button>
                    ) : (
                      <button onClick={() => action('enable_2fa')} disabled={!!actionLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 rounded-xl text-sm transition-colors disabled:opacity-50">
                        <Shield size={14} />
                        Ativar 2FA
                      </button>
                    )}
                    <button onClick={deactivate} disabled={!!actionLoading}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-300 hover:bg-red-500/20 rounded-xl text-sm transition-colors disabled:opacity-50">
                      <Trash2 size={14} />
                      Remover admin
                    </button>
                  </div>
                </div>
              )}

              {/* Active sessions */}
              {data?.sessions && data.sessions.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Sessões recentes</p>
                  <div className="space-y-2">
                    {data.sessions.slice(0, 5).map((s: any) => (
                      <div key={s.id} className="bg-slate-800/50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Monitor size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
                            <p className="text-slate-400 text-xs leading-tight truncate max-w-[180px]">{s.user_agent || 'Desconhecido'}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${new Date(s.expires_at) > new Date() ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>
                            {new Date(s.expires_at) > new Date() ? 'Ativa' : 'Expirada'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-slate-600 text-[10px]">
                          <span className="font-mono">{s.ip_address}</span>
                          <span>·</span>
                          <span>{fmtDate(s.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent logs */}
              {data?.logs && data.logs.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Atividade recente</p>
                  <div className="space-y-1.5">
                    {data.logs.slice(0, 8).map((l: any) => (
                      <div key={l.id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 rounded-lg">
                        <span className="text-slate-400 text-xs font-mono flex-shrink-0">{l.action}</span>
                        <span className="text-slate-600 text-[10px] ml-auto flex-shrink-0">{fmtDate(l.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Needed for AdminDetailDrawer
function ShieldOff({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19.7 14a6.9 6.9 0 0 0 .3-2V5l-8-3-3.2 1.2"/><path d="m2 2 20 20"/><path d="M4.7 4.7 4 5v7c0 6 8 10 8 10a20.3 20.3 0 0 0 5.62-4.38"/></svg>;
}

// ─── Role Form Modal ──────────────────────────────────────────────────────────
function RoleFormModal({
  existing, onClose, onSaved,
}: { existing?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    permissions: (existing?.permissions || []) as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setLoading(true); setError('');
    const res = isEdit
      ? await api.roles.update(existing.id, form)
      : await api.roles.create(form);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <Tags size={16} className="text-teal-400" />
            </div>
            <h3 className="text-white font-semibold">{isEdit ? 'Editar Cargo' : 'Novo Cargo'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Nome do cargo</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              disabled={isEdit}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Descrição</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="border-t border-slate-800 pt-4">
            <p className="text-slate-300 text-sm font-medium mb-3">Permissões do cargo</p>
            <PermissionToggle permissions={form.permissions} onChange={p => setForm(f => ({ ...f, permissions: p }))} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={15} />}
            {isEdit ? 'Salvar' : 'Criar cargo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminsPage({ admin }: Props) {
  const [tab, setTab] = useState<Tab>('admins');
  const [admins, setAdmins] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [detailAdminId, setDetailAdminId] = useState<string | null>(null);

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const loadAll = async () => {
    setLoading(true);
    const [ar, rr] = await Promise.all([api.admins.list(), api.roles.list()]);
    setAdmins(ar.admins || []);
    setRoles(rr.roles || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const deleteRole = async (r: any) => {
    if (!confirm(`Excluir o cargo "${r.name}"? Esta ação é irreversível.`)) return;
    const res = await api.roles.delete(r.id);
    if (res.error) { alert(res.error); return; }
    loadAll();
  };

  if (admin.role !== 'master') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield size={32} className="text-slate-700" />
        <p className="text-slate-500">Apenas o Admin Master pode acessar esta área</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold">Gerenciamento</h2>
          <span className="text-slate-500 text-sm">({tab === 'admins' ? admins.length : roles.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'admins' ? (
            <button onClick={() => { setEditingAdmin(null); setShowAdminForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus size={15} /> Novo administrador
            </button>
          ) : (
            <button onClick={() => { setEditingRole(null); setShowRoleForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus size={15} /> Novo cargo
            </button>
          )}
          <button onClick={loadAll} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['admins', 'roles'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'admins' ? 'Administradores' : 'Cargos'}
          </button>
        ))}
      </div>

      {/* Admins list */}
      {tab === 'admins' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-800/50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800 rounded animate-pulse w-40" />
                    <div className="h-2.5 bg-slate-800 rounded animate-pulse w-56" />
                  </div>
                </div>
              ))}
            </div>
          ) : admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <UserCog size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-500">Nenhum administrador encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {admins.map((a: any) => (
                <div key={a.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-800/20 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${a.id === admin.id ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-slate-700'}`}>
                    {a.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{a.full_name}</span>
                      {a.id === admin.id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Você</span>}
                      <Badge role={a.role} />
                      {!a.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">Inativo</span>}
                      {a.totp_enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">2FA</span>}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="hidden sm:flex flex-col items-end mr-2">
                      <span className="text-slate-600 text-[10px]">Último login</span>
                      <span className="text-slate-500 text-xs">{a.last_login_at ? new Date(a.last_login_at).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                    </div>
                    <button onClick={() => { setEditingAdmin(a); setShowAdminForm(true); }}
                      className="p-2 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDetailAdminId(a.id)}
                      className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roles list */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="h-4 bg-slate-800 rounded animate-pulse w-32" />
                <div className="h-3 bg-slate-800 rounded animate-pulse w-48" />
                <div className="h-8 bg-slate-800 rounded animate-pulse" />
              </div>
            ))
          ) : roles.length === 0 ? (
            <div className="col-span-3 flex flex-col items-center justify-center py-16">
              <Tags size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-500">Nenhum cargo criado</p>
            </div>
          ) : (
            roles.map((r: any) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Key size={13} className="text-teal-400" />
                      </div>
                      <p className="text-white text-sm font-semibold">{r.name}</p>
                    </div>
                    {r.description && <p className="text-slate-500 text-xs mt-1.5">{r.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingRole(r); setShowRoleForm(true); }}
                      className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteRole(r)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {((r.permissions as string[]) || []).slice(0, 5).map((p: string) => {
                    const perm = ALL_PERMISSIONS.find(x => x.key === p);
                    return (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                        {perm?.label || p}
                      </span>
                    );
                  })}
                  {(r.permissions?.length || 0) > 5 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">+{r.permissions.length - 5}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                  <Clock size={11} className="text-slate-600" />
                  <span className="text-slate-600 text-[10px]">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showAdminForm && (
        <AdminFormModal
          existing={editingAdmin}
          roles={roles}
          onClose={() => { setShowAdminForm(false); setEditingAdmin(null); }}
          onSaved={() => { setShowAdminForm(false); setEditingAdmin(null); loadAll(); }}
        />
      )}

      {showRoleForm && (
        <RoleFormModal
          existing={editingRole}
          onClose={() => { setShowRoleForm(false); setEditingRole(null); }}
          onSaved={() => { setShowRoleForm(false); setEditingRole(null); loadAll(); }}
        />
      )}

      {detailAdminId && (
        <AdminDetailDrawer
          adminId={detailAdminId}
          currentAdminId={admin.id}
          onClose={() => setDetailAdminId(null)}
          onRefresh={loadAll}
        />
      )}
    </div>
  );
}
