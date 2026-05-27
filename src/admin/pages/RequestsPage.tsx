import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye, X, Camera, MessageCircle, ChevronLeft, ChevronRight,
  Search, Filter, Hash, Calendar, CreditCard, Clock,
  MapPin, DollarSign, User, UserCheck, Activity, CheckCircle2,
  XCircle, AlertCircle, FileText, RefreshCw, Copy, Check,
} from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const STATUS_COLORS: Record<string, string> = {
  searching:         'bg-amber-500/20 text-amber-300 border border-amber-500/20',
  awaiting_approval: 'bg-blue-500/20 text-blue-300 border border-blue-500/20',
  scheduled:         'bg-cyan-500/20 text-cyan-300 border border-cyan-500/20',
  in_progress:       'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20',
  awaiting_payment:  'bg-orange-500/20 text-orange-300 border border-orange-500/20',
  completed:         'bg-slate-500/20 text-slate-300 border border-slate-600/20',
  cancelled:         'bg-red-500/20 text-red-300 border border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  searching: 'Buscando', awaiting_approval: 'Aguardando', scheduled: 'Agendado',
  in_progress: 'Em andamento', awaiting_payment: 'Pagamento', completed: 'Finalizado', cancelled: 'Cancelado',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  searching:         <Search size={11} />,
  awaiting_approval: <AlertCircle size={11} />,
  scheduled:         <Clock size={11} />,
  in_progress:       <Activity size={11} />,
  awaiting_payment:  <DollarSign size={11} />,
  completed:         <CheckCircle2 size={11} />,
  cancelled:         <XCircle size={11} />,
};

const STATUS_TABS = ['', 'searching', 'awaiting_approval', 'scheduled', 'in_progress', 'awaiting_payment', 'completed', 'cancelled'];
const STATUS_TAB_LABELS = ['Todos', 'Buscando', 'Interessados', 'Agendado', 'Em andamento', 'Pagamento', 'Finalizados', 'Cancelados'];

const LOG_EVENT_LABELS: Record<string, { label: string; color: string }> = {
  created:             { label: 'Solicitação criada',         color: 'text-blue-400' },
  caregiver_interested:{ label: 'Cuidador demonstrou interesse', color: 'text-cyan-400' },
  accepted:            { label: 'Cuidador aceito pelo paciente', color: 'text-emerald-400' },
  started:             { label: 'Atendimento iniciado',       color: 'text-emerald-400' },
  finished:            { label: 'Atendimento encerrado',      color: 'text-amber-400' },
  payment_confirmed:   { label: 'Pagamento confirmado',       color: 'text-emerald-400' },
  cancelled:           { label: 'Cancelado',                  color: 'text-red-400' },
  status_changed:      { label: 'Status alterado',            color: 'text-slate-400' },
  edited:              { label: 'Solicitação editada',        color: 'text-slate-400' },
};

const PAYMENT_LABELS: Record<string, string> = { pix: 'Pix', card: 'Cartão', cash: 'Dinheiro' };

function AtdBadge({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title="Copiar ID"
      className={`inline-flex items-center gap-1 font-mono font-bold rounded-lg transition-colors ${
        size === 'sm'
          ? 'text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
          : 'text-xs px-2 py-1 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
      }`}
    >
      <Hash size={size === 'sm' ? 9 : 11} />
      {id}
      {copied ? <Check size={size === 'sm' ? 9 : 11} className="text-emerald-400" /> : <Copy size={size === 'sm' ? 9 : 11} className="opacity-50" />}
    </button>
  );
}

export default function RequestsPage({ admin: _admin }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'logs' | 'chat' | 'photos'>('info');

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p = 1, opts?: {
    status?: string; search?: string; date_from?: string; date_to?: string; payment_method?: string;
  }) => {
    setLoading(true);
    const res = await api.requests.list(p, {
      status: opts?.status ?? statusFilter,
      search: opts?.search ?? search,
      date_from: opts?.date_from ?? dateFrom,
      date_to: opts?.date_to ?? dateTo,
      payment_method: opts?.payment_method ?? paymentMethod,
    });
    if (!res.error) { setRequests(res.requests || []); setTotal(res.total || 0); }
    setLoading(false);
  }, [statusFilter, search, dateFrom, dateTo, paymentMethod]);

  useEffect(() => { load(); }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      load(1, { search: val });
    }, 350);
  };

  const applyFilters = () => {
    setPage(1);
    load(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setPaymentMethod('');
    setPage(1);
    load(1, { date_from: '', date_to: '', payment_method: '' });
    setShowFilters(false);
  };

  const handleStatusTab = (s: string) => {
    setStatusFilter(s);
    setPage(1);
    load(1, { status: s });
  };

  const openDetail = async (id: string) => {
    setDetail({ loading: true });
    setActiveDetailTab('info');
    const res = await api.requests.get(id);
    if (!res.error) setDetail(res);
    else setDetail(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDateShort = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);
  const hasFilters = dateFrom || dateTo || paymentMethod;

  return (
    <div className="space-y-4">
      {/* ── Expanded photo ─────────────────────────────────────────────────────── */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setExpandedPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={20} className="text-white" />
          </button>
          <img src={expandedPhoto} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      {/* ── Detail drawer ───────────────────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-lg bg-slate-950 border-l border-slate-800 h-full overflow-y-auto z-10">
            {detail.loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Drawer header */}
                <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-4 z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-lg">Atendimento</h3>
                          {detail.request?.atd_id && <AtdBadge id={detail.request.atd_id} />}
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">{detail.request?.care_type}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetail(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Status + tabs */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[detail.request?.status] || ''}`}>
                      {STATUS_ICONS[detail.request?.status]}
                      {STATUS_LABELS[detail.request?.status] || detail.request?.status}
                    </span>
                    <span className="text-slate-500 text-xs">{fmtDateShort(detail.request?.created_at)}</span>
                  </div>

                  <div className="flex gap-1">
                    {([
                      { key: 'info', label: 'Detalhes', icon: <FileText size={12} /> },
                      { key: 'logs', label: `Histórico${detail.logs?.length ? ` (${detail.logs.length})` : ''}`, icon: <Activity size={12} /> },
                      { key: 'chat', label: `Chat${detail.messages?.length ? ` (${detail.messages.length})` : ''}`, icon: <MessageCircle size={12} /> },
                      { key: 'photos', label: `Fotos${detail.photos?.length ? ` (${detail.photos.length})` : ''}`, icon: <Camera size={12} /> },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveDetailTab(tab.key)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeDetailTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                      >
                        {tab.icon}{tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* ── Info tab ─────────────────────────────────────────────────── */}
                  {activeDetailTab === 'info' && (
                    <div className="space-y-4">
                      {/* Request details */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                        <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Solicitação</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500 text-xs mb-0.5">ID</p>
                            {detail.request?.atd_id ? <AtdBadge id={detail.request.atd_id} size="sm" /> : <span className="text-slate-400">—</span>}
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs mb-0.5">Tipo</p>
                            <p className="text-slate-200 font-medium text-xs">{detail.request?.care_type}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1"><Calendar size={10} />Data agendada</p>
                            <p className="text-slate-300 text-xs">{fmtDate(detail.request?.scheduled_at)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1"><Clock size={10} />Duração</p>
                            <p className="text-slate-300 text-xs">{detail.request?.duration_minutes ? `${Math.floor(detail.request.duration_minutes / 60)}h${detail.request.duration_minutes % 60 > 0 ? ` ${detail.request.duration_minutes % 60}min` : ''}` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1"><DollarSign size={10} />Valor proposto</p>
                            <p className="text-emerald-400 font-semibold text-xs">{fmt(detail.request?.proposed_value)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs mb-0.5">Criado em</p>
                            <p className="text-slate-300 text-xs">{fmtDate(detail.request?.created_at)}</p>
                          </div>
                        </div>
                        {detail.request?.location_address && (
                          <div className="pt-2 border-t border-slate-800">
                            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1"><MapPin size={10} />Endereço</p>
                            <p className="text-slate-300 text-xs">{detail.request.location_address}</p>
                          </div>
                        )}
                        {detail.request?.observations && (
                          <div className="pt-2 border-t border-slate-800">
                            <p className="text-slate-500 text-xs mb-0.5">Observações</p>
                            <p className="text-slate-400 text-xs italic">{detail.request.observations}</p>
                          </div>
                        )}
                        {detail.request?.status === 'cancelled' && detail.request?.cancellation_reason && (
                          <div className="pt-2 border-t border-red-900/30">
                            <p className="text-red-500 text-xs mb-0.5">Motivo do cancelamento</p>
                            <p className="text-red-300 text-xs">{detail.request.cancellation_reason}</p>
                            {detail.request.cancelled_at && <p className="text-slate-500 text-[10px] mt-0.5">Em {fmtDate(detail.request.cancelled_at)}</p>}
                          </div>
                        )}
                        {detail.request?.cancellation_fee_applied && (
                          <div className="pt-2 border-t border-amber-900/30">
                            <p className="text-amber-400 text-xs font-semibold mb-2">Taxa de cancelamento aplicada</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-xs">Total da taxa (20%)</span>
                                <span className="text-amber-300 text-xs font-bold">{fmt(detail.request.cancellation_fee_total)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-xs">Cuidador (10%)</span>
                                <span className="text-emerald-400 text-xs font-medium">{fmt(detail.request.cancellation_fee_caregiver)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-xs">Plataforma (10%)</span>
                                <span className="text-blue-400 text-xs font-medium">{fmt(detail.request.cancellation_fee_platform)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Patient & Caregiver */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                          <div className="flex items-center gap-1.5 mb-3">
                            <User size={12} className="text-blue-400" />
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Paciente</p>
                          </div>
                          {detail.request?.patients?.profiles ? (
                            <div className="space-y-1.5">
                              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2">
                                {detail.request.patients.profiles.full_name?.[0]}
                              </div>
                              <p className="text-slate-200 text-xs font-semibold leading-tight">{detail.request.patients.profiles.full_name}</p>
                              <p className="text-slate-500 text-[10px]">{detail.request.patients.profiles.phone || '—'}</p>
                              <p className="text-slate-600 text-[10px]">{detail.request.patients.profiles.email}</p>
                            </div>
                          ) : <p className="text-slate-600 text-xs">—</p>}
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                          <div className="flex items-center gap-1.5 mb-3">
                            <UserCheck size={12} className="text-emerald-400" />
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Cuidador</p>
                          </div>
                          {detail.request?.caregivers?.profiles ? (
                            <div className="space-y-1.5">
                              <div className="w-9 h-9 bg-emerald-700 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2">
                                {detail.request.caregivers.profiles.full_name?.[0]}
                              </div>
                              <p className="text-slate-200 text-xs font-semibold leading-tight">{detail.request.caregivers.profiles.full_name}</p>
                              <p className="text-slate-500 text-[10px]">{detail.request.caregivers.profiles.phone || '—'}</p>
                              <p className="text-slate-600 text-[10px]">{detail.request.caregivers.profiles.email}</p>
                            </div>
                          ) : <p className="text-slate-600 text-xs">Não atribuído</p>}
                        </div>
                      </div>

                      {/* Timing */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Cronograma</h4>
                        <div className="space-y-2.5">
                          {[
                            { label: 'Criado', value: detail.request?.created_at, color: 'bg-blue-500' },
                            { label: 'Agendado para', value: detail.request?.scheduled_at, color: 'bg-cyan-500' },
                            { label: 'Início real', value: detail.request?.actual_start_at, color: 'bg-emerald-500' },
                            { label: 'Fim real', value: detail.request?.actual_end_at, color: 'bg-amber-500' },
                            { label: 'Cancelado em', value: detail.request?.cancelled_at, color: 'bg-red-500' },
                          ].filter(t => t.value).map(t => (
                            <div key={t.label} className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${t.color} flex-shrink-0`} />
                              <div className="flex-1 flex items-center justify-between">
                                <span className="text-slate-500 text-xs">{t.label}</span>
                                <span className="text-slate-300 text-xs font-mono">{fmtDate(t.value)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payment */}
                      {detail.payment && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                          <div className="flex items-center gap-1.5 mb-3">
                            <CreditCard size={12} className="text-emerald-400" />
                            <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Pagamento</h4>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500 text-xs">Método</span>
                              <span className="text-slate-200 text-xs font-medium">{PAYMENT_LABELS[detail.payment.payment_method] || detail.payment.payment_method}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 text-xs">Taxa plataforma</span>
                              <span className="text-blue-400 text-xs font-medium">{fmt(detail.payment.platform_fee)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-800">
                              <span className="text-slate-400 text-xs font-semibold">Total</span>
                              <span className="text-emerald-400 text-xs font-bold">{fmt(detail.payment.gross_amount)}</span>
                            </div>
                            {detail.payment.paid_at && (
                              <p className="text-slate-600 text-[10px]">Pago em {fmtDate(detail.payment.paid_at)}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Logs tab ─────────────────────────────────────────────────── */}
                  {activeDetailTab === 'logs' && (
                    <div className="space-y-1">
                      {(!detail.logs || detail.logs.length === 0) ? (
                        <div className="text-center py-12 text-slate-600 text-sm">Nenhum registro encontrado</div>
                      ) : (
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800" />
                          <div className="space-y-4 ml-4 pl-6">
                            {detail.logs.map((log: any, idx: number) => {
                              const cfg = LOG_EVENT_LABELS[log.event] || { label: log.event, color: 'text-slate-400' };
                              return (
                                <div key={log.id} className="relative">
                                  <div className="absolute -left-6 top-1.5 w-2 h-2 rounded-full bg-slate-700 border border-slate-600" />
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                                      <span className="text-slate-600 text-[10px] font-mono">{fmtDate(log.created_at)}</span>
                                    </div>
                                    <p className="text-slate-500 text-[10px]">
                                      Por: <span className="text-slate-400 capitalize">{log.actor_role}</span>
                                    </p>
                                    {log.details && Object.keys(log.details).length > 0 && (
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-800 space-y-0.5">
                                        {log.details.old_status && log.details.new_status && (
                                          <p className="text-[10px] text-slate-500">
                                            {STATUS_LABELS[log.details.old_status] || log.details.old_status}
                                            {' → '}
                                            <span className="text-slate-300">{STATUS_LABELS[log.details.new_status] || log.details.new_status}</span>
                                          </p>
                                        )}
                                        {log.details.cancellation_reason && (
                                          <p className="text-[10px] text-red-400">Motivo: {log.details.cancellation_reason}</p>
                                        )}
                                        {log.details.care_type && (
                                          <p className="text-[10px] text-slate-500">Tipo: {log.details.care_type}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Chat tab ─────────────────────────────────────────────────── */}
                  {activeDetailTab === 'chat' && (
                    <div>
                      {(!detail.messages || detail.messages.length === 0) ? (
                        <div className="text-center py-12 text-slate-600 text-sm">Nenhuma mensagem</div>
                      ) : (
                        <div className="space-y-3">
                          {detail.messages.map((m: any) => (
                            <div key={m.id} className="flex items-start gap-3">
                              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                                {m.profiles?.full_name?.[0]}
                              </div>
                              <div className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-slate-400 text-[10px] font-medium">{m.profiles?.full_name}</p>
                                  <span className="text-slate-600 text-[10px]">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-slate-300 text-xs leading-relaxed break-words">{m.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Photos tab ───────────────────────────────────────────────── */}
                  {activeDetailTab === 'photos' && (
                    <div>
                      {(!detail.photos || detail.photos.length === 0) ? (
                        <div className="text-center py-12 text-slate-600 text-sm">Nenhuma foto registrada</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {detail.photos.map((p: any) => (
                            <button key={p.id} onClick={() => setExpandedPhoto(p.photo_url)} className="aspect-square rounded-xl overflow-hidden bg-slate-800 relative group">
                              <img src={p.photo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent py-2 px-2">
                                <p className="text-white text-[10px] font-medium">{p.photo_type === 'start' ? 'Chegada' : p.photo_type === 'end' ? 'Encerramento' : 'Periódica'}</p>
                                <p className="text-white/60 text-[9px]">{new Date(p.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">
          Atendimentos
          <span className="text-slate-500 font-normal text-sm ml-2">({total})</span>
        </h2>
        <button onClick={() => load(page)} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por ID (ATD-0001), nome, telefone..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
          />
          {search && (
            <button onClick={() => { setSearch(''); load(1, { search: '' }); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${hasFilters ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Filter size={14} />
          Filtros
          {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </button>
      </div>

      {/* ── Advanced filters panel ─────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Data de início</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Data de fim</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1.5">Forma de pagamento</label>
            <div className="flex gap-2">
              {[{ v: '', l: 'Todas' }, { v: 'pix', l: 'Pix' }, { v: 'card', l: 'Cartão' }, { v: 'cash', l: 'Dinheiro' }].map(o => (
                <button key={o.v} onClick={() => setPaymentMethod(o.v)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${paymentMethod === o.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={clearFilters} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:text-white hover:border-slate-600 transition-colors">
              Limpar
            </button>
            <button onClick={applyFilters} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              Aplicar filtros
            </button>
          </div>
        </div>
      )}

      {/* ── Status tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((s, i) => (
          <button key={s} onClick={() => handleStatusTab(s)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {STATUS_TAB_LABELS[i]}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">ID / Tipo</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Paciente</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden lg:table-cell">Cuidador</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden lg:table-cell">Data</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Valor</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">Status</th>
                <th className="text-right text-slate-500 text-xs font-medium px-5 py-3.5">Ver</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
                    </td>
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Search size={28} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Nenhum atendimento encontrado</p>
                    {search && <p className="text-slate-600 text-xs mt-1">Tente buscar por outro termo</p>}
                  </td>
                </tr>
              ) : (
                requests.map(r => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => openDetail(r.id)}>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        {r.atd_id && <AtdBadge id={r.atd_id} size="sm" />}
                        <p className="text-slate-200 text-xs font-medium">{r.care_type}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="text-slate-300 text-sm">{r.patients?.profiles?.full_name || '—'}</p>
                      <p className="text-slate-600 text-[10px]">{r.patients?.profiles?.phone || ''}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <p className="text-slate-400 text-sm">{r.caregivers?.profiles?.full_name || <span className="text-slate-700 italic text-xs">Não atribuído</span>}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <p className="text-slate-400 text-xs">{fmtDateShort(r.scheduled_at)}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="text-emerald-400 text-sm font-medium">{fmt(r.proposed_value)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}>
                        {STATUS_ICONS[r.status]}
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={e => { e.stopPropagation(); openDetail(r.id); }}>
                      <button className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800">
            <p className="text-slate-500 text-xs">
              {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} de {total} atendimentos
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => { const p = page - 1; setPage(p); load(p); }} disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-slate-400 text-xs px-2">Pág. {page} / {totalPages}</span>
              <button onClick={() => { const p = page + 1; setPage(p); load(p); }} disabled={page >= totalPages}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
