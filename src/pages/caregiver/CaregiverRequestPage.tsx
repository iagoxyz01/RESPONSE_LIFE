import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, MapPin, Clock, MessageCircle, CheckCircle, AlertCircle, DollarSign, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CareRequest, Profile, MonitoringPhoto } from '../../lib/supabase';

interface CaregiverRequestPageProps {
  requestId: string;
  onBack: () => void;
  onOpenChat: (requestId: string) => void;
  onRate: (requestId: string) => void;
}

export default function CaregiverRequestPage({ requestId, onBack, onOpenChat, onRate }: CaregiverRequestPageProps) {
  const { caregiver } = useAuth();
  const [request, setRequest] = useState<CareRequest | null>(null);
  const [photos, setPhotos] = useState<MonitoringPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const fetchData = async () => {
    const { data: req } = await supabase
      .from('care_requests')
      .select('*, patients(*, profiles(*))')
      .eq('id', requestId)
      .maybeSingle();
    setRequest(req);

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
    const sub = supabase
      .channel(`caregiver_req_${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_requests', filter: `id=eq.${requestId}` }, fetchData)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [requestId]);

  const handleStartService = async () => {
    setActionLoading(true);
    await supabase
      .from('care_requests')
      .update({ status: 'in_progress', actual_start_at: new Date().toISOString() })
      .eq('id', requestId);
    await fetchData();
    setActionLoading(false);
  };

  const handleEndService = async () => {
    if (!request) return;
    setActionLoading(true);
    const startAt = request.actual_start_at ? new Date(request.actual_start_at) : new Date();
    const now = new Date();
    const actualMinutes = Math.floor((now.getTime() - startAt.getTime()) / 60000);
    await supabase
      .from('care_requests')
      .update({
        status: 'awaiting_payment',
        actual_end_at: now.toISOString(),
        actual_duration_minutes: actualMinutes,
      })
      .eq('id', requestId);
    await fetchData();
    setActionLoading(false);
  };

  const handleTakePhoto = async (photoType: 'start' | 'periodic' | 'end') => {
    if (!caregiver) return;
    setPhotoLoading(true);
    setPhotoError('');

    // Simulate camera capture with a placeholder photo URL
    // In a real app, this would use the device camera
    const mockPhotoUrl = `https://images.pexels.com/photos/5327584/pexels-photo-5327584.jpeg?auto=compress&cs=tinysrgb&w=400`;

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // GPS unavailable — proceed without it
    }

    const { error } = await supabase.from('monitoring_photos').insert({
      request_id: requestId,
      caregiver_id: caregiver.id,
      photo_url: mockPhotoUrl,
      latitude: lat,
      longitude: lng,
      photo_type: photoType,
      taken_at: new Date().toISOString(),
      metadata: { device: 'web', timestamp: Date.now() },
    });

    if (error) {
      setPhotoError('Erro ao enviar foto. Tente novamente.');
    } else {
      if (photoType === 'start' && request?.status === 'scheduled') {
        await handleStartService();
      }
      await fetchData();
    }
    setPhotoLoading(false);
  };

  const handleConfirmCashPayment = async () => {
    if (!request) return;
    setActionLoading(true);
    const gross = request.proposed_value;
    const fee = gross * 0.075;
    const net = gross - fee;

    await supabase.from('payments').insert({
      request_id: requestId,
      payment_method: 'cash',
      gross_amount: gross,
      platform_fee: fee,
      net_amount: net,
      status: 'completed',
      paid_at: new Date().toISOString(),
    });

    await supabase
      .from('care_requests')
      .update({ status: 'completed', final_value: gross })
      .eq('id', requestId);

    await supabase.from('pending_fees').insert({
      request_id: requestId,
      caregiver_id: caregiver?.id,
      fee_amount: fee,
      reason: 'cash_payment',
    });

    await fetchData();
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) return null;

  const patient = request.patients as unknown as { profiles: Profile };
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  const hasStartPhoto = photos.some(p => p.photo_type === 'start');

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2">
        <ArrowLeft size={20} />
        <span className="font-semibold">Detalhe do Atendimento</span>
      </button>

      {/* Status badge */}
      <div className={`rounded-2xl p-4 ${
        request.status === 'in_progress' ? 'bg-blue-50' :
        request.status === 'awaiting_payment' ? 'bg-orange-50' :
        request.status === 'scheduled' ? 'bg-green-50' :
        'bg-slate-50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className={`font-bold mt-0.5 ${
              request.status === 'in_progress' ? 'text-blue-700' :
              request.status === 'awaiting_payment' ? 'text-orange-700' :
              request.status === 'scheduled' ? 'text-green-700' :
              'text-slate-700'
            }`}>
              {request.status === 'scheduled' && 'Agendado'}
              {request.status === 'in_progress' && 'Em Andamento'}
              {request.status === 'awaiting_payment' && 'Aguardando Pagamento'}
              {request.status === 'completed' && 'Finalizado'}
            </p>
          </div>
          {request.status === 'in_progress' && (
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>

      {/* Patient info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs text-slate-500 mb-2">Paciente</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
            {patient?.profiles?.full_name?.[0]?.toUpperCase() || 'P'}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{patient?.profiles?.full_name || 'Paciente'}</p>
            {patient?.profiles?.phone && (
              <p className="text-xs text-slate-500">{patient.profiles.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Request details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-slate-900">{request.care_type}</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-emerald-500" />
            <span>{formatDate(request.scheduled_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-emerald-500" />
            <span>{request.location_address}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-emerald-500" />
            <span>Você recebe: <strong className="text-emerald-700">R$ {(request.proposed_value * 0.925).toFixed(2)}</strong></span>
          </div>
        </div>
        {request.observations && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Observações do paciente</p>
            <p className="text-sm text-slate-700 mt-0.5">{request.observations}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {request.status === 'scheduled' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="font-semibold text-slate-800 mb-1">Iniciar Atendimento</h3>
          <p className="text-xs text-slate-500 mb-4">Tire a foto obrigatória ao chegar no local para iniciar o atendimento.</p>

          {photoError && (
            <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs mb-3">{photoError}</div>
          )}

          <button
            onClick={() => handleTakePhoto('start')}
            disabled={photoLoading || hasStartPhoto}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {photoLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Camera size={18} />
                {hasStartPhoto ? 'Foto enviada!' : 'Tirar Foto de Chegada'}
              </>
            )}
          </button>

          {hasStartPhoto && !request.actual_start_at && (
            <button
              onClick={handleStartService}
              disabled={actionLoading}
              className="w-full mt-2 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle size={16} />
              Iniciar Atendimento
            </button>
          )}
        </div>
      )}

      {request.status === 'in_progress' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Monitoramento</h3>
            <p className="text-xs text-slate-500 mb-3">Envie fotos periódicas para comprovar o atendimento.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTakePhoto('periodic')}
                disabled={photoLoading}
                className="py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Camera size={15} />
                Foto Periódica
              </button>
              <button
                onClick={() => onOpenChat(requestId)}
                className="py-3 rounded-xl border border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} />
                Chat
              </button>
            </div>
          </div>

          <button
            onClick={handleEndService}
            disabled={actionLoading}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {actionLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle size={18} />
                Encerrar Serviço
              </>
            )}
          </button>
        </div>
      )}

      {request.status === 'awaiting_payment' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-orange-500" />
            <h3 className="font-semibold text-slate-800">Aguardando Pagamento</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            O paciente está realizando o pagamento. Se recebeu em dinheiro, confirme abaixo.
          </p>
          <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Valor do serviço</span>
              <span>R$ {request.proposed_value.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-xs mt-1">
              <span>Taxa plataforma (7,5%)</span>
              <span>-R$ {(request.proposed_value * 0.075).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-700 mt-2 pt-2 border-t border-slate-200">
              <span>Você recebe</span>
              <span>R$ {(request.proposed_value * 0.925).toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={handleConfirmCashPayment}
            disabled={actionLoading}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle size={16} />
            Confirmar Pagamento em Dinheiro
          </button>
        </div>
      )}

      {/* Monitoring photos */}
      {photos.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-3">Fotos Enviadas ({photos.length})</h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100 relative">
                <img src={photo.photo_url} alt="Monitoramento" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 px-2">
                  <p className="text-white text-[9px]">
                    {new Date(photo.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-white/70 text-[8px]">
                    {photo.photo_type === 'start' ? 'Chegada' : photo.photo_type === 'end' ? 'Encerramento' : 'Periódica'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat button */}
      {['scheduled', 'in_progress', 'awaiting_payment'].includes(request.status) && (
        <button
          onClick={() => onOpenChat(requestId)}
          className="w-full py-3.5 rounded-2xl border-2 border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
        >
          <MessageCircle size={18} />
          Abrir Chat com Paciente
        </button>
      )}

      {/* Rating prompt for caregiver */}
      {request.status === 'completed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <Star size={28} className="text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-slate-800">Como foi o paciente?</p>
          <p className="text-sm text-slate-500 mt-1">Avalie o paciente para ajudar outros cuidadores</p>
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
