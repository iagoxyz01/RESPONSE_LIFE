import { useState, useEffect } from 'react';
import { Eye, X, Camera, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const STATUS_COLORS: Record<string, string> = {
  searching: 'bg-amber-500/20 text-amber-300',
  awaiting_approval: 'bg-blue-500/20 text-blue-300',
  scheduled: 'bg-cyan-500/20 text-cyan-300',
  in_progress: 'bg-emerald-500/20 text-emerald-300',
  awaiting_payment: 'bg-orange-500/20 text-orange-300',
  completed: 'bg-slate-500/20 text-slate-300',
  cancelled: 'bg-red-500/20 text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  searching: 'Buscando', awaiting_approval: 'Aguardando', scheduled: 'Agendado',
  in_progress: 'Em andamento', awaiting_payment: 'Pagamento', completed: 'Finalizado', cancelled: 'Cancelado',
};

const STATUS_TABS = ['', 'searching', 'in_progress', 'completed', 'cancelled'];
const STATUS_TAB_LABELS = ['Todos', 'Buscando', 'Em andamento', 'Finalizados', 'Cancelados'];

export default function RequestsPage({ admin: _admin }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const load = async (p = page, s = statusFilter) => {
    setLoading(true);
    const res = await api.requests.list(p, s);
    if (!res.error) { setRequests(res.requests || []); setTotal(res.total || 0); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    setDetail({ loading: true });
    const res = await api.requests.get(id);
    if (!res.error) setDetail(res);
    else setDetail(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setExpandedPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full"><X size={20} className="text-white" /></button>
          <img src={expandedPhoto} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto z-10 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Atendimento</h3>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {detail.loading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Tipo</span><span className="text-slate-200 font-medium">{detail.request?.care_type}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[detail.request?.status] || ''}`}>{STATUS_LABELS[detail.request?.status] || detail.request?.status}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-400">Data</span><span className="text-slate-200">{fmtDate(detail.request?.scheduled_at)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Valor</span><span className="text-emerald-400 font-semibold">{fmt(detail.request?.proposed_value)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Local</span><span className="text-slate-200 text-xs text-right max-w-[60%]">{detail.request?.location_address}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <p className="text-slate-500 text-xs mb-2">Paciente</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {detail.request?.patients?.profiles?.full_name?.[0]}
                      </div>
                      <p className="text-slate-200 text-xs font-medium truncate">{detail.request?.patients?.profiles?.full_name}</p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <p className="text-slate-500 text-xs mb-2">Cuidador</p>
                    {detail.request?.caregivers ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {detail.request.caregivers?.profiles?.full_name?.[0]}
                        </div>
                        <p className="text-slate-200 text-xs font-medium truncate">{detail.request.caregivers?.profiles?.full_name}</p>
                      </div>
                    ) : <p className="text-slate-600 text-xs">Não atribuído</p>}
                  </div>
                </div>

                {/* Payment */}
                {detail.payment && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-300 font-semibold text-sm mb-2">Pagamento</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Método</span>
                      <span className="text-slate-200 capitalize">{detail.payment.payment_method}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-400">Taxa plataforma</span>
                      <span className="text-blue-400">{fmt(detail.payment.platform_fee)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 font-semibold">
                      <span className="text-slate-400">Total</span>
                      <span className="text-emerald-400">{fmt(detail.payment.gross_amount)}</span>
                    </div>
                  </div>
                )}

                {/* Photos */}
                {detail.photos?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Camera size={14} className="text-slate-400" />
                      <p className="text-slate-300 font-semibold text-sm">Fotos ({detail.photos.length})</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {detail.photos.map((p: any) => (
                        <button key={p.id} onClick={() => setExpandedPhoto(p.photo_url)} className="aspect-square rounded-lg overflow-hidden bg-slate-700 relative">
                          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 px-1.5">
                            <p className="text-white text-[9px]">{new Date(p.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-white/60 text-[8px]">{p.photo_type === 'start' ? 'Chegada' : p.photo_type === 'end' ? 'Encerramento' : 'Periódica'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {detail.messages?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageCircle size={14} className="text-slate-400" />
                      <p className="text-slate-300 font-semibold text-sm">Chat ({detail.messages.length} mensagens)</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                      {detail.messages.slice(-10).map((m: any) => (
                        <div key={m.id} className="flex items-start gap-2">
                          <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {m.profiles?.full_name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-500 text-[10px]">{m.profiles?.full_name}</p>
                            <p className="text-slate-300 text-xs leading-relaxed break-words">{m.content}</p>
                          </div>
                          <span className="text-slate-600 text-[9px] flex-shrink-0">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold">Atendimentos <span className="text-slate-500 font-normal text-sm ml-1">({total})</span></h2>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((s, i) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); load(1, s); }}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {STATUS_TAB_LABELS[i]}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">Atendimento</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Paciente</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden lg:table-cell">Data</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Valor</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">Status</th>
                <th className="text-right text-slate-500 text-xs font-medium px-5 py-3.5">Ver</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800/50"><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
              )) : requests.map(r => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5"><p className="text-slate-200 text-sm font-medium">{r.care_type}</p><p className="text-slate-600 text-[10px]">{r.id.slice(0, 8)}</p></td>
                  <td className="px-5 py-3.5 hidden md:table-cell"><p className="text-slate-300 text-sm">{r.patients?.profiles?.full_name || '—'}</p></td>
                  <td className="px-5 py-3.5 hidden lg:table-cell"><p className="text-slate-400 text-xs">{fmtDate(r.scheduled_at)}</p></td>
                  <td className="px-5 py-3.5 hidden md:table-cell"><p className="text-emerald-400 text-sm font-medium">{fmt(r.proposed_value)}</p></td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[r.status] || ''}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => openDetail(r.id)} className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors"><Eye size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800">
            <p className="text-slate-500 text-xs">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => { const p=page-1; setPage(p); load(p); }} disabled={page===1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800"><ChevronLeft size={16} /></button>
              <button onClick={() => { const p=page+1; setPage(p); load(p); }} disabled={page>=totalPages} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
