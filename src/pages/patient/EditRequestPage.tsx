import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, DollarSign, FileText, ChevronDown, CalendarClock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const CARE_TYPES = [
  'Higiene Pessoal', 'Medicação', 'Companhia', 'Reabilitação',
  'Limpeza', 'Alimentação', 'Transporte', 'Cuidados Noturnos',
];

interface EditRequestPageProps {
  requestId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function EditRequestPage({ requestId, onBack, onSuccess }: EditRequestPageProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    care_type: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location_address: '',
    proposed_value: '',
    observations: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('care_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!data) { setLoading(false); return; }

      const start = new Date(data.scheduled_at);
      const end = data.scheduled_end_at ? new Date(data.scheduled_end_at) : null;

      const pad = (n: number) => String(n).padStart(2, '0');
      const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

      setForm({
        care_type: data.care_type || '',
        start_date: toDate(start),
        start_time: toTime(start),
        end_date: end ? toDate(end) : '',
        end_time: end ? toTime(end) : '',
        location_address: data.location_address || '',
        proposed_value: String(data.proposed_value || ''),
        observations: data.observations || '',
      });
      setLoading(false);
    };
    load();
  }, [requestId]);

  const update = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const getDurationLabel = () => {
    if (!form.start_date || !form.start_time || !form.end_date || !form.end_time) return null;
    const start = new Date(`${form.start_date}T${form.start_time}`);
    const end = new Date(`${form.end_date}T${form.end_time}`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    const totalMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0) return `${mins} minutos`;
    if (mins === 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}min`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (Number(form.proposed_value) < 50) {
      setError('Valor mínimo é R$ 50,00');
      return;
    }

    const scheduled_at = new Date(`${form.start_date}T${form.start_time}`);
    const scheduled_end_at = form.end_date && form.end_time ? new Date(`${form.end_date}T${form.end_time}`) : null;

    if (scheduled_end_at && scheduled_end_at <= scheduled_at) {
      setError('O horário de término deve ser após o início.');
      return;
    }

    const durationMinutes = scheduled_end_at
      ? Math.floor((scheduled_end_at.getTime() - scheduled_at.getTime()) / 60000)
      : null;

    setSaving(true);

    const { error: err } = await supabase
      .from('care_requests')
      .update({
        care_type: form.care_type,
        scheduled_at: scheduled_at.toISOString(),
        scheduled_end_at: scheduled_end_at?.toISOString() ?? null,
        duration_minutes: durationMinutes,
        location_address: form.location_address,
        proposed_value: Number(form.proposed_value),
        observations: form.observations,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('requester_id', profile.id)
      .in('status', ['searching', 'awaiting_approval']);

    if (err) {
      setError('Erro ao salvar. Verifique se a solicitação ainda pode ser editada.');
    } else {
      onSuccess();
    }
    setSaving(false);
  };

  const today = new Date().toISOString().split('T')[0];
  const durationLabel = getDurationLabel();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-2">
        <ArrowLeft size={20} />
        <span className="font-semibold">Editar Solicitação</span>
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
                {CARE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Start date/time */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <Clock size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Início do Atendimento</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Data de início</label>
              <input
                type="date"
                value={form.start_date}
                min={today}
                onChange={e => update('start_date', e.target.value)}
                required
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Horário de início</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => update('start_time', e.target.value)}
                required
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* End date/time */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <CalendarClock size={16} className="text-blue-600" />
            <p className="font-semibold text-slate-700 text-sm">Término do Atendimento</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Data de término</label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date || today}
                onChange={e => update('end_date', e.target.value)}
                required
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Horário de término</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => update('end_time', e.target.value)}
                required
                className="w-full px-3 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          {durationLabel && (
            <div className="px-4 pb-4">
              <div className="bg-blue-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Clock size={14} className="text-blue-500" />
                <p className="text-sm text-blue-700 font-medium">Duração: {durationLabel}</p>
              </div>
            </div>
          )}
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
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-60 text-base"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Alterações'}
        </button>
      </form>
    </div>
  );
}
