import { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, ChevronDown, Hash, Clock, CheckCircle2,
  AlertCircle, MessageSquare, Send, X, ChevronRight, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface SupportCenterPageProps {
  onBack: () => void;
}

const CATEGORIES = [
  { value: 'payment',     label: 'Pagamento',    color: 'bg-emerald-50 text-emerald-700' },
  { value: 'attendance',  label: 'Atendimento',  color: 'bg-blue-50 text-blue-700' },
  { value: 'caregiver',   label: 'Cuidador',     color: 'bg-cyan-50 text-cyan-700' },
  { value: 'account',     label: 'Conta',        color: 'bg-amber-50 text-amber-700' },
  { value: 'chat',        label: 'Chat',         color: 'bg-slate-100 text-slate-700' },
  { value: 'report',      label: 'Denúncia',     color: 'bg-red-50 text-red-700' },
  { value: 'other',       label: 'Outro',        color: 'bg-slate-100 text-slate-600' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open:        { label: 'Pendente',    color: 'text-amber-700',  bg: 'bg-amber-50',   icon: <Clock size={12} /> },
  in_progress: { label: 'Em análise', color: 'text-blue-700',   bg: 'bg-blue-50',    icon: <AlertCircle size={12} /> },
  resolved:    { label: 'Resolvido',  color: 'text-green-700',  bg: 'bg-green-50',   icon: <CheckCircle2 size={12} /> },
  closed:      { label: 'Encerrado',  color: 'text-slate-600',  bg: 'bg-slate-100',  icon: <CheckCircle2 size={12} /> },
};

type View = 'list' | 'new' | 'detail';

interface Ticket {
  id: string;
  ticket_id?: string;
  ticket_number?: number;
  category: string;
  subject: string;
  description: string;
  message: string;
  status: string;
  admin_response?: string;
  request_id?: string;
  created_at: string;
  care_requests?: { atd_id?: string; care_type?: string };
}

export default function SupportCenterPage({ onBack }: SupportCenterPageProps) {
  const { profile } = useAuth();
  const [view, setView] = useState<View>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState({
    category: '',
    subject: '',
    message: '',
    request_id: '',
  });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  const fetchTickets = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*, care_requests(atd_id, care_type)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, [profile]);

  useEffect(() => {
    if (view !== 'new' || !profile) return;
    // Load recent requests for the user to link
    const loadRequests = async () => {
      const table = profile.user_type === 'caregiver' ? 'caregivers' : 'patients';
      const { data: profileRow } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!profileRow) return;
      const filterCol = profile.user_type === 'caregiver' ? 'caregiver_id' : 'patient_id';
      const { data } = await supabase
        .from('care_requests')
        .select('id, atd_id, care_type, status, scheduled_at')
        .eq(filterCol, profileRow.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentRequests(data || []);
    };
    loadRequests();
  }, [view, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.category) { setError('Selecione uma categoria.'); return; }
    if (!form.subject.trim()) { setError('Informe o assunto.'); return; }
    if (!form.message.trim()) { setError('Descreva o problema.'); return; }

    setSubmitting(true);
    setError('');

    const { error: err } = await supabase.from('support_tickets').insert({
      user_id: profile.id,
      category: form.category,
      subject: form.subject.trim(),
      description: form.message.trim(),
      message: form.message.trim(),
      status: 'open',
      priority: 'normal',
      request_id: form.request_id || null,
    });

    if (err) {
      setError('Erro ao abrir chamado. Tente novamente.');
      setSubmitting(false);
      return;
    }

    setForm({ category: '', subject: '', message: '', request_id: '' });
    setSubmitting(false);
    await fetchTickets();
    setView('list');
  };

  const openDetail = async (ticket: Ticket) => {
    // Refresh ticket to get latest admin_response
    const { data } = await supabase
      .from('support_tickets')
      .select('*, care_requests(atd_id, care_type)')
      .eq('id', ticket.id)
      .maybeSingle();
    setSelected(data || ticket);
    setView('detail');
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const getCategoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;
  const getCategoryColor = (val: string) => CATEGORIES.find(c => c.value === val)?.color || 'bg-slate-100 text-slate-600';

  // ── Detail view ────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const st = STATUS_CONFIG[selected.status] || STATUS_CONFIG.open;
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <button onClick={() => { setSelected(null); setView('list'); }} className="flex items-center gap-2 text-slate-600 mb-2">
          <ArrowLeft size={20} />
          <span className="font-semibold">Meus Chamados</span>
        </button>

        {/* Ticket header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {selected.ticket_id && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Hash size={10} />{selected.ticket_id}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                  {st.icon}{st.label}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 mt-2 leading-tight">{selected.subject}</h3>
            </div>
          </div>
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-lg ${getCategoryColor(selected.category)}`}>
            {getCategoryLabel(selected.category)}
          </span>
          <p className="text-xs text-slate-400">{fmtDate(selected.created_at)}</p>
          {selected.care_requests?.atd_id && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
              <span className="text-xs text-slate-500">Atendimento vinculado:</span>
              <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                {selected.care_requests.atd_id}
              </span>
              <span className="text-xs text-slate-400">{selected.care_requests.care_type}</span>
            </div>
          )}
        </div>

        {/* Message */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-2">Sua mensagem</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.message || selected.description}</p>
        </div>

        {/* Admin response */}
        {selected.admin_response ? (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <MessageSquare size={12} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-blue-700">Resposta do Suporte</p>
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">{selected.admin_response}</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <Clock size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Aguardando análise</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Nossa equipe entrará em contato pelo telefone ou e-mail cadastrado em breve.
              </p>
              <p className="text-xs text-amber-500 mt-1 font-medium">
                {profile?.phone && `Tel: ${profile.phone}`}
                {profile?.phone && profile?.email && ' · '}
                {profile?.email}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── New ticket form ────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <button onClick={() => { setView('list'); setError(''); }} className="flex items-center gap-2 text-slate-600 mb-2">
          <ArrowLeft size={20} />
          <span className="font-semibold">Abrir Chamado</span>
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="font-semibold text-slate-700 text-sm">Categoria do Problema</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, category: cat.value })); setError(''); }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium text-left transition-all border-2 ${
                    form.category === cat.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="font-semibold text-slate-700 text-sm">Assunto</p>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={form.subject}
                onChange={e => { setForm(f => ({ ...f, subject: e.target.value })); setError(''); }}
                placeholder="Resumo do problema..."
                maxLength={100}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Message */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="font-semibold text-slate-700 text-sm">Descrição do Problema</p>
            </div>
            <div className="p-4">
              <textarea
                value={form.message}
                onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setError(''); }}
                placeholder="Descreva detalhadamente o problema que está enfrentando..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Link to request (optional) */}
          {recentRequests.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="font-semibold text-slate-700 text-sm">Atendimento Relacionado <span className="text-slate-400 font-normal">(opcional)</span></p>
              </div>
              <div className="p-4">
                <div className="relative">
                  <select
                    value={form.request_id}
                    onChange={e => setForm(f => ({ ...f, request_id: e.target.value }))}
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-slate-900 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Nenhum atendimento</option>
                    {recentRequests.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.atd_id} — {r.care_type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Auto-filled info notice */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500">
            Seus dados serão enviados automaticamente: <span className="font-medium text-slate-700">{profile?.full_name}</span> · {profile?.email}{profile?.phone ? ` · ${profile.phone}` : ''}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Send size={16} />
                Enviar Chamado
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // ── Ticket list ────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600">
          <ArrowLeft size={20} />
          <span className="font-semibold">Central de Suporte</span>
        </button>
        <button
          onClick={() => { setView('new'); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
        >
          <Plus size={15} />
          Novo Chamado
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <MessageSquare size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Como funciona o suporte?</p>
          <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
            Abra um chamado e nossa equipe entrará em contato pelo seu telefone ou e-mail cadastrado.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={24} className="text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-700">Nenhum chamado aberto</h3>
          <p className="text-sm text-slate-400 mt-1">Precisa de ajuda? Abra um chamado.</p>
          <button
            onClick={() => setView('new')}
            className="mt-5 bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            Abrir Chamado
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            return (
              <button
                key={ticket.id}
                onClick={() => openDetail(ticket)}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {ticket.ticket_id && (
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-md">
                          <Hash size={8} />{ticket.ticket_id}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                        {st.icon}{st.label}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{ticket.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ticket.message || ticket.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${getCategoryColor(ticket.category)}`}>
                      {getCategoryLabel(ticket.category)}
                    </span>
                    {ticket.care_requests?.atd_id && (
                      <span className="font-mono text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                        {ticket.care_requests.atd_id}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{fmtDate(ticket.created_at)}</p>
                  <div className="flex items-center gap-1 text-blue-500">
                    {ticket.admin_response && (
                      <span className="text-[10px] font-medium text-green-600">Respondido</span>
                    )}
                    <ChevronRight size={14} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
