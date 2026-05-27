import { useState, useEffect } from 'react';
import { Star, Eye, CheckCircle, XCircle, PauseCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-500/20 text-emerald-300',
  busy: 'bg-amber-500/20 text-amber-300',
  offline: 'bg-slate-500/20 text-slate-300',
  suspended: 'bg-red-500/20 text-red-300',
};

export default function CaregiversPage({ admin: _admin }: Props) {
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const load = async (p = page) => {
    setLoading(true);
    const res = await api.caregivers.list(p);
    if (!res.error) { setCaregivers(res.caregivers || []); setTotal(res.total || 0); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({ loading: true });
    const res = await api.caregivers.get(id);
    if (!res.error) setDetail(res);
    else setDetail(null);
    setDetailLoading(false);
  };

  const handleAction = async (id: string, action: string, userId?: string) => {
    setActionLoading(id + action);
    await api.caregivers.action(id, action, userId ? { user_id: userId } : {});
    load();
    if (detail?.caregiver?.id === id) openDetail(id);
    setActionLoading(null);
  };

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setExpandedPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full"><X size={20} className="text-white" /></button>
          <img src={expandedPhoto} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto z-10 p-6 space-y-5">
            {detail.loading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg">Cuidador</h3>
                  <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                    {detail.caregiver?.profiles?.avatar_url
                      ? <img src={detail.caregiver.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      : detail.caregiver?.profiles?.full_name?.[0]}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{detail.caregiver?.profiles?.full_name}</p>
                    <p className="text-slate-400 text-sm">{detail.caregiver?.profiles?.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < Math.floor(detail.caregiver?.avg_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
                      ))}
                      <span className="text-slate-400 text-xs ml-1">{(detail.caregiver?.avg_rating || 0).toFixed(1)} ({detail.caregiver?.total_ratings || 0})</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500 text-xs">Atendimentos</p><p className="text-white font-semibold">{detail.caregiver?.total_services || 0}</p></div>
                  <div><p className="text-slate-500 text-xs">Status</p><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[detail.caregiver?.status] || ''}`}>{detail.caregiver?.status}</span></div>
                  <div><p className="text-slate-500 text-xs">Saldo</p><p className="text-emerald-400 font-semibold">R$ {(detail.caregiver?.available_balance || 0).toFixed(2)}</p></div>
                  <div><p className="text-slate-500 text-xs">CPF</p><p className="text-slate-300 text-xs">{detail.caregiver?.cpf || '—'}</p></div>
                </div>

                {/* Identity verification */}
                {detail.verification && (
                  <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-300 font-semibold text-sm">Verificação de Identidade</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        detail.verification.status === 'verified' ? 'bg-emerald-500/20 text-emerald-300' :
                        detail.verification.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>{detail.verification.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['rg_url','cpf_url','selfie_url'].map(k => detail.verification[k] && (
                        <button key={k} onClick={() => setExpandedPhoto(detail.verification[k])} className="aspect-square rounded-lg overflow-hidden bg-slate-700">
                          <img src={detail.verification[k]} alt={k} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monitoring photos */}
                {detail.photos?.length > 0 && (
                  <div>
                    <p className="text-slate-300 font-semibold text-sm mb-3">Fotos de Atendimentos ({detail.photos.length})</p>
                    <div className="grid grid-cols-4 gap-2">
                      {detail.photos.slice(0, 8).map((p: any) => (
                        <button key={p.id} onClick={() => setExpandedPhoto(p.photo_url)} className="aspect-square rounded-lg overflow-hidden bg-slate-700">
                          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ratings */}
                {detail.ratings?.length > 0 && (
                  <div>
                    <p className="text-slate-300 font-semibold text-sm mb-3">Avaliações</p>
                    <div className="space-y-2">
                      {detail.ratings.slice(0, 3).map((r: any) => (
                        <div key={r.id} className="bg-slate-800/50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex">{Array.from({ length: r.score }).map((_, i) => <Star key={i} size={11} className="text-amber-400 fill-amber-400" />)}</div>
                            <span className="text-slate-500 text-[10px]">{r.profiles?.full_name}</span>
                          </div>
                          {r.comment && <p className="text-slate-300 text-xs">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  <button onClick={() => handleAction(detail.caregiver.id, 'approve', detail.caregiver.user_id)} disabled={!!actionLoading} className="py-2.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1.5">
                    <CheckCircle size={13} /> Aprovar
                  </button>
                  <button onClick={() => handleAction(detail.caregiver.id, 'suspend')} disabled={!!actionLoading} className="py-2.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1.5">
                    <PauseCircle size={13} /> Suspender
                  </button>
                  <button onClick={() => handleAction(detail.caregiver.id, 'reject')} disabled={!!actionLoading} className="py-2.5 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5">
                    <XCircle size={13} /> Rejeitar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold">Cuidadores <span className="text-slate-500 font-normal text-sm ml-1">({total})</span></h2>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">Cuidador</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Avaliação</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5 hidden md:table-cell">Atendimentos</th>
                <th className="text-left text-slate-500 text-xs font-medium px-5 py-3.5">Status</th>
                <th className="text-right text-slate-500 text-xs font-medium px-5 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td colSpan={5} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                </tr>
              )) : caregivers.map(cg => (
                <tr key={cg.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                        {cg.profiles?.avatar_url ? <img src={cg.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : cg.profiles?.full_name?.[0]}
                      </div>
                      <div>
                        <p className="text-slate-200 text-sm font-medium">{cg.profiles?.full_name}</p>
                        <p className="text-slate-500 text-xs">{cg.profiles?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-slate-300 text-sm">{(cg.avg_rating || 0).toFixed(1)}</span>
                      <span className="text-slate-600 text-xs">({cg.total_ratings || 0})</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-slate-300 text-sm">{cg.total_services || 0}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[cg.status] || 'bg-slate-700 text-slate-400'}`}>
                      {cg.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => openDetail(cg.id)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800">
                      <Eye size={15} />
                    </button>
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
              <button onClick={() => { const p = page-1; setPage(p); load(p); }} disabled={page===1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800"><ChevronLeft size={16} /></button>
              <button onClick={() => { const p = page+1; setPage(p); load(p); }} disabled={page>=totalPages} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
