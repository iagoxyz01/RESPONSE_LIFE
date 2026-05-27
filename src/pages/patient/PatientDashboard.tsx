import { useState, useEffect } from 'react';
import { Plus, Clock, MapPin, Star, ChevronRight, Activity, CheckCircle, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CareRequest } from '../../lib/supabase';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  searching: { label: 'Procurando cuidador', color: 'text-amber-700', bg: 'bg-amber-50' },
  awaiting_approval: { label: 'Aguardando aprovação', color: 'text-blue-700', bg: 'bg-blue-50' },
  scheduled: { label: 'Agendado', color: 'text-green-700', bg: 'bg-green-50' },
  in_progress: { label: 'Em andamento', color: 'text-blue-700', bg: 'bg-blue-50' },
  awaiting_payment: { label: 'Aguardando pagamento', color: 'text-orange-700', bg: 'bg-orange-50' },
  completed: { label: 'Finalizado', color: 'text-slate-600', bg: 'bg-slate-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bg: 'bg-red-50' },
};

interface PatientDashboardProps {
  onNewRequest: () => void;
  onViewRequest: (id: string) => void;
}

export default function PatientDashboard({ onNewRequest, onViewRequest }: PatientDashboardProps) {
  const { profile, patient } = useAuth();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient) return;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from('care_requests')
        .select('*, caregivers(*, profiles(full_name, avatar_url))')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setRequests(data || []);
      setLoading(false);
    };

    fetchRequests();

    const channel = supabase
      .channel(`patient_requests:${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
          filter: `patient_id=eq.${patient.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRequests(prev =>
              prev.map(r => r.id === (payload.new as CareRequest).id ? { ...r, ...(payload.new as CareRequest) } : r)
            );
          } else {
            fetchRequests();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [patient]);

  const active = requests.filter(r => !['completed', 'cancelled'].includes(r.status));
  const completed = requests.filter(r => r.status === 'completed').length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-600/20">
        <p className="text-blue-200 text-sm">Olá,</p>
        <h2 className="text-xl font-bold mt-0.5">{profile?.full_name?.split(' ')[0] || 'Usuário'}</h2>
        <p className="text-blue-200 text-sm mt-1">Como podemos ajudar hoje?</p>
        <button
          onClick={onNewRequest}
          className="mt-4 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Solicitar Atendimento
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
            <Activity size={16} className="text-blue-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">{active.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Ativos</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
            <CheckCircle size={16} className="text-green-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">{completed}</p>
          <p className="text-xs text-slate-500 mt-0.5">Concluídos</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mb-2">
            <Star size={16} className="text-amber-500" />
          </div>
          <p className="text-xl font-bold text-slate-900">{patient?.avg_rating?.toFixed(1) || '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">Nota</p>
        </div>
      </div>

      {/* Active requests */}
      {active.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Atendimentos Ativos</h3>
          <div className="space-y-3">
            {active.map(req => {
              const s = STATUS_LABELS[req.status] || STATUS_LABELS.searching;
              return (
                <button
                  key={req.id}
                  onClick={() => onViewRequest(req.id)}
                  className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{req.care_type}</p>
                      <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                        <Clock size={11} />
                        <span>{formatDate(req.scheduled_at)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-500 text-xs">
                      <MapPin size={11} />
                      <span className="truncate max-w-[160px]">{req.location_address}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-600">
                      <span className="text-xs font-semibold">R$ {req.proposed_value.toFixed(2)}</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                  {req.status === 'searching' && (
                    <div className="mt-3 flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-lg px-3 py-2">
                      <Search size={12} className="animate-pulse" />
                      <span>Buscando cuidadores próximos...</span>
                    </div>
                  )}
                  {req.status === 'awaiting_approval' && (
                    <div className="mt-3 flex items-center gap-2 text-blue-600 text-xs bg-blue-50 rounded-lg px-3 py-2">
                      <AlertCircle size={12} />
                      <span>Cuidadores interessados! Toque para ver.</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent completed */}
      {requests.filter(r => r.status === 'completed').slice(0, 3).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recentes</h3>
          <div className="space-y-2">
            {requests.filter(r => r.status === 'completed').slice(0, 3).map(req => (
              <button
                key={req.id}
                onClick={() => onViewRequest(req.id)}
                className="w-full bg-white rounded-xl p-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800 text-sm">{req.care_type}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(req.scheduled_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">R$ {req.proposed_value.toFixed(2)}</span>
                  <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Concluído</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus size={28} className="text-blue-400" />
          </div>
          <h3 className="text-slate-700 font-semibold">Nenhum atendimento ainda</h3>
          <p className="text-slate-500 text-sm mt-1">Solicite seu primeiro atendimento</p>
          <button
            onClick={onNewRequest}
            className="mt-5 bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Solicitar Atendimento
          </button>
        </div>
      )}
    </div>
  );
}
