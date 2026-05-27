import { useState, useEffect } from 'react';
import {
  Shield, Bell, Database, Percent, Save, CheckCircle,
  Monitor, Clock, X, RefreshCw, LogOut, AlertTriangle, Key,
} from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

export default function SettingsPage({ admin }: Props) {
  const [saved, setSaved] = useState(false);
  const [platformFee, setPlatformFee] = useState('15');
  const [minWithdrawal, setMinWithdrawal] = useState('50');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const isMaster = admin.role === 'master';

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const loadSessions = async () => {
    if (!isMaster) return;
    setSessionsLoading(true);
    const res = await api.sessions.list();
    setSessions(res.sessions || []);
    setSessionsLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  const revokeSession = async (id: string) => {
    await api.sessions.revoke(id);
    loadSessions();
  };

  const revokeAll = async () => {
    if (!confirm('Encerrar TODAS as sessões ativas? Todos os admins precisarão fazer login novamente.')) return;
    await Promise.all(sessions.map(s => api.sessions.revoke(s.id)));
    loadSessions();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  function parseDevice(ua: string | null): string {
    if (!ua) return 'Desconhecido';
    if (/Mobile/i.test(ua)) return 'Mobile';
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)[\/\s][\d.]+/)?.[1];
    return browser || 'Desktop';
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-white font-bold">Configurações</h2>

      {/* Financial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <Percent size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Configurações Financeiras</p>
            <p className="text-slate-500 text-xs">Taxas e limites da plataforma</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Taxa da Plataforma (%)</label>
            <input type="number" value={platformFee} onChange={e => setPlatformFee(e.target.value)}
              disabled={!isMaster}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            <p className="text-slate-600 text-xs mt-1">Percentual cobrado sobre cada pagamento</p>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Saque Mínimo (R$)</label>
            <input type="number" value={minWithdrawal} onChange={e => setMinWithdrawal(e.target.value)}
              disabled={!isMaster}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            <p className="text-slate-600 text-xs mt-1">Valor mínimo para solicitar saque</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <Bell size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Notificações</p>
            <p className="text-slate-500 text-xs">Alertas e comunicações do sistema</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm">Notificações do sistema</p>
              <p className="text-slate-500 text-xs">Alertas internos para admins</p>
            </div>
            <button onClick={() => setNotificationsEnabled(v => !v)} disabled={!isMaster}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* System */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-500/10 rounded-lg flex items-center justify-center">
            <Database size={16} className="text-slate-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Sistema</p>
            <p className="text-slate-500 text-xs">Controles gerais da plataforma</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm">Modo de manutenção</p>
              <p className="text-slate-500 text-xs">Bloqueia acesso de novos usuários</p>
            </div>
            <button onClick={() => setMaintenanceMode(v => !v)} disabled={!isMaster}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${maintenanceMode ? 'bg-red-600' : 'bg-slate-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {maintenanceMode && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              Modo de manutenção ativo. Novos usuários não poderão acessar a plataforma.
            </div>
          )}
        </div>
      </div>

      {/* Security info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Segurança</p>
            <p className="text-slate-500 text-xs">Informações de acesso e autenticação</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Sessão expira em</span>
            <span className="text-slate-200 flex items-center gap-1.5"><Clock size={13} className="text-slate-500" /> 8 horas</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">2FA TOTP</span>
            <span className="text-emerald-400 flex items-center gap-1.5"><Key size={13} /> Habilitado</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Seu perfil</span>
            <span className="text-slate-200">{admin.full_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Função</span>
            <span className="text-slate-200 capitalize">{admin.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Email</span>
            <span className="text-slate-200 text-xs">{admin.email}</span>
          </div>
        </div>
      </div>

      {/* Active sessions (master only) */}
      {isMaster && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center">
                <Monitor size={16} className="text-rose-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Sessões Ativas</p>
                <p className="text-slate-500 text-xs">Administradores conectados agora</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadSessions} className="p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
                <RefreshCw size={14} className={sessionsLoading ? 'animate-spin' : ''} />
              </button>
              {sessions.length > 1 && (
                <button onClick={revokeAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-xs transition-colors">
                  <LogOut size={12} /> Encerrar todas
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-800/50">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Monitor size={24} className="text-slate-700 mb-2" />
                <p className="text-slate-600 text-sm">Nenhuma sessão ativa</p>
              </div>
            ) : (
              sessions.map((s: any) => (
                <div key={s.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 text-xs font-bold flex-shrink-0">
                    {s.admin_users?.full_name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-200 text-sm font-medium">{s.admin_users?.full_name || 'Admin'}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Ativa</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-slate-600 text-[10px]">
                      <span className="font-mono">{s.ip_address || '-'}</span>
                      <span>·</span>
                      <span>{parseDevice(s.user_agent)}</span>
                      <span>·</span>
                      <span>{fmtDate(s.created_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => revokeSession(s.id)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800 flex-shrink-0"
                    title="Encerrar sessão">
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isMaster && (
        <div className="flex justify-end">
          <button onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {!isMaster && (
        <p className="text-slate-600 text-xs text-center">Apenas o Admin Master pode alterar as configurações</p>
      )}
    </div>
  );
}
