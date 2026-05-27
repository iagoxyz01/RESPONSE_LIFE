import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, ArrowUpRight, ChevronRight, Wallet, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, Withdrawal } from '../../lib/supabase';

interface Transaction {
  id: string;
  type: 'earning' | 'withdrawal';
  amount: number;
  description: string;
  date: string;
  status: string;
}

export default function FinancialPage() {
  const { caregiver, refreshProfile } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingFees, setPendingFees] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  useEffect(() => {
    if (!caregiver) return;
    const fetchData = async () => {
      // Fetch withdrawals
      const { data: wds } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('caregiver_id', caregiver.id)
        .order('requested_at', { ascending: false })
        .limit(20);
      setWithdrawals(wds || []);

      // Fetch completed payments for this caregiver
      const { data: payments } = await supabase
        .from('payments')
        .select('*, care_requests!inner(caregiver_id, care_type)')
        .eq('care_requests.caregiver_id', caregiver.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch pending fees
      const { data: fees } = await supabase
        .from('pending_fees')
        .select('fee_amount')
        .eq('caregiver_id', caregiver.id)
        .eq('paid', false);

      const totalFees = (fees || []).reduce((sum, f) => sum + f.fee_amount, 0);
      setPendingFees(totalFees);

      // Build transaction history
      const earningTxs: Transaction[] = (payments || []).map((p: any) => ({
        id: p.id,
        type: 'earning' as const,
        amount: p.net_amount,
        description: p.care_requests?.care_type || 'Atendimento',
        date: p.paid_at || p.created_at,
        status: 'completed',
      }));

      const withdrawTxs: Transaction[] = (wds || []).map(w => ({
        id: w.id,
        type: 'withdrawal' as const,
        amount: w.amount,
        description: 'Saque Pix',
        date: w.requested_at,
        status: w.status,
      }));

      const all = [...earningTxs, ...withdrawTxs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTransactions(all);
      setLoading(false);
    };
    fetchData();
    setPixKey(caregiver.pix_key || '');
  }, [caregiver]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caregiver) return;
    const amount = Number(withdrawAmount);
    if (amount < 20) {
      setWithdrawError('Valor mínimo de saque: R$ 20,00');
      return;
    }
    if (amount > (caregiver.available_balance || 0)) {
      setWithdrawError('Saldo insuficiente');
      return;
    }
    setWithdrawLoading(true);
    setWithdrawError('');

    const { error } = await supabase.from('withdrawals').insert({
      caregiver_id: caregiver.id,
      amount,
      pix_key: pixKey,
      status: 'processing',
    });

    if (!error) {
      // Deduct from balance
      await supabase
        .from('caregivers')
        .update({ available_balance: (caregiver.available_balance || 0) - amount })
        .eq('id', caregiver.id);
      await refreshProfile();
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } else {
      setWithdrawError('Erro ao processar saque. Tente novamente.');
    }
    setWithdrawLoading(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });

  const monthEarnings = transactions
    .filter(t => {
      const d = new Date(t.date);
      const now = new Date();
      return t.type === 'earning' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      <h2 className="text-xl font-bold text-slate-900">Financeiro</h2>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-emerald-200" />
            <p className="text-xs text-emerald-200">Disponível</p>
          </div>
          <p className="text-2xl font-bold">R$ {(caregiver?.available_balance || 0).toFixed(2)}</p>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-3 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Sacar via Pix
          </button>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-500" />
            <p className="text-xs text-slate-500">Pendente (7 dias)</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">R$ {(caregiver?.pending_balance || 0).toFixed(2)}</p>
          {pendingFees > 0 && (
            <p className="text-xs text-red-500 mt-1">Taxas: -R$ {pendingFees.toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Monthly earnings */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Este mês</p>
          </div>
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-900">R$ {monthEarnings.toFixed(2)}</p>
        <p className="text-xs text-slate-500 mt-1">
          {transactions.filter(t => t.type === 'earning' && new Date(t.date).getMonth() === new Date().getMonth()).length} atendimentos realizados
        </p>
      </div>

      {/* Pending fees warning */}
      {pendingFees > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Taxas Pendentes</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Você tem R$ {pendingFees.toFixed(2)} em taxas pendentes de pagamentos em dinheiro. Serão descontadas no próximo saque.
            </p>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h3 className="font-semibold text-slate-700 text-sm mb-3">Histórico de Transações</h3>
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && transactions.length === 0 && (
          <div className="text-center py-8 bg-white rounded-2xl border border-slate-100">
            <p className="text-slate-500 text-sm">Nenhuma transação ainda</p>
          </div>
        )}
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  tx.type === 'earning' ? 'bg-emerald-50' : 'bg-orange-50'
                }`}>
                  {tx.type === 'earning' ? (
                    <TrendingUp size={16} className="text-emerald-600" />
                  ) : (
                    <ArrowUpRight size={16} className="text-orange-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{tx.description}</p>
                  <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${tx.type === 'earning' ? 'text-emerald-700' : 'text-orange-700'}`}>
                  {tx.type === 'earning' ? '+' : '-'}R$ {tx.amount.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {tx.status === 'completed' ? 'Concluído' : tx.status === 'processing' ? 'Processando' : tx.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg mb-4">Solicitar Saque</h3>

            {withdrawError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {withdrawError}
              </div>
            )}

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor do Saque</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0,00"
                    min="20"
                    max={caregiver?.available_balance || 0}
                    step="0.01"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Disponível: R$ {(caregiver?.available_balance || 0).toFixed(2)} • Mínimo: R$ 20,00
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Chave Pix</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  placeholder="CPF, email, telefone ou chave aleatória"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {withdrawLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Sacar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
