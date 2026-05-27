import { useState, useEffect } from 'react';
import {
  Users, UserCheck, Activity, CheckCircle2, Clock, DollarSign,
  TrendingUp, ArrowDownToLine, ShieldAlert, RefreshCw
} from 'lucide-react';
import { api, type AdminUser } from '../lib/api';
import StatCard from '../components/StatCard';

interface Props { admin: AdminUser; }

export default function Dashboard({ admin }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    const res = await api.dashboard();
    if (!res.error) { setData(res); setLastUpdated(new Date()); }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const s = data?.stats || {};
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

  const STATUS_COLORS: Record<string, string> = {
    searching: 'bg-amber-500/20 text-amber-300',
    scheduled: 'bg-blue-500/20 text-blue-300',
    in_progress: 'bg-emerald-500/20 text-emerald-300',
    completed: 'bg-slate-500/20 text-slate-300',
    awaiting_payment: 'bg-orange-500/20 text-orange-300',
  };
  const STATUS_LABELS: Record<string, string> = {
    searching: 'Buscando', scheduled: 'Agendado', in_progress: 'Em andamento',
    completed: 'Finalizado', awaiting_payment: 'Pagamento',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-bold">Visão Geral</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Bem-vindo, {admin.full_name.split(' ')[0]} · Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de Usuários" value={s.totalUsers || 0} icon={<Users size={18} className="text-blue-400" />} color="bg-blue-500/10" />
            <StatCard label="Cuidadores" value={s.totalCaregivers || 0} icon={<UserCheck size={18} className="text-emerald-400" />} color="bg-emerald-500/10" />
            <StatCard label="Atendimentos Ativos" value={s.activeRequests || 0} icon={<Activity size={18} className="text-amber-400" />} color="bg-amber-500/10" />
            <StatCard label="Finalizados" value={s.completedRequests || 0} icon={<CheckCircle2 size={18} className="text-slate-400" />} color="bg-slate-500/10" />
            <StatCard label="Solicitações Pendentes" value={s.pendingRequests || 0} icon={<Clock size={18} className="text-orange-400" />} color="bg-orange-500/10" />
            <StatCard label="Faturamento Total" value={fmt(s.totalRevenue)} icon={<DollarSign size={18} className="text-emerald-400" />} color="bg-emerald-500/10" />
            <StatCard label="Taxas da Plataforma" value={fmt(s.totalFees)} icon={<TrendingUp size={18} className="text-blue-400" />} color="bg-blue-500/10" />
            <StatCard label="Saques Pendentes" value={s.pendingWithdrawals || 0} icon={<ArrowDownToLine size={18} className="text-amber-400" />} color="bg-amber-500/10" />
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Verifications */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={16} className="text-rose-400" />
                <h3 className="text-white font-semibold text-sm">Verificações Pendentes</h3>
              </div>
              <p className="text-4xl font-bold text-white">{s.pendingVerifications || 0}</p>
              <p className="text-slate-500 text-xs mt-1">identidades aguardando análise</p>
            </div>

            {/* Payment methods */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Métodos de Pagamento</h3>
              <div className="space-y-3">
                {[
                  { label: 'Pix', value: s.byMethod?.pix || 0, color: 'bg-emerald-500' },
                  { label: 'Cartão', value: s.byMethod?.card || 0, color: 'bg-blue-500' },
                  { label: 'Dinheiro', value: s.byMethod?.cash || 0, color: 'bg-amber-500' },
                ].map(item => {
                  const total = (s.byMethod?.pix || 0) + (s.byMethod?.card || 0) + (s.byMethod?.cash || 0);
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="text-slate-300">{fmt(item.value)} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent requests */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Últimas Solicitações</h3>
              <div className="space-y-2">
                {(data?.recentRequests || []).slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                    <div>
                      <p className="text-slate-300 text-xs font-medium">{r.care_type}</p>
                      <p className="text-slate-600 text-[10px]">
                        {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-slate-800 text-slate-400'}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                ))}
                {(!data?.recentRequests || data.recentRequests.length === 0) && (
                  <p className="text-slate-600 text-xs text-center py-4">Nenhuma solicitação</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
