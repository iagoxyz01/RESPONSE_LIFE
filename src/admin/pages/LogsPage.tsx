import { useState, useEffect, useCallback } from 'react';
import { Activity, ChevronLeft, ChevronRight, Search, Filter, X, Monitor, MapPin } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const ACTION_COLORS: Record<string, string> = {
  login:                  'bg-blue-500/20 text-blue-300',
  approve_caregiver:      'bg-emerald-500/20 text-emerald-300',
  reject_caregiver:       'bg-red-500/20 text-red-300',
  suspend_caregiver:      'bg-amber-500/20 text-amber-300',
  approve_identity:       'bg-emerald-500/20 text-emerald-300',
  reject_identity:        'bg-red-500/20 text-red-300',
  analyze_identity:       'bg-cyan-500/20 text-cyan-300',
  ban_user:               'bg-red-500/20 text-red-300',
  suspend_user:           'bg-amber-500/20 text-amber-300',
  edit_user:              'bg-slate-500/20 text-slate-300',
  approve_withdrawal:     'bg-emerald-500/20 text-emerald-300',
  reject_withdrawal:      'bg-red-500/20 text-red-300',
  update_ticket:          'bg-blue-500/20 text-blue-300',
  create_admin:           'bg-teal-500/20 text-teal-300',
  update_admin:           'bg-slate-500/20 text-slate-300',
  deactivate_admin:       'bg-red-500/20 text-red-300',
  enable_2fa:             'bg-emerald-500/20 text-emerald-300',
  disable_2fa:            'bg-amber-500/20 text-amber-300',
  revoke_sessions:        'bg-amber-500/20 text-amber-300',
  create_role:            'bg-teal-500/20 text-teal-300',
  update_role:            'bg-slate-500/20 text-slate-300',
  delete_role:            'bg-red-500/20 text-red-300',
};

const ACTION_LABELS: Record<string, string> = {
  login:                  'Login',
  approve_caregiver:      'Aprovou cuidador',
  reject_caregiver:       'Rejeitou cuidador',
  suspend_caregiver:      'Suspendeu cuidador',
  approve_identity:       'Aprovou identidade',
  reject_identity:        'Rejeitou identidade',
  analyze_identity:       'Analisando identidade',
  ban_user:               'Baniu usuário',
  suspend_user:           'Suspendeu usuário',
  edit_user:              'Editou usuário',
  approve_withdrawal:     'Aprovou saque',
  reject_withdrawal:      'Rejeitou saque',
  update_ticket:          'Atualizou ticket',
  create_admin:           'Criou admin',
  update_admin:           'Editou admin',
  deactivate_admin:       'Desativou admin',
  enable_2fa:             'Ativou 2FA',
  disable_2fa:            'Desativou 2FA',
  revoke_sessions:        'Encerrou sessões',
  create_role:            'Criou cargo',
  update_role:            'Editou cargo',
  delete_role:            'Excluiu cargo',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function parseDevice(ua: string | null): string {
  if (!ua) return 'Desconhecido';
  if (/Mobile/i.test(ua)) return 'Mobile';
  if (/Tablet/i.test(ua)) return 'Tablet';
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)[\/\s][\d.]+/)?.[1];
  return browser || 'Desktop';
}

export default function LogsPage({ admin }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async (p = 1, s = search, a = filterAction) => {
    setLoading(true);
    const res = await api.logs.list(p, { search: s, action: a });
    if (!res.error) { setLogs(res.logs || []); setTotal(res.total || 0); }
    setLoading(false);
  }, [search, filterAction]);

  useEffect(() => { load(1); }, []);

  const applyFilters = () => { setPage(1); load(1, search, filterAction); setShowFilters(false); };
  const clearFilters = () => { setSearch(''); setFilterAction(''); setPage(1); load(1, '', ''); };

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const perPage = 50;
  const totalPages = Math.ceil(total / perPage);
  const hasFilters = !!search || !!filterAction;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold">Logs do Sistema</h2>
          <span className="text-slate-500 text-sm">({total})</span>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-sm transition-colors">
              <X size={13} /> Limpar filtros
            </button>
          )}
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${showFilters || hasFilters ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
            <Filter size={14} /> Filtros {hasFilters && '•'}
          </button>
          <button onClick={() => load(page)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors">
            <Activity size={15} className={loading ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 text-xs mb-1.5">Buscar por email do admin</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyFilters()}
                  placeholder="admin@exemplo.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-slate-500 text-xs mb-1.5">Tipo de ação</label>
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas as ações</option>
                {ALL_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
              Aplicar filtros
            </button>
          </div>
        </div>
      )}

      {/* Logs table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="divide-y divide-slate-800/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-800 rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-800 rounded animate-pulse w-48" />
                  <div className="h-2.5 bg-slate-800 rounded animate-pulse w-32" />
                </div>
                <div className="h-3 bg-slate-800 rounded animate-pulse w-24" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Activity size={32} className="text-slate-700 mb-3" />
            <p className="text-slate-500">Nenhum log encontrado</p>
            {hasFilters && <p className="text-slate-600 text-xs mt-1">Tente limpar os filtros</p>}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {logs.map((log: any) => (
              <div key={log.id} className="px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 text-xs font-bold flex-shrink-0 mt-0.5">
                    {log.admin_users?.full_name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-200 text-sm font-medium">{log.admin_users?.full_name || log.admin_email || 'Admin'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-slate-700 text-slate-400'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.target_type && (
                        <span className="text-slate-600 text-xs">
                          {log.target_id && <span className="font-mono text-[10px]">#{log.target_id.slice(0, 8)}</span>}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-slate-500 text-xs mt-0.5 truncate">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {log.ip_address && (
                        <div className="flex items-center gap-1 text-slate-600 text-[10px]">
                          <MapPin size={9} />
                          <span className="font-mono">{log.ip_address}</span>
                        </div>
                      )}
                      {log.user_agent && (
                        <div className="flex items-center gap-1 text-slate-600 text-[10px]">
                          <Monitor size={9} />
                          <span>{parseDevice(log.user_agent)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-600 text-xs flex-shrink-0 mt-0.5 text-right">{fmtDate(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800">
            <p className="text-slate-500 text-xs">Página {page} de {totalPages} · {total} registros</p>
            <div className="flex gap-2">
              <button onClick={() => { const p = page - 1; setPage(p); load(p); }} disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => { const p = page + 1; setPage(p); load(p); }} disabled={page >= totalPages}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
