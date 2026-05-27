import { useState, useEffect } from 'react';
import { Search, UserX, Ban, Eye, ChevronLeft, ChevronRight, Shield, ShieldOff } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

export default function UsersPage({ admin: _admin }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async (p = page, q = search) => {
    setLoading(true);
    const res = await api.users.list(p, q);
    if (!res.error) { setUsers(res.users || []); setTotal(res.total || 0); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(1, search); };

  const handleSuspend = async (id: string, suspended: boolean) => {
    setActionLoading(id);
    await api.users.update(id, { suspended: !suspended });
    load();
    if (selected?.id === id) setSelected((p: any) => ({ ...p, suspended: !suspended }));
    setActionLoading(null);
  };

  const handleBan = async (id: string) => {
    setActionLoading(id + '_ban');
    await api.users.ban(id);
    load();
    setSelected(null);
    setActionLoading(null);
  };

  const openUser = async (id: string) => {
    const res = await api.users.get(id);
    if (!res.error) setSelected(res);
  };

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const TYPE_COLORS: Record<string, string> = {
    caregiver: 'bg-emerald-500/20 text-emerald-300',
    patient: 'bg-blue-500/20 text-blue-300',
    admin: 'bg-rose-500/20 text-rose-300',
  };

  return (
    <div className="space-y-4">
      {/* User detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto z-10 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Detalhes do Usuário</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                {selected.user?.avatar_url
                  ? <img src={selected.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : selected.user?.full_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">{selected.user?.full_name}</p>
                <p className="text-slate-400 text-sm">{selected.user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[selected.user?.user_type] || 'bg-slate-700 text-slate-300'}`}>
                    {selected.user?.user_type}
                  </span>
                  {selected.user?.suspended && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Suspenso</span>
                  )}
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Telefone</span><span className="text-slate-200">{selected.user?.phone || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Verificado</span><span className={selected.user?.verified ? 'text-emerald-400' : 'text-slate-500'}>{selected.user?.verified ? 'Sim' : 'Não'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Membro desde</span><span className="text-slate-200">{new Date(selected.user?.created_at).toLocaleDateString('pt-BR')}</span></div>
            </div>

            {/* Recent requests */}
            <div>
              <h4 className="text-slate-300 font-semibold text-sm mb-3">Histórico de Atendimentos ({selected.requests?.length || 0})</h4>
              <div className="space-y-2">
                {(selected.requests || []).slice(0, 5).map((r: any) => (
                  <div key={r.id} className="bg-slate-800/50 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-slate-200 text-xs font-medium">{r.care_type}</p>
                      <p className="text-slate-500 text-[10px]">{new Date(r.scheduled_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-lg">{r.status}</span>
                  </div>
                ))}
                {!selected.requests?.length && <p className="text-slate-600 text-xs text-center py-3">Nenhum atendimento</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleSuspend(selected.user.id, selected.user.suspended)}
                disabled={!!actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
              >
                {selected.user?.suspended ? <Shield size={14} /> : <ShieldOff size={14} />}
                {selected.user?.suspended ? 'Reativar' : 'Suspender'}
              </button>
              <button
                onClick={() => handleBan(selected.user.id)}
                disabled={!!actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Ban size={14} />
                Banir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-white font-bold">Usuários <span className="text-slate-500 font-normal text-sm ml-1">({total})</span></h2>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
            Buscar
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">Usuário</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Tipo</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden lg:table-cell">Status</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden lg:table-cell">Criado em</th>
                <th className="text-right text-slate-500 text-xs font-medium px-5 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td colSpan={5} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : users.map(user => (
                <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden flex-shrink-0">
                        {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : user.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-slate-200 text-sm font-medium">{user.full_name}</p>
                        <p className="text-slate-500 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[user.user_type] || 'bg-slate-700 text-slate-300'}`}>
                      {user.user_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full ${user.suspended ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {user.suspended ? 'Suspenso' : 'Ativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-slate-400 text-xs">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openUser(user.id)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleSuspend(user.id, user.suspended)} disabled={actionLoading === user.id} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-slate-800">
                        {user.suspended ? <Shield size={15} /> : <ShieldOff size={15} />}
                      </button>
                      <button onClick={() => handleBan(user.id)} disabled={actionLoading === user.id + '_ban'} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800">
                        <UserX size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800">
            <p className="text-slate-500 text-xs">Página {page} de {totalPages} · {total} usuários</p>
            <div className="flex gap-2">
              <button onClick={() => { setPage(p => p-1); load(page-1); }} disabled={page === 1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => { setPage(p => p+1); load(page+1); }} disabled={page >= totalPages} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
