import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MessageSquare, TrendingUp, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface MyRatingsPageProps {
  onBack: () => void;
}

interface Rating {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string } | null;
}

export default function MyRatingsPage({ onBack }: MyRatingsPageProps) {
  const { profile } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const fetchRatings = async () => {
      const { data } = await supabase
        .from('ratings')
        .select('id, score, comment, created_at, reviewer:reviewer_id(full_name)')
        .eq('reviewed_id', profile.id)
        .order('created_at', { ascending: false });
      setRatings((data as any[]) || []);
      setLoading(false);
    };
    fetchRatings();
  }, [profile]);

  const avg = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : 0;

  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.score === star).length,
    pct: ratings.length > 0 ? (ratings.filter(r => r.score === star).length / ratings.length) * 100 : 0,
  }));

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderStars = (score: number, size = 14) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={size}
        className={i < score ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
      />
    ));

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Perfil</span>
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
          <Award size={20} className="text-amber-500" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900">Minhas Avaliações</h1>
          <p className="text-xs text-slate-500">{ratings.length} avaliações recebidas</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-5">
          <div className="text-center">
            <p className="text-5xl font-bold text-slate-900">{avg.toFixed(1)}</p>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {renderStars(Math.round(avg), 16)}
            </div>
            <p className="text-xs text-slate-500 mt-1">{ratings.length} avaliações</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {distribution.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-3">{star}</span>
                <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <TrendingUp size={20} className="text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-900">{avg >= 4 ? 'Ótimo' : avg >= 3 ? 'Bom' : 'Regular'}</p>
          <p className="text-xs text-slate-500">Desempenho geral</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <MessageSquare size={20} className="text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-900">{ratings.filter(r => r.comment).length}</p>
          <p className="text-xs text-slate-500">Com comentários</p>
        </div>
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : ratings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <Star size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Nenhuma avaliação ainda</p>
          <p className="text-sm text-slate-400 mt-1">Suas avaliações aparecerão aqui após os atendimentos</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-800 text-sm px-1">Historico de avaliações</h2>
          {ratings.map(rating => (
            <div key={rating.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {(rating.reviewer as any)?.full_name || 'Paciente'}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(rating.created_at)}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {renderStars(rating.score)}
                </div>
              </div>
              {rating.comment && (
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-3 py-2.5">
                  "{rating.comment}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
