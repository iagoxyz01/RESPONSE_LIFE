import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Shield, Upload, Camera, CheckCircle, Clock, XCircle, AlertCircle, Image } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface IdentityVerificationPageProps {
  onBack: () => void;
}

type VerificationStatus = 'pending' | 'in_review' | 'verified' | 'rejected';

interface Verification {
  id: string;
  status: VerificationStatus;
  rg_url: string | null;
  cpf_url: string | null;
  selfie_url: string | null;
  rejection_reason: string | null;
  submitted_at: string;
}

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  in_review: { label: 'Em análise', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: AlertCircle },
  verified: { label: 'Verificado', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle },
  rejected: { label: 'Rejeitado', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
};

export default function IdentityVerificationPage({ onBack }: IdentityVerificationPageProps) {
  const { profile, caregiver } = useAuth();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'rg' | 'cpf' | 'selfie' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [files, setFiles] = useState<{ rg: File | null; cpf: File | null; selfie: File | null }>({
    rg: null, cpf: null, selfie: null,
  });
  const [previews, setPreviews] = useState<{ rg: string | null; cpf: string | null; selfie: string | null }>({
    rg: null, cpf: null, selfie: null,
  });

  const rgRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!caregiver) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('caregiver_id', caregiver.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setVerification(data as Verification | null);
      setLoading(false);
    };
    fetch();
  }, [caregiver]);

  const handleFileSelect = (type: 'rg' | 'cpf' | 'selfie') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setErrorMsg('');
    setFiles(f => ({ ...f, [type]: file }));
    const url = URL.createObjectURL(file);
    setPreviews(p => ({ ...p, [type]: url }));
  };

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('identity-docs')
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data: urlData } = supabase.storage.from('identity-docs').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!files.rg || !files.cpf || !files.selfie) {
      setErrorMsg('Envie todos os documentos: RG, CPF e selfie.');
      return;
    }
    if (!profile || !caregiver) return;

    setSubmitting(true);
    setErrorMsg('');

    const userId = profile.id;
    const ts = Date.now();

    setUploading('rg');
    const rgUrl = await uploadFile(files.rg, `${userId}/rg_${ts}`);
    setUploading('cpf');
    const cpfUrl = await uploadFile(files.cpf, `${userId}/cpf_${ts}`);
    setUploading('selfie');
    const selfieUrl = await uploadFile(files.selfie, `${userId}/selfie_${ts}`);
    setUploading(null);

    if (!rgUrl || !cpfUrl || !selfieUrl) {
      setErrorMsg('Erro ao enviar arquivos. Tente novamente.');
      setSubmitting(false);
      return;
    }

    const payload = {
      caregiver_id: caregiver.id,
      user_id: userId,
      rg_url: rgUrl,
      cpf_url: cpfUrl,
      selfie_url: selfieUrl,
      status: 'pending' as VerificationStatus,
      submitted_at: new Date().toISOString(),
    };

    let result;
    if (verification) {
      result = await supabase
        .from('identity_verifications')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', verification.id)
        .select()
        .maybeSingle();
    } else {
      result = await supabase
        .from('identity_verifications')
        .insert(payload)
        .select()
        .maybeSingle();
    }

    if (result.error) {
      setErrorMsg('Erro ao salvar verificação. Tente novamente.');
    } else {
      setVerification(result.data as Verification);
      setSuccessMsg('Documentos enviados! Sua verificação está em análise.');
      setFiles({ rg: null, cpf: null, selfie: null });
      setPreviews({ rg: null, cpf: null, selfie: null });
    }
    setSubmitting(false);
  };

  const canResubmit = !verification || verification.status === 'rejected';

  const FileUploadSlot = ({
    type, label, hint, inputRef, accept,
  }: {
    type: 'rg' | 'cpf' | 'selfie';
    label: string;
    hint: string;
    inputRef: React.RefObject<HTMLInputElement>;
    accept: string;
  }) => {
    const preview = previews[type];
    const existingUrl = verification?.[`${type}_url` as 'rg_url' | 'cpf_url' | 'selfie_url'];
    const isUploading = uploading === type;

    return (
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
        <p className="text-xs text-slate-500 mb-2">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture={type === 'selfie' ? 'user' : 'environment'}
          onChange={handleFileSelect(type)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canResubmit || submitting}
          className={`w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
            preview || existingUrl
              ? 'border-green-300 bg-green-50'
              : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isUploading ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm text-blue-600 font-medium">Enviando...</span>
            </div>
          ) : preview ? (
            <div className="relative">
              <img src={preview} alt={label} className="w-full h-36 object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">Trocar foto</p>
              </div>
              <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                <CheckCircle size={14} className="text-white" />
              </div>
            </div>
          ) : existingUrl && !canResubmit ? (
            <div className="relative">
              <img src={existingUrl} alt={label} className="w-full h-36 object-cover" />
              <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                <CheckCircle size={14} className="text-white" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              {type === 'selfie' ? <Camera size={24} className="text-slate-400" /> : <Image size={24} className="text-slate-400" />}
              <span className="text-sm text-slate-500 font-medium">
                {type === 'selfie' ? 'Tirar selfie' : 'Selecionar foto'}
              </span>
              <span className="text-xs text-slate-400">JPG, PNG ou WEBP • máx 5MB</span>
            </div>
          )}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const statusConfig = verification ? STATUS_CONFIG[verification.status] : null;
  const StatusIcon = statusConfig?.icon;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Perfil</span>
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900">Verificação de Identidade</h1>
          <p className="text-xs text-slate-500">Verificação necessária para operar</p>
        </div>
      </div>

      {/* Status banner */}
      {verification && statusConfig && StatusIcon && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${statusConfig.bg}`}>
          <StatusIcon size={20} className={`${statusConfig.color} flex-shrink-0 mt-0.5`} />
          <div>
            <p className={`font-semibold text-sm ${statusConfig.color}`}>
              Status: {statusConfig.label}
            </p>
            {verification.rejection_reason && (
              <p className="text-xs text-red-600 mt-1">{verification.rejection_reason}</p>
            )}
            {verification.status === 'verified' && (
              <p className="text-xs text-green-600 mt-1">Sua identidade foi verificada com sucesso.</p>
            )}
            {verification.status === 'in_review' && (
              <p className="text-xs text-blue-600 mt-1">Seus documentos estão sendo analisados. Aguarde até 48h.</p>
            )}
            {verification.status === 'pending' && (
              <p className="text-xs text-amber-600 mt-1">Documentos recebidos. A análise começará em breve.</p>
            )}
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Info card */}
      {!verification && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">Por que verificar?</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            A verificação de identidade aumenta a confiança dos pacientes e desbloqueia recursos premium da plataforma.
          </p>
        </div>
      )}

      {/* Upload form */}
      {(canResubmit) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
          <FileUploadSlot
            type="rg"
            label="RG (frente)"
            hint="Foto clara do seu documento de identidade"
            inputRef={rgRef}
            accept="image/*"
          />
          <FileUploadSlot
            type="cpf"
            label="CPF"
            hint="Foto do seu CPF ou cartão com número visível"
            inputRef={cpfRef}
            accept="image/*"
          />
          <FileUploadSlot
            type="selfie"
            label="Selfie"
            hint="Foto do seu rosto. Use boa iluminação e sem óculos escuros"
            inputRef={selfieRef}
            accept="image/*"
          />

          <button
            onClick={handleSubmit}
            disabled={submitting || !files.rg || !files.cpf || !files.selfie}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando documentos...
              </>
            ) : (
              <>
                <Upload size={18} />
                Enviar para verificação
              </>
            )}
          </button>
        </div>
      )}

      {/* Verified state — show submitted docs */}
      {verification?.status === 'verified' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-800 mb-3">Documentos enviados</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { url: verification.rg_url, label: 'RG' },
              { url: verification.cpf_url, label: 'CPF' },
              { url: verification.selfie_url, label: 'Selfie' },
            ].map(({ url, label }) => url ? (
              <div key={label} className="rounded-xl overflow-hidden border border-slate-100">
                <img src={url} alt={label} className="w-full h-24 object-cover" />
                <p className="text-xs text-center text-slate-500 py-1">{label}</p>
              </div>
            ) : null)}
          </div>
        </div>
      )}
    </div>
  );
}
