import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Clock, MapPin, X, CheckCircle, Loader2 } from 'lucide-react';
import { supabase, MonitoringPhoto } from '../lib/supabase';

interface MonitoringHistoryPageProps {
  requestId: string;
  onBack: () => void;
}

type PhotoSection = { label: string; type: string; photos: MonitoringPhoto[] };

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em Andamento',
  awaiting_payment: 'Aguardando Pagamento',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

export default function MonitoringHistoryPage({ requestId, onBack }: MonitoringHistoryPageProps) {
  const [photos, setPhotos] = useState<MonitoringPhoto[]>([]);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: req }, { data: ph }] = await Promise.all([
        supabase
          .from('care_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle(),
        supabase
          .from('monitoring_photos')
          .select('*')
          .eq('request_id', requestId)
          .order('taken_at', { ascending: true }),
      ]);
      setRequest(req);
      setPhotos((ph || []) as MonitoringPhoto[]);
      setLoading(false);
    };
    load();
  }, [requestId]);

  const sections: PhotoSection[] = [
    { label: 'Foto de Chegada', type: 'start', photos: photos.filter(p => p.photo_type === 'start') },
    { label: 'Fotos Intermediárias', type: 'periodic', photos: photos.filter(p => p.photo_type === 'periodic') },
    { label: 'Foto de Encerramento', type: 'end', photos: photos.filter(p => p.photo_type === 'end') },
  ].filter(s => s.photos.length > 0);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

  const sectionColor: Record<string, string> = {
    start: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    periodic: 'bg-blue-50 border-blue-200 text-blue-700',
    end: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Expanded photo modal */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setExpanded(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full">
            <X size={22} className="text-white" />
          </button>
          <img src={expanded} alt="Foto ampliada" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Voltar</span>
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Camera size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900">Histórico de Monitoramento</h1>
          <p className="text-xs text-slate-500">{photos.length} fotos registradas</p>
        </div>
      </div>

      {/* Request summary */}
      {request && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900 text-sm">{request.care_type}</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              request.status === 'completed' ? 'bg-green-100 text-green-700' :
              request.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {STATUS_LABELS[request.status] || request.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} />
            <span>{formatDateTime(request.scheduled_at)}</span>
          </div>
          {request.location_address && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin size={12} />
              <span className="truncate">{request.location_address}</span>
            </div>
          )}
          {request.actual_start_at && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle size={12} />
              <span>Iniciado às {new Date(request.actual_start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          {request.actual_end_at && (
            <div className="flex items-center gap-2 text-xs text-orange-600">
              <CheckCircle size={12} />
              <span>Encerrado às {new Date(request.actual_end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <Camera size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Nenhuma foto registrada</p>
          <p className="text-sm text-slate-400 mt-1">As fotos aparecerão aqui durante o atendimento</p>
        </div>
      ) : (
        sections.map(section => (
          <div key={section.type}>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold mb-3 ${sectionColor[section.type]}`}>
              <Camera size={12} />
              {section.label} ({section.photos.length})
            </div>
            <div className="grid grid-cols-2 gap-3">
              {section.photos.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => setExpanded(photo.photo_url)}
                  className="rounded-2xl overflow-hidden bg-slate-100 relative aspect-[4/3] group"
                >
                  <img
                    src={photo.photo_url}
                    alt={section.label}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
                    <p className="text-white text-xs font-medium">
                      {new Date(photo.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-white/70 text-[10px]">
                      {new Date(photo.taken_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                    {photo.latitude && (
                      <p className="text-white/50 text-[10px] flex items-center gap-0.5 mt-0.5">
                        <MapPin size={8} />
                        GPS registrado
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
