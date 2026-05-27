import { useState } from 'react';
import { ArrowLeft, MapPin, Clock, DollarSign, FileText, ChevronDown, CreditCard, QrCode, Banknote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const CARE_TYPES = [
  'Higiene Pessoal',
  'Medicação',
  'Companhia',
  'Reabilitação',
  'Limpeza',
  'Alimentação',
  'Transporte',
  'Cuidados Noturnos',
];

const DURATIONS = [
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '3 horas', minutes: 180 },
  { label: '4 horas', minutes: 240 },
  { label: '6 horas', minutes: 360 },
  { label: '8 horas', minutes: 480 },
  { label: '12 horas', minutes: 720 },
];

const PAYMENT_METHODS = [
  {
    id: 'card' as const,
    label: 'Cartão de Crédito',
    description: 'Cobrança automática após o serviço',
    icon: CreditCard,
    color: 'border-blue-500 bg-blue-50 text-blue-700',
    iconColor: 'text-blue-600',
    inactiveColor: 'border-slate-200 bg-white text-slate-600',
  },
  {
    id: 'pix' as const,
    label: 'Pix',
    description: 'QR Code ou copia e cola após o serviço',
    icon: QrCode,
    color: 'border-green-500 bg-green-50 text-green-700',
    iconColor: 'text-green-600',
    inactiveColor: 'border-slate-200 bg-white text-slate-600',
  },
  {
    id: 'cash' as const,
    label: 'Dinheiro',
    description: 'Pagamento presencial ao cuidador',
    icon: Banknote,
    color: 'border-amber-500 bg-amber-50 text-amber-700',
    iconColor: 'text-amber-600',
    inactiveColor: 'border-slate-200 bg-white text-slate-600',
  },
];

interface NewRequestPageProps {
  onBack: () => void;
  onSuccess: (requestId: string) => void;
}

export default function NewRequestPage({ onBack, onSuccess }: NewRequestPageProps) {
  const { patient, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    care_type: '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: 120,
    location_address: '',
    proposed_value: '',
    observations: '',
    payment_method: '' as 'card' | 'pix' | 'cash' | '',
  });

  const update = (key: keyof typeof form, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !profile) return;
    if (Number(form.proposed_value) < 50) {
      setError('Valor mínimo é R$ 50,00');
      return;
    }
    if (Number(form.proposed_value) > 500) {
      setError('Valor máximo é R$ 500,00');
      return;
    }
    if (!form.payment_method) {
      setError('Selecione a forma de pagamento');
      return;
    }

    setLoading(true);
    const scheduled_at = new Date(`${form.scheduled_date}T${form.scheduled_time}`).toISOString();

    const { data, error: err } = await supabase
      .from('care_requests')
      .insert({
        patient_id: patient.id,
        requester_id: profile.id,
        care_type: form.care_type,
        status: 'searching',
        scheduled_at,
        duration_minutes: form.duration_minutes,
        location_address: form.location_address,
        proposed_value: Number(form.proposed_value),
        observations: form.observations,
        payment_method: form.payment_method,
      })
      .select()
      .single();

    if (err) {
      setError('Erro ao criar solicitação. Tente novamente.');
      setLoading(false);
      return;
    }

    await supabase.from('notifications').insert({
      user_id: profile.id,
      type: 'request_created',
      title: 'Solicitação criada',
      body: `Sua solicitação de ${form.care_type} foi criada. Buscando cuidadores...`,
      request_id: data.id,
    });

    setLoading(false);
    onSuccess(data.id);
  };

  const today = new Date().toISOString().split('T')[0];

  const fee = Number(form.proposed_value || 0) * 0.075;
  const net = Number(form.proposed_value || 0) - fee;

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2">
        <ArrowLeft size={20} />
        <span className="font-semibold">Solicitar Atendimento</span>
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Care type */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Tipo de Cuidado</p>
          </div>
          <div className="p-4">
            <div className="relative">
              <select
                value={form.care_type}
                onChange={e => update('care_type', e.target.value)}
                required
                className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-slate-900 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione o tipo...</option>
                {CARE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Date & time */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <Clock size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Data e Horário</p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Data</label>
              <input
                type="date"
                value={form.scheduled_date}
                min={today}
                onChange={e => update('scheduled_date', e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Horário</label>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={e => update('scheduled_time', e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Duração estimada</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.minutes}
                    type="button"
                    onClick={() => update('duration_minutes', d.minutes)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      form.duration_minutes === d.minutes
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Localização</p>
          </div>
          <div className="p-4">
            <input
              type="text"
              value={form.location_address}
              onChange={e => update('location_address', e.target.value)}
              placeholder="Endereço completo"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Value */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <DollarSign size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Valor</p>
          </div>
          <div className="p-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span>
              <input
                type="number"
                value={form.proposed_value}
                onChange={e => update('proposed_value', e.target.value)}
                placeholder="150,00"
                min="50"
                max="500"
                step="0.01"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Mínimo R$ 50,00 - Máximo R$ 500,00</p>
            {Number(form.proposed_value) >= 50 && (
              <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Valor do serviço</span>
                  <span>R$ {Number(form.proposed_value).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Taxa plataforma (7,5%)</span>
                  <span>-R$ {fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 pt-1.5 border-t border-slate-200">
                  <span>Cuidador recebe</span>
                  <span>R$ {net.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Forma de Pagamento</p>
          </div>
          <div className="p-4 space-y-3">
            {PAYMENT_METHODS.map(pm => {
              const Icon = pm.icon;
              const selected = form.payment_method === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => update('payment_method', pm.id)}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all text-left ${
                    selected ? pm.color : pm.inactiveColor
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selected ? 'bg-white/60' : 'bg-slate-50'
                  }`}>
                    <Icon size={20} className={selected ? pm.iconColor : 'text-slate-400'} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{pm.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{pm.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-current' : 'border-slate-300'
                  }`}>
                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Observations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            <p className="font-semibold text-slate-700 text-sm">Observações <span className="text-slate-400 font-normal">(opcional)</span></p>
          </div>
          <div className="p-4">
            <textarea
              value={form.observations}
              onChange={e => update('observations', e.target.value)}
              placeholder="Informações especiais para o cuidador..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-60 text-base"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : 'Solicitar Atendimento'}
        </button>
      </form>
    </div>
  );
}
