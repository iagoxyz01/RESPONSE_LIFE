import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, Profile } from '../lib/supabase';

interface RatingPageProps {
  requestId: string;
  onBack: () => void;
}

export default function RatingPage({ requestId, onBack }: RatingPageProps) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [careType, setCareType] = useState('');

  // Fetch request details on mount
  useEffect(() => {
    const fetchRequest = async () => {
      const { data: req } = await supabase
        .from('care_requests')
        .select('*, patients(*, profiles(*)), caregivers(*, profiles(*))')
        .eq('id', requestId)
        .maybeSingle();

      if (req) {
        setCareType(req.care_type);
        const isCaregiver = profile?.user_type === 'caregiver';
        const partnerProfile = isCaregiver
          ? (req.patients as unknown as { profiles: Profile })?.profiles
          : (req.caregivers as unknown as { profiles: Profile })?.profiles;
        setPartnerName(partnerProfile?.full_name || 'Usuário');
      }
    };
    fetchRequest();
  }, [requestId, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || rating === 0) return;
    setLoading(true);
    setError('');

    // Find the other person in this request
    const { data: req } = await supabase
      .from('care_requests')
      .select('*, patients(*, profiles(*)), caregivers(*, profiles(*))')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) {
      setError('Atendimento nao encontrado.');
      setLoading(false);
      return;
    }

    const isCaregiver = profile.user_type === 'caregiver';
    const reviewedId = isCaregiver
      ? (req.patients as unknown as { profiles: Profile })?.profiles?.id
      : (req.caregivers as unknown as { profiles: Profile })?.profiles?.id;

    if (!reviewedId) {
      setError('Erro ao identificar o avaliado.');
      setLoading(false);
      return;
    }

    // Check if already rated
    const { data: existingRating } = await supabase
      .from('ratings')
      .select('id')
      .eq('request_id', requestId)
      .eq('reviewer_id', profile.id)
      .maybeSingle();

    if (existingRating) {
      setError('Voce ja avaliou este atendimento.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('ratings').insert({
      request_id: requestId,
      reviewer_id: profile.id,
      reviewed_id: reviewedId,
      score: rating,
      comment,
    });

    if (insertError) {
      setError('Erro ao enviar avaliacao. Tente novamente.');
      console.error('Rating error:', insertError);
      setLoading(false);
      return;
    }

    // Average rating is auto-updated by database trigger
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="px-4 pt-4 pb-8">
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Star size={28} className="text-amber-500 fill-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Avaliacao enviada!</h2>
          <p className="text-slate-500 text-sm mt-2">Obrigado pelo seu feedback.</p>
          <button
            onClick={onBack}
            className="mt-6 bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2">
        <ArrowLeft size={20} />
        <span className="font-semibold">Avaliar Atendimento</span>
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="text-center py-4">
        <p className="text-slate-500 text-sm">{careType}</p>
        <p className="text-lg font-bold text-slate-900 mt-1">{partnerName}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stars */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <p className="text-sm text-slate-600 mb-4">Como foi o atendimento?</p>
          <div className="flex items-center justify-center gap-3 mb-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={36}
                  className={`transition-colors ${
                    n <= rating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-200 fill-slate-200'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-slate-700">
            {rating === 0 && 'Toque nas estrelas'}
            {rating === 1 && 'Péssimo'}
            {rating === 2 && 'Ruim'}
            {rating === 3 && 'Regular'}
            {rating === 4 && 'Bom'}
            {rating === 5 && 'Excelente'}
          </p>
        </div>

        {/* Comment */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Comentario <span className="text-slate-400">(opcional)</span></label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Conte como foi o atendimento..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={rating === 0 || loading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send size={18} />
              Enviar Avaliacao
            </>
          )}
        </button>
      </form>
    </div>
  );
}
