import { useState } from 'react';
import { ArrowLeft, MapPin, Clock, DollarSign, FileText, ChevronDown } from 'lucide-react';
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
            <p className="font-semibold text-slate-700 text-sm">Valor Proposto</p>
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
                step="0.01"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Valor mínimo R$ 50,00</p>
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
