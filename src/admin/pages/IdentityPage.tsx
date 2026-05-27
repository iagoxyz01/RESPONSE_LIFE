import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Eye, X, ShieldCheck } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const STATUS_TABS = ['pending', 'in_analysis', 'verified', 'rejected'];
const STATUS_LABELS: Record<string, string> = { pending: 'Pendente', in_analysis: 'Em análise', verified: 'Verificado', rejected: 'Rejeitado' };
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300',
  in_analysis: 'bg-blue-500/20 text-blue-300',
  verified: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
};

export default function IdentityPage({ admin: _admin }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState<any>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const load = async (s = statusFilter) => {
    setLoading(true);
    const res = await api.identity.list(s);
    if (!res.error) setItems(res.verifications || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id + action);
    await api.identity.action(id, action, action === 'reject' ? rejectionReason : undefined);
    load();
    setSelected(null);
    setRejectionReason('');
    setShowRejectForm(false);
    setActionLoading(null);
  };

  return (
    <div className="space-y-4">
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setExpandedPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full"><X size={20} className="text-white" /></button>
          <img src={expandedPhoto} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setSelected(null); setShowRejectForm(false); }} />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto z-10 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">Verificação de Identidade</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                {selected.caregivers?.profiles?.avatar_url
                  ? <img src={selected.caregivers.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  : selected.caregivers?.profiles?.full_name?.[0]}
              </div>
              <div>
                <p className="text-white font-semibold">{selected.caregivers?.profiles?.full_name}</p>
                <p className="text-slate-400 text-sm">{selected.caregivers?.profiles?.email}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
              </div>
            </div>

            {selected.cpf_number && (
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-slate-500 text-xs">CPF</p>
                <p className="text-slate-200 font-mono">{selected.cpf_number}</p>
              </div>
            )}

            {/* Documents */}
            <div className="space-y-3">
              {[
                { key: 'rg_url', label: 'RG' },
                { key: 'cpf_url', label: 'CPF (Documento)' },
                { key: 'selfie_url', label: 'Selfie' },
              ].map(doc => selected[doc.key] && (
                <div key={doc.key}>
                  <p className="text-slate-400 text-xs mb-2">{doc.label}</p>
                  <button onClick={() => setExpandedPhoto(selected[doc.key])} className="w-full rounded-xl overflow-hidden bg-slate-800 aspect-video">
                    <img src={selected[doc.key]} alt={doc.label} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </button>
                </div>
              ))}
            </div>

            {selected.rejection_reason && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-300 text-xs font-medium">Motivo da rejeição:</p>
                <p className="text-red-200 text-sm mt-1">{selected.rejection_reason}</p>
              </div>
            )}

            {showRejectForm && (
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Motivo da rejeição</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            )}

            {['pending', 'in_analysis'].includes(selected.status) && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleAction(selected.id, 'analyze')} disabled={!!actionLoading}
                    className="py-2.5 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20 text-sm font-medium hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1.5">
                    <Eye size={13} /> Em Análise
                  </button>
                  <button onClick={() => handleAction(selected.id, 'approve')} disabled={!!actionLoading}
                    className="py-2.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1.5">
                    <CheckCircle size={13} /> Aprovar
                  </button>
                </div>
                {!showRejectForm ? (
                  <button onClick={() => setShowRejectForm(true)}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5">
                    <XCircle size={13} /> Rejeitar
                  </button>
                ) : (
                  <button onClick={() => handleAction(selected.id, 'reject')} disabled={!rejectionReason || !!actionLoading}
                    className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
                    <XCircle size={13} /> Confirmar Rejeição
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold">Verificação de Identidade</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <ShieldCheck size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma verificação com status "{STATUS_LABELS[statusFilter]}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white font-bold overflow-hidden">
                    {item.caregivers?.profiles?.avatar_url
                      ? <img src={item.caregivers.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      : item.caregivers?.profiles?.full_name?.[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{item.caregivers?.profiles?.full_name}</p>
                    <p className="text-slate-500 text-xs">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                {item.rg_url && <span className="bg-slate-800 px-2 py-1 rounded-lg">RG</span>}
                {item.cpf_url && <span className="bg-slate-800 px-2 py-1 rounded-lg">CPF</span>}
                {item.selfie_url && <span className="bg-slate-800 px-2 py-1 rounded-lg">Selfie</span>}
              </div>
              <button onClick={() => { setSelected(item); setShowRejectForm(false); }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Eye size={14} /> Analisar Documentos
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
