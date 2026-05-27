import { useState } from 'react';
import { Heart, ArrowLeft, ArrowRight, User, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RegisterPageProps {
  onBack: () => void;
}

export default function RegisterPage({ onBack }: RegisterPageProps) {
  const { signUp } = useAuth();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<'patient' | 'caregiver'>('patient');
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    cpf: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (form.password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(form.email, form.password, {
      full_name: form.full_name,
      phone: form.phone,
      user_type: userType,
      cpf: form.cpf,
    });
    if (error) {
      setError(error.message || 'Erro ao criar conta. Tente novamente.');
      setLoading(false);
      return;
    }
    setLoading(false);
    onBack();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <button onClick={onBack} className="flex items-center gap-2 text-blue-300 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm">Voltar ao login</span>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Heart size={20} className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Criar Conta</h1>
              <p className="text-blue-300 text-xs">Response Live</p>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Qual é o seu perfil?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUserType('patient')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                    userType === 'patient'
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    userType === 'patient' ? 'bg-blue-500' : 'bg-white/10'
                  }`}>
                    <User size={24} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">Paciente</p>
                    <p className="text-white/50 text-xs mt-0.5">Buscar cuidadores</p>
                  </div>
                </button>
                <button
                  onClick={() => setUserType('caregiver')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                    userType === 'caregiver'
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    userType === 'caregiver' ? 'bg-green-500' : 'bg-white/10'
                  }`}>
                    <Stethoscope size={24} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">Cuidador</p>
                    <p className="text-white/50 text-xs mt-0.5">Oferecer serviços</p>
                  </div>
                </button>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 mt-2"
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Seus dados</h2>
              <p className="text-sm text-slate-500 mb-5">
                {userType === 'caregiver' ? 'Cadastro de cuidador' : 'Cadastro de paciente'}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome completo</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={update('full_name')}
                    placeholder="João da Silva"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    placeholder="joao@email.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={update('phone')}
                    placeholder="(11) 99999-9999"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {userType === 'caregiver' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">CPF</label>
                    <input
                      type="text"
                      value={form.cpf}
                      onChange={update('cpf')}
                      placeholder="000.000.000-00"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={update('password')}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar senha</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={update('confirmPassword')}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
