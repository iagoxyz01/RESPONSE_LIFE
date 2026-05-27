import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, ArrowDownToLine, CheckCircle, XCircle, QrCode, CreditCard, Banknote } from 'lucide-react';
import { api, type AdminUser } from '../lib/api';
import StatCard from '../components/StatCard';

interface Props { admin: AdminUser; }

export default function FinancialPage({ admin: _admin }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<'payments' | 'withdrawals'>('withdrawals');

  const load = async () => {
    setLoading(true);
    const res = await api.financial.overview();
    if (!res.error) setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleWithdrawal = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action);
    await api.financial.withdrawal(id, action);
    load();
    setActionLoading(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  const PAYMENT_ICONS: Record<string, any> = { pix: QrCode, card: CreditCard, cash: Banknote };

  const pendingWithdrawals = (data?.withdrawals || []).filter((w: any) => w.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold">Financeiro</h2>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Faturamento Total" value={fmt(data?.totalRevenue)} icon={<DollarSign size={18} className="text-emerald-400" />} color="bg-emerald-500/10" />
            <StatCard label="Taxas Arrecadadas" value={fmt(data?.totalFees)} icon={<TrendingUp size={18} className="text-blue-400" />} color="bg-blue-500/10" />
            <StatCard label="Saques Pendentes" value={pendingWithdrawals.length} icon={<ArrowDownToLine size={18} className="text-amber-400" />} color="bg-amber-500/10" />
            <StatCard label="Total Pagamentos" value={data?.payments?.length || 0} icon={<CheckCircle size={18} className="text-slate-400" />} color="bg-slate-500/10" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {(['withdrawals', 'payments'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {t === 'withdrawals' ? `Saques${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length} pendentes)` : ''}` : 'Pagamentos'}
              </button>
            ))}
          </div>

          {tab === 'withdrawals' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <p className="text-white font-semibold text-sm">Solicitações de Saque</p>
              </div>
              <div className="divide-y divide-slate-800/50">
                {(data?.withdrawals || []).length === 0 && (
                  <p className="text-slate-600 text-sm text-center py-8">Nenhuma solicitação</p>
                )}
                {(data?.withdrawals || []).map((w: any) => (
                  <div key={w.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                        {w.caregivers?.profiles?.avatar_url
                          ? <img src={w.caregivers.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-slate-300 text-xs font-bold">{w.caregivers?.profiles?.full_name?.[0]}</span>}
                      </div>
                      <div>
                        <p className="text-slate-200 text-sm font-medium">{w.caregivers?.profiles?.full_name || 'Cuidador'}</p>
                        <p className="text-slate-500 text-xs">Pix: {w.pix_key} · {fmtDate(w.requested_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold">{fmt(w.amount)}</span>
                      {w.status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleWithdrawal(w.id, 'approve')} disabled={!!actionLoading}
                            className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => handleWithdrawal(w.id, 'reject')} disabled={!!actionLoading}
                            className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                            <XCircle size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full ${w.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : w.status === 'failed' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                          {w.status === 'completed' ? 'Aprovado' : w.status === 'failed' ? 'Rejeitado' : w.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <p className="text-white font-semibold text-sm">Histórico de Pagamentos</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-slate-500 text-xs font-medium px-5 py-3">Método</th>
                      <th className="text-left text-slate-500 text-xs font-medium px-5 py-3 hidden md:table-cell">Data</th>
                      <th className="text-right text-slate-500 text-xs font-medium px-5 py-3">Valor</th>
                      <th className="text-right text-slate-500 text-xs font-medium px-5 py-3">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.payments || []).map((p: any) => {
                      const Icon = PAYMENT_ICONS[p.payment_method] || DollarSign;
                      return (
                        <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Icon size={14} className="text-slate-400" />
                              <span className="text-slate-300 text-sm capitalize">{p.payment_method}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden md:table-cell"><span className="text-slate-400 text-xs">{p.paid_at ? fmtDate(p.paid_at) : '—'}</span></td>
                          <td className="px-5 py-3 text-right"><span className="text-emerald-400 text-sm font-medium">{fmt(p.gross_amount)}</span></td>
                          <td className="px-5 py-3 text-right"><span className="text-blue-400 text-sm">{fmt(p.platform_fee)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
