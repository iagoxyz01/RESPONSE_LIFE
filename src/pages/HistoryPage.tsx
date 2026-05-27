import { useState, useEffect } from 'react';
import { Clock, MapPin, Star, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, CareRequest, Profile } from '../lib/supabase';

interface HistoryPageProps {
  onViewRequest: (id: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Concluído', color: 'text-green-700 bg-green-50' },
  cancelled: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
  in_progress: { label: 'Em andamento', color: 'text-blue-700 bg-blue-50' },
  scheduled: { label: 'Agendado', color: 'text-green-700 bg-green-50' },
  awaiting_payment: { label: 'Aguardando pagamento', color: 'text-orange-700 bg-orange-50' },
  searching: { label: 'Buscando cuidador', color: 'text-amber-700 bg-amber-50' },
  awaiting_approval: { label: 'Aguardando aprovação', color: 'text-blue-700 bg-blue-50' },
};

export default function HistoryPage({ onViewRequest }: HistoryPageProps) {
  const { patient, caregiver, profile } = useAuth();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      let query = supabase
        .from('care_requests')
        .select('*, patients(*, profiles(*)), caregivers(*, profiles(*))')
        .order('created_at', { ascending: false })
        .limit(50);

      if (patient) {
        query = query.eq('patient_id', patient.id);
      } else if (caregiver) {
        query = query.eq('caregiver_id', caregiver.id);
      }

      const { data } = await query;
      setRequests(data || []);
      setLoading(false);
    };
    fetchHistory();
  }, [patient, caregiver]);

  const filtered = requests.filter(r => {
    if (filter === 'completed' && r.status !== 'completed') return false;
    if (filter === 'cancelled' && r.status !== 'cancelled') return false;
    if (search && !r.care_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Histórico</h2>
        <span className="text-sm text-slate-500">{filtered.length} registros</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por tipo de cuidado..."
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'completed', label: 'Concluídos' },
          { key: 'cancelled', label: 'Cancelados' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filter === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <Clock size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhum registro encontrado</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(req => {
          const s = STATUS_LABELS[req.status] || { label: req.status, color: 'text-slate-600 bg-slate-100' };
          const otherPartyProfile = profile?.user_type === 'caregiver'
            ? (req.patients as unknown as { profiles: Profile })?.profiles
            : (req.caregivers as unknown as { profiles: Profile })?.profiles;

          return (
            <button
              key={req.id}
              onClick={() => onViewRequest(req.id)}
              className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{req.care_type}</p>
                  {otherPartyProfile && (
                    <p className="text-xs text-slate-500 mt-0.5">{otherPartyProfile.full_name}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ml-2 flex-shrink-0 ${s.color}`}>
                  {s.label}
                </span>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock size={11} />
                  <span>{formatDate(req.scheduled_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} />
                  <span className="truncate max-w-[200px]">{req.location_address}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                <span className="text-sm font-semibold text-slate-700">
                  R$ {req.proposed_value.toFixed(2)}
                </span>
                <div className="flex items-center gap-1 text-blue-600">
                  <span className="text-xs">Ver detalhes</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
