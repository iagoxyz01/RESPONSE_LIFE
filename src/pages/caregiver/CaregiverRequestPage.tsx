import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, MapPin, Clock, MessageCircle, CheckCircle, AlertCircle, DollarSign, Star, Image, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, CareRequest, Profile, MonitoringPhoto } from '../../lib/supabase';

interface CaregiverRequestPageProps {
  requestId: string;
  onBack: () => void;
  onOpenChat: (requestId: string) => void;
  onRate: (requestId: string) => void;
}

export default function CaregiverRequestPage({ requestId, onBack, onOpenChat, onRate }: CaregiverRequestPageProps) {
  const { caregiver, profile } = useAuth();
  const [request, setRequest] = useState<CareRequest | null>(null);
  const [photos, setPhotos] = useState<MonitoringPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [pendingPhotoType, setPendingPhotoType] = useState<'start' | 'end' | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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
      .order('taken_at', { ascending: true });
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

  // Send an auto system message to the chat with the photo
  const sendPhotoToChat = async (photoUrl: string, photoType: 'start' | 'end') => {
    if (!profile) return;
    const label = photoType === 'start' ? 'chegada' : 'encerramento';
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    await supabase.from('messages').insert({
      request_id: requestId,
      sender_id: profile.id,
      content: `Foto automática de monitoramento (${label}) enviada às ${now}`,
      message_type: 'system_photo',
      media_url: photoUrl,
    });
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caregiver || !pendingPhotoType) return;
    setPhotoLoading(true);
    setPhotoError('');

    // Upload to Supabase storage
    const path = `monitoring/${requestId}/${pendingPhotoType}_${Date.now()}`;
    let photoUrl: string;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('monitoring-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      // Fallback: use object URL for demo (storage bucket may not exist yet)
      photoUrl = URL.createObjectURL(file);
    } else {
      const { data: urlData } = supabase.storage.from('monitoring-photos').getPublicUrl(uploadData.path);
      photoUrl = urlData.publicUrl;
    }

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* GPS unavailable */ }

    const { error: photoErr } = await supabase.from('monitoring_photos').insert({
      request_id: requestId,
      caregiver_id: caregiver.id,
      photo_url: photoUrl,
      latitude: lat,
      longitude: lng,
      photo_type: pendingPhotoType,
      taken_at: new Date().toISOString(),
      metadata: { device: 'mobile', timestamp: Date.now() },
    });

    if (photoErr) {
      setPhotoError('Erro ao salvar foto. Tente novamente.');
      setPhotoLoading(false);
      return;
    }

    // Send photo automatically to chat
    await sendPhotoToChat(photoUrl, pendingPhotoType);

    // Transition status based on photo type
    if (pendingPhotoType === 'start') {
      await supabase
        .from('care_requests')
        .update({ status: 'in_progress', actual_start_at: new Date().toISOString() })
        .eq('id', requestId);
    } else if (pendingPhotoType === 'end') {
      const startAt = request?.actual_start_at ? new Date(request.actual_start_at) : new Date();
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
    }

    await fetchData();
    setPendingPhotoType(null);
    setPhotoLoading(false);

    // Reset file input so same file can be re-selected if needed
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const triggerCamera = (type: 'start' | 'end') => {
    setPendingPhotoType(type);
    setTimeout(() => cameraRef.current?.click(), 50);
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
  const hasEndPhoto = photos.some(p => p.photo_type === 'end');

  const statusColors: Record<string, string> = {
    in_progress: 'bg-blue-50',
    awaiting_payment: 'bg-orange-50',
    scheduled: 'bg-green-50',
    completed: 'bg-slate-50',
  };
  const statusTextColors: Record<string, string> = {
    in_progress: 'text-blue-700',
    awaiting_payment: 'text-orange-700',
    scheduled: 'text-green-700',
    completed: 'text-slate-700',
  };
  const statusLabels: Record<string, string> = {
    scheduled: 'Agendado',
    in_progress: 'Em Andamento',
    awaiting_payment: 'Aguardando Pagamento',
    completed: 'Finalizado',
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* Photo preview modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setPreviewPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full">
            <X size={22} className="text-white" />
          </button>
          <img src={previewPhoto} alt="Foto" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2">
        <ArrowLeft size={20} />
        <span className="font-semibold">Detalhe do Atendimento</span>
      </button>

      {/* Status badge */}
      <div className={`rounded-2xl p-4 ${statusColors[request.status] || 'bg-slate-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className={`font-bold mt-0.5 ${statusTextColors[request.status] || 'text-slate-700'}`}>
              {statusLabels[request.status] || request.status}
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
            <span>Início: {formatDate(request.scheduled_at)}</span>
          </div>
          {(request as any).scheduled_end_at && (
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span>Término: {formatDate((request as any).scheduled_end_at)}</span>
            </div>
          )}
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

      {/* === SCHEDULED: mandatory arrival photo === */}
      {request.status === 'scheduled' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Camera size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-slate-800">Foto de Chegada Obrigatória</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Tire uma foto ao chegar no local. Ela será enviada automaticamente para o paciente no chat e o atendimento será iniciado.
          </p>

          {photoError && (
            <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs mb-3">{photoError}</div>
          )}

          {hasStartPhoto ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm text-green-700 font-medium">Foto de chegada enviada. Atendimento em andamento.</span>
            </div>
          ) : (
            <button
              onClick={() => triggerCamera('start')}
              disabled={photoLoading}
              className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-600/20"
            >
              {photoLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Camera size={20} />
                  Tirar Foto de Chegada e Iniciar
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* === IN PROGRESS: chat + mandatory end photo === */}
      {request.status === 'in_progress' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Camera size={18} className="text-orange-500" />
              <h3 className="font-semibold text-slate-800">Encerrar Atendimento</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Para encerrar o serviço, tire uma foto obrigatória. Ela será enviada automaticamente para o paciente.
            </p>

            {photoError && (
              <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs mb-3">{photoError}</div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => onOpenChat(requestId)}
                className="py-3 rounded-xl border border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} />
                Chat
              </button>
              <button
                onClick={() => triggerCamera('end')}
                disabled={photoLoading || hasEndPhoto}
                className="py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {photoLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Camera size={15} />
                    {hasEndPhoto ? 'Foto enviada' : 'Foto Final'}
                  </>
                )}
              </button>
            </div>

            {hasEndPhoto ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm text-green-700 font-medium">Foto final enviada. Aguardando pagamento do paciente.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">A foto final é obrigatória para encerrar o atendimento.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === AWAITING PAYMENT === */}
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

      {/* Monitoring photos gallery */}
      {photos.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-3">Fotos do Atendimento ({photos.length})</h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setPreviewPhoto(photo.photo_url)}
                className="aspect-square rounded-xl overflow-hidden bg-slate-100 relative"
              >
                <img src={photo.photo_url} alt="Monitoramento" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 px-2">
                  <p className="text-white text-[9px]">
                    {new Date(photo.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-white/70 text-[8px] capitalize">
                    {photo.photo_type === 'start' ? 'Chegada' : photo.photo_type === 'end' ? 'Encerramento' : 'Periódica'}
                  </p>
                </div>
              </button>
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

      {/* Rating prompt */}
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
