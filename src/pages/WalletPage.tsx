import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, AlertCircle, Wallet, TrendingUp, DollarSign, QrCode, Building2, ArrowLeft, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'withdrawal';
  amount: number;
  description: string;
  status: string;
  created_at: string;
  request_id?: string;
}

interface WithdrawalRecord {
  id: string;
  amount: number;
  status: string;
  pix_key: string;
  requested_at: string;
  processed_at?: string;
}

export default function WalletPage() {
  const { caregiver } = useAuth();
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPixKey, setWithdrawPixKey] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'pix' | 'bank'>('pix');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!caregiver) return;

      // Get current balance
      const { data: cg } = await supabase
        .from('caregivers')
        .select('available_balance, pending_balance')
        .eq('id', caregiver.id)
        .maybeSingle();

      if (cg) {
        setBalance(cg.available_balance || 0);
        setPendingBalance(cg.pending_balance || 0);
      }

      // Get transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('caregiver_id', caregiver.id)
        .order('created_at', { ascending: false });

      // Get withdrawals
      const { data: wds } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('caregiver_id', caregiver.id)
        .order('requested_at', { ascending: false });

      setWithdrawals((wds || []) as WithdrawalRecord[]);

      // Combine into transactions
      const txs: Transaction[] = [];

      (txData || []).forEach(t => {
        txs.push({
          id: t.id,
          type: t.type === 'payment' ? 'credit' : t.type,
          amount: t.amount,
          description: t.description || 'Transacao',
          status: 'completed',
          created_at: t.created_at,
        });
      });

      (wds || []).forEach(w => {
        txs.push({
          id: w.id,
          type: 'withdrawal',
          amount: w.amount,
          description: 'Saque solicitado',
          status: w.status,
          created_at: w.requested_at,
        });
      });

      // Sort by date
      txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(txs);
      setLoading(false);
    };

    fetchData();
  }, [caregiver]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 10) {
      alert('Valor minimo para saque: R$ 10,00');
      return;
    }
    if (amount > balance) {
      alert('Saldo insuficiente');
      return;
    }
    if (!withdrawPixKey.trim()) {
      alert('Informe a chave Pix');
      return;
    }

    setProcessing(true);

    // Create withdrawal record
    const { error: wdError } = await supabase.from('withdrawals').insert({
      caregiver_id: caregiver?.id,
      amount,
      pix_key: withdrawPixKey,
      status: 'pending',
    });

    if (wdError) {
      console.error('Withdrawal error:', wdError);
      alert('Erro ao solicitar saque');
      setProcessing(false);
      return;
    }

    // Deduct from balance
    const { error: balError } = await supabase
      .from('caregivers')
      .update({ available_balance: balance - amount })
      .eq('id', caregiver?.id);

    if (balError) {
      console.error('Balance update error:', balError);
    }

    // Simulate processing delay, then mark as completed
    setTimeout(async () => {
      await supabase
        .from('withdrawals')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('caregiver_id', caregiver?.id)
        .eq('status', 'pending');
    }, 5000);

    setShowWithdrawModal(false);
    setWithdrawAmount('');
    setWithdrawPixKey('');
    setProcessing(false);

    // Refresh data
    window.location.reload();
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Concluido' };
      case 'pending':
      case 'processing':
        return { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Em processamento' };
      default:
        return { icon: AlertCircle, color: 'text-slate-500 bg-slate-50', label: status };
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-6 flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      <h2 className="text-xl font-bold text-slate-900">Carteira</h2>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-600/25">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-blue-200" />
            <span className="text-blue-100 text-sm">Saldo Disponivel</span>
          </div>
          <TrendingUp size={20} className="text-blue-200" />
        </div>
        <p className="text-4xl font-bold">R$ {balance.toFixed(2)}</p>
        {pendingBalance > 0 && (
          <p className="text-blue-200 text-sm mt-2">+ R$ {pendingBalance.toFixed(2)} pendente</p>
        )}
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <ArrowUpRight size={18} />
          Solicitar Saque
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <ArrowDownLeft size={16} />
            <span className="text-xs font-medium">Recebido</span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            R$ {transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <ArrowUpRight size={16} />
            <span className="text-xs font-medium">Sacado</span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            R$ {transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">Historico</h3>
        <div className="space-y-2">
          {transactions.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center border border-slate-100">
              <p className="text-slate-400 text-sm">Nenhuma transacao ainda</p>
            </div>
          )}
          {transactions.map(tx => {
            const statusConfig = getStatusConfig(tx.status);
            const StatusIcon = statusConfig.icon;
            return (
              <div key={tx.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      tx.type === 'credit' ? 'bg-green-50 text-green-600' :
                      tx.type === 'withdrawal' ? 'bg-red-50 text-red-500' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {tx.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{tx.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      tx.type === 'credit' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {tx.type === 'credit' ? '+' : '-'}R$ {tx.amount.toFixed(2)}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${statusConfig.color}`}>
                      <StatusIcon size={10} />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-md mx-auto p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Solicitar Saque</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="p-2 text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-sm text-blue-600">Saldo disponivel</p>
                <p className="text-2xl font-bold text-blue-700">R$ {balance.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5">Valor do saque</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0,00"
                    min="10"
                    max={balance}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimo: R$ 10,00</p>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5">Metodo de recebimento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setWithdrawMethod('pix')}
                    className={`py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      withdrawMethod === 'pix'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode size={18} />
                    <span className="font-medium text-sm">Pix</span>
                  </button>
                  <button
                    onClick={() => setWithdrawMethod('bank')}
                    className={`py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      withdrawMethod === 'bank'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Building2 size={18} />
                    <span className="font-medium text-sm">Conta</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5">
                  {withdrawMethod === 'pix' ? 'Chave Pix' : 'Numero da Conta'}
                </label>
                <input
                  type="text"
                  value={withdrawPixKey}
                  onChange={e => setWithdrawPixKey(e.target.value)}
                  placeholder={withdrawMethod === 'pix' ? 'CPF, email, telefone ou chave aleatoria' : 'Agencia / Conta'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={processing}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <DollarSign size={20} />
                    Solicitar Saque
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
