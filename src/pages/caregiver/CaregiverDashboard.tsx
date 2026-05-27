import { useState, useEffect } from 'react';
import { Clock, MapPin, DollarSign, Star, CheckCircle, XCircle, Activity, TrendingUp, ChevronRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CareRequest, Profile } from '../../lib/supabase';

interface CaregiverDashboardProps {
  onViewRequest: (id: string) => void;
}

export default function CaregiverDashboard({ onViewRequest }: CaregiverDashboardProps) {
  const { profile, caregiver, refreshProfile } = useAuth();
  const [openRequests, setOpenRequests] = useState<CareRequest[]>([]);
  const [myRequests, setMyRequests] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    if (!caregiver) return;

    // Fetch open requests (searching or awaiting_approval that this caregiver hasn't acted on)
    const { data: open } = await supabase
      .from('care_requests')
      .select('*, patients(*, profiles(*))')
      .in('status', ['searching', 'awaiting_approval'])
      .order('created_at', { ascending: false })
      .limit(20);

    const filtered = (open || []).filter(r => {
      // Hide if this caregiver already rejected
      if ((r.rejected_caregivers || []).includes(caregiver.id)) return false;
      // Hide if this caregiver already accepted (will show in "my requests")
      if ((r.interested_caregivers || []).includes(caregiver.id)) return false;
      // Hide if another caregiver was already chosen
      if (r.caregiver_id && r.caregiver_id !== caregiver.id) return false;
      return true;
    });
    setOpenRequests(filtered);

    // Fetch my accepted/active requests
    const { data: mine } = await supabase
      .from('care_requests')
      .select('*, patients(*, profiles(*))')
      .or(`caregiver_id.eq.${caregiver.id},interested_caregivers.cs.{${caregiver.id}}`)
      .not('status', 'in', '("completed","cancelled")')
      .order('scheduled_at', { ascending: true });
    setMyRequests(mine || []);

    setLoading(false);
  };

  useEffect(() => {
    if (!caregiver) return;
    fetchData();
    const sub = supabase
      .channel('caregiver_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_requests' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'caregivers', filter: `id=eq.${caregiver.id}` }, () => refreshProfile())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [caregiver]);

  const handleAccept = async (requestId: string) => {
    if (!caregiver) return;
    setActionLoading(requestId + '_accept');
    setError('');
    const req = openRequests.find(r => r.id === requestId);
    if (!req) { setActionLoading(null); return; }
    const current = req.interested_caregivers || [];

    const { error: updateError } = await supabase
      .from('care_requests')
      .update({
        interested_caregivers: [...current, caregiver.id],
        status: 'awaiting_approval',
      })
      .eq('id', requestId);

    if (updateError) {
      setError('Erro ao aceitar solicitação. Tente novamente.');
      console.error('Accept error:', updateError);
    } else {
      await fetchData();
    }
    setActionLoading(null);
  };

  const handleReject = async (requestId: string) => {
    if (!caregiver) return;
    setActionLoading(requestId + '_reject');
    setError('');
    const req = openRequests.find(r => r.id === requestId);
    if (!req) { setActionLoading(null); return; }
    const current = req.rejected_caregivers || [];

    const { error: updateError } = await supabase
      .from('care_requests')
      .update({ rejected_caregivers: [...current, caregiver.id] })
      .eq('id', requestId);

    if (updateError) {
      setError('Erro ao recusar. Tente novamente.');
      console.error('Reject error:', updateError);
    } else {
      setOpenRequests(prev => prev.filter(r => r.id !== requestId));
    }
    setActionLoading(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  const STATUS_COLORS: Record<string, string> = {
    awaiting_approval: 'text-blue-700 bg-blue-50',
    scheduled: 'text-green-700 bg-green-50',
    in_progress: 'text-blue-700 bg-blue-50',
    awaiting_payment: 'text-orange-700 bg-orange-50',
  };

  const STATUS_LABELS: Record<string, string> = {
    awaiting_approval: 'Aguardando',
    scheduled: 'Agendado',
    in_progress: 'Em andamento',
    awaiting_payment: 'Pagamento',
  };

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {/* Welcome card */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg shadow-emerald-600/20">
        <p className="text-emerald-200 text-sm">Olá,</p>
        <h2 className="text-xl font-bold mt-0.5">{profile?.full_name?.split(' ')[0] || 'Cuidador'}</h2>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-white/15 rounded-lg px-3 py-1.5">
            <p className="text-[11px] text-emerald-200">Saldo disponível</p>
            <p className="font-bold text-sm">R$ {caregiver?.available_balance?.toFixed(2) || '0,00'}</p>
          </div>
          <div className="bg-white/15 rounded-lg px-3 py-1.5">
            <p className="text-[11px] text-emerald-200">Avaliação</p>
            <div className="flex items-center gap-1">
              <Star size={12} className="text-amber-300 fill-amber-300" />
              <p className="font-bold text-sm">{caregiver?.avg_rating?.toFixed(1) || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-2">
            <Activity size={16} className="text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">{myRequests.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Ativos</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
            <CheckCircle size={16} className="text-blue-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">{caregiver?.total_services || 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Concluídos</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mb-2">
            <TrendingUp size={16} className="text-amber-500" />
          </div>
          <p className="text-xl font-bold text-slate-900">{openRequests.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Disponíveis</p>
        </div>
      </div>

      {/* My active requests */}
      {myRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Meus Atendimentos</h3>
          <div className="space-y-3">
            {myRequests.map(req => {
              const patient = req.patients as unknown as { profiles: Profile };
              return (
                <button
                  key={req.id}
                  onClick={() => onViewRequest(req.id)}
                  className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{req.care_type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {patient?.profiles?.full_name || 'Paciente'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[req.status] || 'text-slate-600 bg-slate-100'}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock size={11} />
                      <span>{formatDate(req.scheduled_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <span>R$ {(req.proposed_value * 0.925).toFixed(2)}</span>
                      <ChevronRight size={13} />
                    </div>
                  </div>
                  {req.status === 'in_progress' && (
                    <div className="mt-2 flex items-center gap-2 text-green-700 text-xs bg-green-50 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Atendimento em andamento</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Open requests */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Solicitações Disponíveis
          {openRequests.length > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{openRequests.length}</span>
          )}
        </h3>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && openRequests.length === 0 && (
          <div className="text-center py-8 bg-white rounded-2xl border border-slate-100">
            <p className="text-slate-500 text-sm">Nenhuma solicitação disponível agora</p>
            <p className="text-slate-400 text-xs mt-1">Aguarde novas solicitações na sua área</p>
          </div>
        )}

        <div className="space-y-3">
          {openRequests.map(req => {
            const patient = req.patients as unknown as { profiles: Profile };
            return (
              <div key={req.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{req.care_type}</p>
                    <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                      <Clock size={11} />
                      <span>{formatDate(req.scheduled_at)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">R$ {(req.proposed_value * 0.925).toFixed(2)}</p>
                    <p className="text-xs text-slate-400">{req.duration_minutes / 60}h de duração</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <MapPin size={11} />
                  <span className="truncate">{req.location_address}</span>
                </div>

                {req.observations && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs text-slate-600 line-clamp-2">{req.observations}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={!!actionLoading}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <XCircle size={15} />
                    Recusar
                  </button>
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={!!actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {actionLoading === req.id + '_accept' ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle size={15} />
                        Aceitar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
