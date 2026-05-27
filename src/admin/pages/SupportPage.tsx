import { useState, useEffect } from 'react';
import { MessageSquare, X, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const STATUS_TABS = ['open', 'in_progress', 'resolved', 'closed'];
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado',
};
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-500/20 text-amber-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  resolved: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-slate-500/20 text-slate-300',
};
const STATUS_ICONS: Record<string, any> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle,
  closed: CheckCircle,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

export default function SupportPage({ admin }: Props) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async (s = statusFilter) => {
    setLoading(true);
    const res = await api.support.list(s);
    if (!res.error) setTickets(res.tickets || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    await api.support.update(id, status);
    load();
    setSelected((prev: any) => prev?.id === id ? { ...prev, status } : prev);
    setActionLoading(null);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const canChangeRole = admin.role === 'master' || admin.role === 'support';

  return (
    <div className="space-y-4">
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto z-10 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Ticket de Suporte</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center text-white font-bold overflow-hidden">
                {selected.profiles?.avatar_url
                  ? <img src={selected.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  : selected.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{selected.profiles?.full_name || 'Usuário'}</p>
                <p className="text-slate-400 text-xs">{selected.profiles?.email}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-white font-semibold text-sm">{selected.subject}</p>
                {selected.priority && (
                  <span className={`text-xs font-medium flex-shrink-0 ${PRIORITY_COLORS[selected.priority] || 'text-slate-400'}`}>
                    {selected.priority}
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{selected.message}</p>
              <p className="text-slate-600 text-xs">{fmtDate(selected.created_at)}</p>
            </div>

            {selected.admin_response && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-300 text-xs font-medium mb-1">Resposta do suporte</p>
                <p className="text-blue-100 text-sm leading-relaxed">{selected.admin_response}</p>
                {selected.resolved_at && (
                  <p className="text-blue-400/60 text-xs mt-2">{fmtDate(selected.resolved_at)}</p>
                )}
              </div>
            )}

            {canChangeRole && selected.status !== 'closed' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <p className="text-slate-500 text-xs font-medium">Atualizar status</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_TABS.filter(s => s !== selected.status).map(s => {
                    const Icon = STATUS_ICONS[s];
                    return (
                      <button key={s} onClick={() => handleStatus(selected.id, s)}
                        disabled={!!actionLoading}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${STATUS_COLORS[s]} border-current/20 hover:opacity-80`}>
                        <Icon size={12} /> {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold">Central de Suporte</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); load(s); }}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <MessageSquare size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum ticket "{STATUS_LABELS[statusFilter]}"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const Icon = STATUS_ICONS[ticket.status] || AlertCircle;
            return (
              <div key={ticket.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors cursor-pointer"
                onClick={() => setSelected(ticket)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                      {ticket.profiles?.avatar_url
                        ? <img src={ticket.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        : ticket.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-slate-400 text-xs">{ticket.profiles?.full_name || 'Usuário'}</p>
                      <p className="text-slate-600 text-xs mt-1 line-clamp-2">{ticket.message}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                    {ticket.priority && (
                      <span className={`text-[10px] font-medium ${PRIORITY_COLORS[ticket.priority] || 'text-slate-400'}`}>
                        {ticket.priority}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-slate-600 text-xs">{fmtDate(ticket.created_at)}</span>
                  <ChevronRight size={14} className="text-slate-600" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
