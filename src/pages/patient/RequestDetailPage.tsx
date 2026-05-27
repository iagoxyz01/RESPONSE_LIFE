import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Clock, Camera, MessageCircle, CheckCircle, X, DollarSign, Briefcase, Shield, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CareRequest, MonitoringPhoto } from '../../lib/supabase';

interface RequestDetailPageProps {
  requestId: string;
  onBack: () => void;
  onOpenChat: (requestId: string) => void;
  onOpenMonitoring: (requestId: string) => void;
  onOpenPayment: (requestId: string) => void;
  onRate: (requestId: string) => void;
}

interface CaregiverCandidate {
  id: string;
  user_id: string;
  cpf: string;
  bio: string;
  experience_years: number;
  avg_rating: number;
  total_ratings: number;
  total_services: number;
  status: string;
  profiles: {
    full_name: string;
    avatar_url: string;
    phone: string;
  };
  caregiver_specialties: { specialties: { name: string } }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  searching: { label: 'Procurando Cuidador', color: 'text-amber-700', bg: 'bg-amber-50' },
  awaiting_approval: { label: 'Cuidadores Interessados', color: 'text-blue-700', bg: 'bg-blue-50' },
  scheduled: { label: 'Agendado', color: 'text-green-700', bg: 'bg-green-50' },
  in_progress: { label: 'Em Andamento', color: 'text-blue-700', bg: 'bg-blue-50' },
  awaiting_payment: { label: 'Aguardando Pagamento', color: 'text-orange-700', bg: 'bg-orange-50' },
  completed: { label: 'Finalizado', color: 'text-slate-600', bg: 'bg-slate-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bg: 'bg-red-50' },
};

export default function RequestDetailPage({ requestId, onBack, onOpenChat, onOpenMonitoring, onOpenPayment, onRate }: RequestDetailPageProps) {
  const { profile } = useAuth();
  const [request, setRequest] = useState<CareRequest | null>(null);
  const [candidates, setCandidates] = useState<CaregiverCandidate[]>([]);
  const [photos, setPhotos] = useState<MonitoringPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: req, error: reqError } = await supabase
      .from('care_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (reqError) {
      console.error('Fetch request error:', reqError);
      setLoading(false);
      return;
    }
    setRequest(req);

    // Fetch caregiver candidates from interested_caregivers array
    if (req?.interested_caregivers?.length) {
      const rejectedIds = req.rejected_caregivers || [];
      const candidateIds = req.interested_caregivers.filter(
        (id: string) => !rejectedIds.includes(id)
      );

      if (candidateIds.length > 0) {
        const { data: cgs, error: cgsError } = await supabase
          .from('caregivers')
          .select('*, profiles(full_name, avatar_url, phone), caregiver_specialties(specialties(name))')
          .in('id', candidateIds);

        if (cgsError) {
          console.error('Fetch candidates error:', cgsError);
        } else {
          setCandidates(cgs || []);
        }
      } else {
        setCandidates([]);
      }
    } else {
      setCandidates([]);
    }

    // Fetch monitoring photos
    const { data: ph } = await supabase
      .from('monitoring_photos')
      .select('*')
      .eq('request_id', requestId)
      .order('taken_at', { ascending: false });
    setPhotos(ph || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`request_detail:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'care_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const updated = payload.new as CareRequest;
          setRequest(prev => prev ? { ...prev, ...updated } : updated);
          // Se o status mudou para scheduled/in_progress, rebuscar candidatos também
          if (['scheduled', 'in_progress', 'awaiting_payment', 'completed'].includes(updated.status)) {
            fetchData();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId]);

  const approveCaregiver = async (caregiverId: string) => {
    if (!profile) return;
    setActionLoading(caregiverId);
    setError('');

    const { error: updateError } = await supabase
      .from('care_requests')
      .update({ caregiver_id: caregiverId, status: 'scheduled' })
      .eq('id', requestId);

    if (updateError) {
      setError('Erro ao aprovar cuidador. Tente novamente.');
      console.error('Approve error:', updateError);
    } else {
      // Notify caregiver
      const { data: cg } = await supabase
        .from('caregivers')
        .select('user_id')
        .eq('id', caregiverId)
        .maybeSingle();

      if (cg) {
        await supabase.from('notifications').insert({
          user_id: cg.user_id,
          type: 'request_confirmed',
          title: 'Atendimento confirmado!',
          body: 'O paciente aprovou seu atendimento. Verifique os detalhes.',
          request_id: requestId,
        });
      }

      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'request_confirmed',
        title: 'Cuidador contratado',
        body: 'Atendimento confirmado. Chat liberado!',
        request_id: requestId,
      });

      await fetchData();
    }
    setActionLoading(null);
  };

  const rejectCaregiver = async (caregiverId: string) => {
    if (!request) return;
    setActionLoading(caregiverId + '_reject');
    setError('');

    const current = request.rejected_caregivers || [];
    const { error: updateError } = await supabase
      .from('care_requests')
      .update({ rejected_caregivers: [...current, caregiverId] })
      .eq('id', requestId);

    if (updateError) {
      setError('Erro ao recusar cuidador.');
      console.error('Reject error:', updateError);
    } else {
      setCandidates(prev => prev.filter(c => c.id !== caregiverId));
      await fetchData();
    }
    setActionLoading(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) return null;

  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.searching;
  const confirmedCaregiver = request.caregiver_id
    ? candidates.find(c => c.id === request.caregiver_id)
    : null;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2">
        <ArrowLeft size={20} />
        <span className="font-semibold">Detalhes do Atendimento</span>
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Status */}
      <div className={`rounded-2xl p-4 ${statusConfig.bg} border border-slate-100`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Status</p>
            <p className={`font-bold ${statusConfig.color}`}>{statusConfig.label}</p>
          </div>
          {request.status === 'in_progress' && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-700 text-xs font-medium">Ao vivo</span>
            </div>
          )}
          {request.status === 'searching' && (
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Request info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-slate-900">{request.care_type}</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-blue-500" />
            <span>{formatDate(request.scheduled_at)} — {request.duration_minutes / 60}h</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-blue-500" />
            <span>{request.location_address}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-blue-500" />
            <span className="font-semibold text-slate-800">R$ {request.proposed_value.toFixed(2)}</span>
          </div>
        </div>
        {request.observations && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Observações</p>
            <p className="text-sm text-slate-700 mt-0.5">{request.observations}</p>
          </div>
        )}
      </div>

      {/* === CAREGIVER CANDIDATES — Patient approval flow === */}
      {request.status === 'awaiting_approval' && candidates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Cuidadores Interessados</h3>
              <p className="text-xs text-slate-500">{candidates.length} cuidador(es) querem atender você</p>
            </div>
          </div>

          {candidates.map(cg => {
            const isSelected = selectedCandidate === cg.id;
            const specialties = cg.caregiver_specialties?.map(cs => cs.specialties?.name).filter(Boolean) || [];

            return (
              <div key={cg.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                isSelected ? 'border-blue-300 shadow-blue-100 shadow-md' : 'border-slate-100'
              }`}>
                {/* Candidate header — always visible */}
                <button
                  onClick={() => setSelectedCandidate(isSelected ? null : cg.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {cg.profiles?.full_name?.[0]?.toUpperCase() || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{cg.profiles?.full_name}</p>
                        <Shield size={14} className="text-green-500" />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={13}
                            className={i < Math.floor(cg.avg_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
                          />
                        ))}
                        <span className="text-xs text-slate-500 ml-1">
                          {(cg.avg_rating || 0).toFixed(1)} ({cg.total_ratings || 0})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Briefcase size={11} />
                          {cg.experience_years || 0} anos
                        </span>
                        <span className="flex items-center gap-1">
                          <Award size={11} />
                          {cg.total_services || 0} atendimentos
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded profile details */}
                {isSelected && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
                    {/* Bio */}
                    {cg.bio && (
                      <div className="pt-3">
                        <p className="text-xs text-slate-500 font-medium mb-1">Sobre</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{cg.bio}</p>
                      </div>
                    )}

                    {/* Specialties */}
                    {specialties.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-2">Especialidades</p>
                        <div className="flex flex-wrap gap-1.5">
                          {specialties.map(s => (
                            <span key={s} className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => rejectCaregiver(cg.id)}
                        disabled={actionLoading === cg.id + '_reject'}
                        className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {actionLoading === cg.id + '_reject' ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
                        ) : (
                          <>
                            <X size={16} />
                            Recusar
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => approveCaregiver(cg.id)}
                        disabled={actionLoading === cg.id}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-600/25"
                      >
                        {actionLoading === cg.id ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            Contratar Este Cuidador
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {request.status === 'awaiting_approval' && candidates.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <p className="text-slate-500 text-sm">Todos os cuidadores foram recusados. Aguardando novos interessados...</p>
        </div>
      )}

      {/* === CONFIRMED CAREGIVER — After approval === */}
      {confirmedCaregiver && ['scheduled', 'in_progress', 'awaiting_payment', 'completed'].includes(request.status) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
            <CheckCircle size={12} className="text-green-500" />
            Cuidador confirmado
          </p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {confirmedCaregiver.profiles?.full_name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{confirmedCaregiver.profiles?.full_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={11}
                    className={i < Math.floor(confirmedCaregiver.avg_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
                  />
                ))}
                <span className="text-xs text-slate-500 ml-1">{(confirmedCaregiver.avg_rating || 0).toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onOpenChat(requestId)}
              className="flex-1 py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={15} />
              Chat
            </button>
            {request.status === 'in_progress' && (
              <button
                onClick={() => onOpenMonitoring(requestId)}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Camera size={15} />
                Monitorar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Monitoring photos */}
      {photos.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-3">Fotos do Atendimento</h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100 relative">
                <img src={photo.photo_url} alt="Monitoramento" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 px-2">
                  <p className="text-white text-[9px]">
                    {new Date(photo.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment section */}
      {request.status === 'awaiting_payment' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <DollarSign size={28} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Pagamento Pendente</h3>
          <p className="text-slate-500 text-sm mt-1">Valor: <span className="font-bold text-slate-900">R$ {request.proposed_value.toFixed(2)}</span></p>
          <button
            onClick={() => {
              console.log('Payment button clicked, requestId:', requestId);
              onOpenPayment(requestId);
            }}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25"
          >
            Ir para Pagamento
          </button>
        </div>
      )}

      {/* Rating prompt */}
      {request.status === 'completed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <Star size={28} className="text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-slate-800">Como foi o atendimento?</p>
          <p className="text-sm text-slate-500 mt-1">Avalie o cuidador para ajudar outros pacientes</p>
          <button
            onClick={() => onRate(requestId)}
            className="mt-4 bg-amber-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
          >
            Avaliar Agora
          </button>
        </div>
      )}
    </div>
  );
}
