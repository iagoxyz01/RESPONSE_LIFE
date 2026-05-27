import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, X, ChevronLeft, ChevronRight, Clock, CheckCircle2,
  AlertCircle, Search, Filter, Hash, User, Phone, Mail, Copy, Check,
  RefreshCw, Send, FileText, Hash as HashIcon,
} from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const CATEGORIES: Record<string, { label: string; color: string }> = {
  payment:    { label: 'Pagamento',   color: 'bg-emerald-500/20 text-emerald-300' },
  attendance: { label: 'Atendimento', color: 'bg-blue-500/20 text-blue-300' },
  caregiver:  { label: 'Cuidador',    color: 'bg-cyan-500/20 text-cyan-300' },
  account:    { label: 'Conta',       color: 'bg-amber-500/20 text-amber-300' },
  chat:       { label: 'Chat',        color: 'bg-slate-500/20 text-slate-300' },
  report:     { label: 'Denúncia',    color: 'bg-red-500/20 text-red-300' },
  other:      { label: 'Outro',       color: 'bg-slate-600/20 text-slate-400' },
  general:    { label: 'Geral',       color: 'bg-slate-600/20 text-slate-400' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:        { label: 'Pendente',    color: 'bg-amber-500/20 text-amber-300 border border-amber-500/20',    icon: <Clock size={11} /> },
  in_progress: { label: 'Em análise', color: 'bg-blue-500/20 text-blue-300 border border-blue-500/20',       icon: <AlertCircle size={11} /> },
  resolved:    { label: 'Resolvido',  color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20', icon: <CheckCircle2 size={11} /> },
  closed:      { label: 'Encerrado',  color: 'bg-slate-500/20 text-slate-400 border border-slate-600/20',    icon: <CheckCircle2 size={11} /> },
};

const STATUS_TABS = ['', 'open', 'in_progress', 'resolved', 'closed'];
const STATUS_TAB_LABELS = ['Todos', 'Pendente', 'Em análise', 'Resolvido', 'Encerrado'];

function TicketBadge({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 rounded-md transition-colors">
      <Hash size={9} />{id}
      {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} className="opacity-40" />}
    </button>
  );
}

export default function SupportPage({ admin }: Props) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p = 1, opts?: { status?: string; search?: string; category?: string }) => {
    setLoading(true);
    const res = await api.support.list({
      status: opts?.status ?? statusFilter,
      search: opts?.search ?? search,
      category: opts?.category ?? categoryFilter,
      page: p,
    });
    if (!res.error) { setTickets(res.tickets || []); setTotal(res.total || 0); }
    setLoading(false);
  }, [statusFilter, search, categoryFilter]);

  useEffect(() => { load(); }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); load(1, { search: val }); }, 350);
  };

  const handleStatusTab = (s: string) => {
    setStatusFilter(s);
    setPage(1);
    load(1, { status: s });
  };

  const openDetail = async (ticket: any) => {
    const res = await api.support.get(ticket.id);
    const t = res.ticket || ticket;
    setSelected(t);
    setResponseText(t.admin_response || '');
    setNotesText(t.admin_notes || '');
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id + status);
    await api.support.update(id, { status });
    load(page);
    setSelected((prev: any) => prev?.id === id ? { ...prev, status } : prev);
    setActionLoading(null);
  };

  const handleSaveResponse = async () => {
    if (!selected) return;
    setSavingResponse(true);
    await api.support.update(selected.id, {
      admin_response: responseText,
      admin_notes: notesText,
    });
    setSelected((prev: any) => ({ ...prev, admin_response: responseText, admin_notes: notesText }));
    load(page);
    setSavingResponse(false);
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const canManage = admin.role === 'master' || admin.role === 'support';
  const perPage = 25;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      {/* ── Detail drawer ─────────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-slate-950 border-l border-slate-800 h-full overflow-y-auto z-10">
            {/* Header */}
            <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold">Chamado</h3>
                    {selected.ticket_id && <TicketBadge id={selected.ticket_id} />}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {CATEGORIES[selected.category]?.label || selected.category} · {fmtDate(selected.created_at)}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CONFIG[selected.status]?.color || ''}`}>
                  {STATUS_CONFIG[selected.status]?.icon}
                  {STATUS_CONFIG[selected.status]?.label || selected.status}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${CATEGORIES[selected.category]?.color || 'bg-slate-700 text-slate-300'}`}>
                  {CATEGORIES[selected.category]?.label || selected.category}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* User info */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Usuário</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                    {selected.profiles?.avatar_url
                      ? <img src={selected.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      : selected.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{selected.profiles?.full_name || '—'}</p>
                    <p className="text-slate-400 text-xs capitalize">{selected.profiles?.user_type || ''}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail size={11} className="text-slate-600" />
                    <span>{selected.profiles?.email || '—'}</span>
                  </div>
                  {selected.profiles?.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Phone size={11} className="text-slate-600" />
                      <span>{selected.profiles.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket details */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Chamado</p>
                <p className="text-white font-semibold">{selected.subject}</p>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.message || selected.description}</p>
                </div>
                {selected.care_requests && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <HashIcon size={11} className="text-slate-500" />
                    <span className="text-slate-500 text-xs">Atendimento:</span>
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {selected.care_requests.atd_id}
                    </span>
                    <span className="text-slate-500 text-xs">{selected.care_requests.care_type}</span>
                  </div>
                )}
              </div>

              {/* Admin response */}
              {canManage && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Resposta ao Usuário</p>
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="Escreva uma resposta visível ao usuário..."
                    rows={4}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider pt-1">Notas Internas</p>
                  <textarea
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    placeholder="Notas internas (não visíveis ao usuário)..."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-slate-500 resize-none"
                  />
                  <button
                    onClick={handleSaveResponse}
                    disabled={savingResponse}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingResponse
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Send size={14} />Salvar Resposta</>}
                  </button>
                </div>
              )}

              {/* Existing admin response (read-only view) */}
              {!canManage && selected.admin_response && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-300 text-xs font-semibold mb-2">Resposta do suporte</p>
                  <p className="text-blue-100 text-sm leading-relaxed">{selected.admin_response}</p>
                </div>
              )}

              {/* Status management */}
              {canManage && selected.status !== 'closed' && (
                <div className="space-y-2 pt-1">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Atualizar Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_TABS.filter(s => s && s !== selected.status).map(s => (
                      <button key={s}
                        onClick={() => handleStatusChange(selected.id, s)}
                        disabled={!!actionLoading}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${STATUS_CONFIG[s]?.color} hover:opacity-80`}>
                        {STATUS_CONFIG[s]?.icon}
                        {STATUS_CONFIG[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Cronologia</p>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Aberto em</span>
                  <span className="text-slate-300 font-mono">{fmtDate(selected.created_at)}</span>
                </div>
                {selected.resolved_at && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Resolvido em</span>
                    <span className="text-slate-300 font-mono">{fmtDate(selected.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">
          Central de Suporte
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
            placeholder="Buscar por SUP-0001, nome, email, telefone, ATD..."
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${categoryFilter ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Filter size={14} />
          Categoria
        </button>
      </div>

      {/* ── Category filter panel ───────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Filtrar por Categoria</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setCategoryFilter(''); setPage(1); load(1, { category: '' }); setShowFilters(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${!categoryFilter ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              Todas
            </button>
            {Object.entries(CATEGORIES).map(([val, cfg]) => (
              <button key={val} onClick={() => { setCategoryFilter(val); setPage(1); load(1, { category: val }); setShowFilters(false); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${categoryFilter === val ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Status tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((s, i) => (
          <button key={s || 'all'} onClick={() => handleStatusTab(s)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {s && STATUS_CONFIG[s]?.icon}
            {STATUS_TAB_LABELS[i]}
          </button>
        ))}
      </div>

      {/* ── Ticket list ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-14 text-center">
          <MessageSquare size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhum chamado encontrado</p>
          {search && <p className="text-slate-600 text-xs mt-1">Tente buscar por outro termo</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const cat = CATEGORIES[ticket.category] || { label: ticket.category, color: 'bg-slate-700 text-slate-300' };
            return (
              <div key={ticket.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => openDetail(ticket)}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                      {ticket.profiles?.avatar_url
                        ? <img src={ticket.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        : ticket.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {ticket.ticket_id && <TicketBadge id={ticket.ticket_id} />}
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                          {st.icon}{st.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${cat.color}`}>{cat.label}</span>
                      </div>
                      <p className="text-white font-semibold text-sm truncate">{ticket.subject}</p>
                      <p className="text-slate-500 text-xs">{ticket.profiles?.full_name || '—'} · {ticket.profiles?.email}</p>
                    </div>
                  </div>
                </div>
                <p className="text-slate-600 text-xs line-clamp-1 mb-2">{ticket.message || ticket.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 text-xs">{fmtDate(ticket.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {ticket.care_requests?.atd_id && (
                      <span className="font-mono text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        {ticket.care_requests.atd_id}
                      </span>
                    )}
                    {ticket.admin_response && (
                      <span className="text-[10px] text-emerald-400 font-medium">Respondido</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <p className="text-slate-500 text-xs">{((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} de {total}</p>
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
  );
}
