import { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, QrCode, Banknote, Check, Loader2, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface PaymentPageProps {
  requestId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function PaymentPage({ requestId, onBack, onSuccess }: PaymentPageProps) {
  const { profile } = useAuth();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'select' | 'pix' | 'card' | 'cash' | 'success'>('select');
  const [error, setError] = useState('');
  const [pixCode, setPixCode] = useState('');

  // Card form state
  const [cardForm, setCardForm] = useState({
    name: '',
    number: '',
    expiry: '',
    cvv: '',
  });

  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId) {
        setError('ID da solicitacao nao encontrado');
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('care_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (err) {
        console.error('Erro ao buscar request:', err);
        setError('Erro ao carregar dados da solicitacao');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Solicitacao nao encontrada');
        setLoading(false);
        return;
      }

      setRequest(data);

      // Generate PIX code
      const randomCode = Math.random().toString(36).substring(2, 15).toUpperCase();
      const code = `00020126580014BR.GOV.BCB.PIX0136${randomCode}520400005303986540${data.proposed_value?.toFixed(2) || '150.00'} 005802BR5925RESPONSE LIVE SISTEMAS6009SAO PAULO62070503***6304`;
      setPixCode(code);
      setLoading(false);
    };

    fetchRequest();
  }, [requestId]);

  // Balance and transaction are now handled by the DB trigger on payments INSERT.
  // This function is kept as a no-op to avoid breaking call sites.
  const updateCaregiverBalance = async (_caregiverId: string, _net: number, _method: string) => {
    return true;
  };

  const handlePixPayment = async () => {
    if (!request || !profile) return;

    setProcessing(true);
    setError('');

    await new Promise(r => setTimeout(r, 2000));

    const gross = request.proposed_value || 0;
    const fee = gross * 0.075;
    const net = gross - fee;

    try {
      const { error: payError } = await supabase.from('payments').insert({
        request_id: requestId,
        payment_method: 'pix',
        gross_amount: gross,
        platform_fee: fee,
        net_amount: net,
        status: 'completed',
        pix_qr_code: pixCode,
        paid_at: new Date().toISOString(),
      });

      if (payError) {
        setError('Erro ao processar pagamento: ' + payError.message);
        setProcessing(false);
        return;
      }

      // Update request status
      await supabase
        .from('care_requests')
        .update({ status: 'completed', final_value: gross })
        .eq('id', requestId);

      // Update caregiver balance and transaction
      if (request.caregiver_id) {
        const success = await updateCaregiverBalance(request.caregiver_id, net, 'pix');
        if (!success) {
          setError('Pagamento registrado, mas erro ao atualizar saldo');
        }
      }

      setPaymentStep('success');
    } catch (err) {
      console.error('Payment error:', err);
      setError('Erro ao processar pagamento');
    }
    setProcessing(false);
  };

  const handleCardPayment = async () => {
    if (!cardForm.name || !cardForm.number || !cardForm.expiry || !cardForm.cvv) {
      setError('Preencha todos os campos do cartao');
      return;
    }

    if (cardForm.number.replace(/\s/g, '').length < 16) {
      setError('Numero do cartao invalido (minimo 16 digitos)');
      return;
    }

    if (!request || !profile) return;

    setProcessing(true);
    setError('');

    await new Promise(r => setTimeout(r, 3000));

    const gross = request.proposed_value || 0;
    const fee = gross * 0.075;
    const net = gross - fee;
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    try {
      const { error: payError } = await supabase.from('payments').insert({
        request_id: requestId,
        payment_method: 'card',
        gross_amount: gross,
        platform_fee: fee,
        net_amount: net,
        status: 'completed',
        transaction_id: transactionId,
        paid_at: new Date().toISOString(),
      });

      if (payError) {
        setError('Erro ao processar pagamento: ' + payError.message);
        setProcessing(false);
        return;
      }

      await supabase
        .from('care_requests')
        .update({ status: 'completed', final_value: gross })
        .eq('id', requestId);

      // Update caregiver balance and transaction
      if (request.caregiver_id) {
        const success = await updateCaregiverBalance(request.caregiver_id, net, 'cartao');
        if (!success) {
          setError('Pagamento registrado, mas erro ao atualizar saldo');
        }
      }

      setPaymentStep('success');
    } catch (err) {
      console.error('Card payment error:', err);
      setError('Erro ao processar pagamento');
    }
    setProcessing(false);
  };

  const handleCashPayment = async () => {
    if (!request || !profile) return;

    setProcessing(true);
    setError('');

    await new Promise(r => setTimeout(r, 1500));

    const gross = request.proposed_value || 0;
    const fee = gross * 0.075;

    try {
      const { error: payError } = await supabase.from('payments').insert({
        request_id: requestId,
        payment_method: 'cash',
        gross_amount: gross,
        platform_fee: fee,
        net_amount: gross - fee,
        status: 'completed',
        paid_at: new Date().toISOString(),
      });

      if (payError) {
        setError('Erro ao confirmar pagamento: ' + payError.message);
        setProcessing(false);
        return;
      }

      await supabase
        .from('care_requests')
        .update({ status: 'completed', final_value: gross })
        .eq('id', requestId);

      // Create pending fee for caregiver
      if (request.caregiver_id) {
        await supabase.from('pending_fees').insert({
          request_id: requestId,
          caregiver_id: request.caregiver_id,
          fee_amount: fee,
          reason: 'cash_payment',
          paid: false,
        });
      }

      setPaymentStep('success');
    } catch (err) {
      console.error('Cash payment error:', err);
      setError('Erro ao confirmar pagamento');
    }
    setProcessing(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixCode);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pt-4 pb-8 flex justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Carregando pagamento...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pt-4 pb-8">
        <div className="text-center py-16">
          <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Erro ao carregar pagamento</h2>
          <p className="text-slate-600 text-sm mt-2">{error || 'Solicitacao nao encontrada'}</p>
          <p className="text-slate-400 text-xs mt-4">Request ID: {requestId}</p>
          <button
            onClick={onBack}
            className="mt-6 bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const gross = request.proposed_value || 0;
  const fee = gross * 0.075;
  const net = gross - fee;

  // Success screen
  if (paymentStep === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pt-4 pb-8">
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Pagamento Confirmado!</h2>
          <p className="text-slate-500 text-sm mt-2">O cuidador recebera R$ {net.toFixed(2)}</p>
          <button
            onClick={onSuccess}
            className="mt-8 bg-blue-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
          >
            Voltar ao Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-4 pb-8 space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2 hover:text-slate-900">
        <ArrowLeft size={20} />
        <span className="font-semibold">Pagamento</span>
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Amount summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-slate-600">Valor total</span>
          <span className="text-2xl font-bold text-slate-900">R$ {gross.toFixed(2)}</span>
        </div>
        <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
          <div className="flex justify-between text-slate-500">
            <span>Valor do servico</span>
            <span>R$ {gross.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Taxa plataforma (7,5%)</span>
            <span>-R$ {fee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700 pt-2 border-t border-slate-100">
            <span>Cuidador recebe</span>
            <span>R$ {net.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment method selection */}
      {paymentStep === 'select' && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">Escolha a forma de pagamento</h3>

          <button
            onClick={() => setPaymentStep('pix')}
            className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-green-300 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <QrCode size={24} className="text-green-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-slate-900">Pix</p>
              <p className="text-xs text-slate-500">Pagamento instantaneo</p>
            </div>
          </button>

          <button
            onClick={() => setPaymentStep('card')}
            className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CreditCard size={24} className="text-blue-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-slate-900">Cartao de Credito</p>
              <p className="text-xs text-slate-500">Visa, Mastercard, Elo</p>
            </div>
          </button>

          <button
            onClick={() => setPaymentStep('cash')}
            className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-amber-300 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Banknote size={24} className="text-amber-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-slate-900">Dinheiro</p>
              <p className="text-xs text-slate-500">Pagamento presencial ao cuidador</p>
            </div>
          </button>
        </div>
      )}

      {/* PIX Payment */}
      {paymentStep === 'pix' && (
        <div className="space-y-5">
          <button onClick={() => setPaymentStep('select')} className="text-blue-600 text-sm font-medium">
            Voltar
          </button>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 inline-block mb-4">
              <div className="w-48 h-48 bg-slate-50 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <QrCode size={64} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">QR Code simulado</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">Ou copie o codigo Pix:</p>
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 font-mono break-all mb-4">
              {pixCode.substring(0, 40)}...
            </div>
            <button
              onClick={copyToClipboard}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <Copy size={16} />
              Copiar Codigo Pix
            </button>
          </div>

          <button
            onClick={handlePixPayment}
            disabled={processing}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/25 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check size={20} />
                Confirmar Pagamento
              </>
            )}
          </button>
        </div>
      )}

      {/* Card Payment */}
      {paymentStep === 'card' && (
        <div className="space-y-5">
          <button onClick={() => setPaymentStep('select')} className="text-blue-600 text-sm font-medium">
            Voltar
          </button>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">Nome no Cartao</label>
              <input
                type="text"
                value={cardForm.name}
                onChange={e => setCardForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                placeholder="NOME COMPLETO"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">Numero do Cartao</label>
              <input
                type="text"
                value={cardForm.number}
                onChange={e => setCardForm(f => ({ ...f, number: formatCardNumber(e.target.value) }))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">Validade</label>
                <input
                  type="text"
                  value={cardForm.expiry}
                  onChange={e => setCardForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))}
                  placeholder="MM/AA"
                  maxLength={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">CVV</label>
                <input
                  type="text"
                  value={cardForm.cvv}
                  onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="123"
                  maxLength={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCardPayment}
            disabled={processing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard size={20} />
                Pagar R$ {gross.toFixed(2)}
              </>
            )}
          </button>
        </div>
      )}

      {/* Cash Payment */}
      {paymentStep === 'cash' && (
        <div className="space-y-5">
          <button onClick={() => setPaymentStep('select')} className="text-blue-600 text-sm font-medium">
            Voltar
          </button>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Banknote size={32} className="text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Pagamento em Dinheiro</h3>
            <p className="text-slate-600 text-sm mt-2">
              O pagamento sera realizado presencialmente ao cuidador no momento do atendimento.
            </p>
            <div className="bg-white rounded-xl p-4 mt-4 text-left">
              <p className="text-xs text-slate-500 mb-1">Valor a pagar</p>
              <p className="text-2xl font-bold text-slate-900">R$ {gross.toFixed(2)}</p>
              <p className="text-xs text-amber-600 mt-2">
                * Uma taxa de plataforma (R$ {fee.toFixed(2)}) sera devida pelo cuidador
              </p>
            </div>
          </div>

          <button
            onClick={handleCashPayment}
            disabled={processing}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Check size={20} />
                Confirmar Pagamento Presencial
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
