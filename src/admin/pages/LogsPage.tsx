import { useState, useEffect } from 'react';
import { Activity, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-500/20 text-blue-300',
  approve: 'bg-emerald-500/20 text-emerald-300',
  reject: 'bg-red-500/20 text-red-300',
  suspend: 'bg-amber-500/20 text-amber-300',
  ban: 'bg-red-500/20 text-red-300',
  analyze: 'bg-cyan-500/20 text-cyan-300',
  view: 'bg-slate-500/20 text-slate-300',
};

const ENTITY_LABELS: Record<string, string> = {
  users: 'Usuários',
  caregivers: 'Cuidadores',
  identity: 'Identidade',
  financial: 'Financeiro',
  support: 'Suporte',
  settings: 'Configurações',
};

export default function LogsPage({ admin: _admin }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (p = page) => {
    setLoading(true);
    const res = await api.logs.list(p);
    if (!res.error) { setLogs(res.logs || []); setTotal(res.total || 0); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const perPage = 50;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold">Logs do Sistema</h2>
          <span className="text-slate-500 text-sm">({total})</span>
        </div>
        <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
          <Filter size={14} /> Atualizar
        </button>
      </div>

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
            <p className="text-slate-500">Nenhum log registrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {logs.map((log: any) => (
              <div key={log.id} className="px-5 py-3.5 flex items-start gap-4 hover:bg-slate-800/20 transition-colors">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 text-xs font-bold flex-shrink-0 mt-0.5 overflow-hidden">
                  {log.admin_users?.avatar_url
                    ? <img src={log.admin_users.avatar_url} alt="" className="w-full h-full object-cover" />
                    : log.admin_users?.full_name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-200 text-sm font-medium">{log.admin_users?.full_name || 'Admin'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-slate-700 text-slate-400'}`}>
                      {log.action}
                    </span>
                    {log.entity_type && (
                      <span className="text-slate-500 text-xs">
                        em {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        {log.entity_id && <span className="text-slate-700 ml-1 font-mono text-[10px]">#{log.entity_id.slice(0, 8)}</span>}
                      </span>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-slate-500 text-xs mt-0.5 truncate">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </p>
                  )}
                </div>
                <span className="text-slate-600 text-xs flex-shrink-0 mt-0.5">{fmtDate(log.created_at)}</span>
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
