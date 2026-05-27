import { useState } from 'react';
import { ArrowLeft, Lock, Shield, Eye, EyeOff, Smartphone, Globe, Trash2, ChevronRight, LogOut, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface PrivacySecurityPageProps {
  onBack: () => void;
}

type SubView = null | 'change-password' | 'privacy-settings' | 'sessions' | 'terms' | 'policy';

export default function PrivacySecurityPage({ onBack }: PrivacySecurityPageProps) {
  const { signOut } = useAuth();
  const [subView, setSubView] = useState<SubView>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, next: false, confirm: false });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileVisibility, setProfileVisibility] = useState('public');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }
    if (passwordForm.next.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
    if (error) {
      setPasswordMsg({ type: 'error', text: 'Erro ao alterar senha. Tente novamente.' });
    } else {
      setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setPasswordForm({ current: '', next: '', confirm: '' });
    }
    setPasswordLoading(false);
  };

  const handleTerminateAllSessions = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    signOut();
  };

  if (subView === 'change-password') {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <button onClick={() => setSubView(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Privacidade e Segurança</span>
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Lock size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Alterar Senha</h2>
              <p className="text-xs text-slate-500">Escolha uma senha forte</p>
            </div>
          </div>

          {passwordMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${
              passwordMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { key: 'next' as const, label: 'Nova senha', placeholder: '••••••••' },
              { key: 'confirm' as const, label: 'Confirmar nova senha', placeholder: '••••••••' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    type={showPass[key] ? 'text' : 'password'}
                    value={passwordForm[key]}
                    onChange={e => setPasswordForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPass[key] ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all disabled:opacity-60 flex items-center justify-center"
            >
              {passwordLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (subView === 'privacy-settings') {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <button onClick={() => setSubView(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Privacidade e Segurança</span>
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Globe size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Privacidade do Perfil</h2>
              <p className="text-xs text-slate-500">Controle quem pode ver suas informações</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { value: 'public', label: 'Público', desc: 'Todos podem ver seu perfil' },
              { value: 'contacts', label: 'Apenas contatos', desc: 'Somente pessoas que já interagiram com você' },
              { value: 'private', label: 'Privado', desc: 'Apenas você pode ver seu perfil' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setProfileVisibility(opt.value)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  profileVisibility === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                  profileVisibility === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                }`}>
                  {profileVisibility === opt.value && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'sessions') {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <button onClick={() => setSubView(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Privacidade e Segurança</span>
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Smartphone size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Sessões Ativas</h2>
              <p className="text-xs text-slate-500">Gerencie onde você está conectado</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <Smartphone size={20} className="text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Dispositivo atual</p>
                <p className="text-xs text-slate-500">Sessão ativa agora</p>
              </div>
              <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Ativo</span>
            </div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Encerrar todas as sessões</p>
                <p className="text-xs text-red-600 mt-0.5">Você será desconectado de todos os dispositivos.</p>
              </div>
            </div>
            <button
              onClick={handleTerminateAllSessions}
              className="mt-3 w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              Encerrar todas as sessões
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'terms' || subView === 'policy') {
    const isTerms = subView === 'terms';
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <button onClick={() => setSubView(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Privacidade e Segurança</span>
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4">{isTerms ? 'Termos de Uso' : 'Política de Privacidade'}</h2>
          <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
            {isTerms ? (
              <>
                <p><strong className="text-slate-800">1. Aceitação dos Termos</strong><br />Ao usar o Response Live, você concorda com estes termos de uso. O uso contínuo do aplicativo implica na aceitação de quaisquer atualizações.</p>
                <p><strong className="text-slate-800">2. Uso do Serviço</strong><br />O Response Live conecta pacientes e cuidadores de saúde. Você é responsável por todas as atividades realizadas com sua conta.</p>
                <p><strong className="text-slate-800">3. Conduta do Usuário</strong><br />É proibido usar o serviço para fins ilegais, transmitir informações falsas ou prejudicar outros usuários.</p>
                <p><strong className="text-slate-800">4. Pagamentos</strong><br />Todos os pagamentos são processados de forma segura. O Response Live cobra uma taxa de serviço conforme descrito na plataforma.</p>
                <p><strong className="text-slate-800">5. Encerramento</strong><br />Reservamos o direito de encerrar contas que violem estes termos sem aviso prévio.</p>
              </>
            ) : (
              <>
                <p><strong className="text-slate-800">1. Dados Coletados</strong><br />Coletamos nome, email, telefone, localização aproximada e dados de uso para melhorar nossos serviços.</p>
                <p><strong className="text-slate-800">2. Uso dos Dados</strong><br />Seus dados são usados para conectar pacientes a cuidadores, processar pagamentos e melhorar a experiência do aplicativo.</p>
                <p><strong className="text-slate-800">3. Compartilhamento</strong><br />Não vendemos seus dados. Compartilhamos apenas o necessário com prestadores de serviços essenciais (ex: processamento de pagamento).</p>
                <p><strong className="text-slate-800">4. Segurança</strong><br />Utilizamos criptografia de ponta a ponta e seguimos as melhores práticas de segurança para proteger seus dados.</p>
                <p><strong className="text-slate-800">5. Seus Direitos</strong><br />Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo suporte.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    { icon: Lock, label: 'Alterar Senha', desc: 'Atualize sua senha de acesso', view: 'change-password' as SubView },
    { icon: Globe, label: 'Privacidade do Perfil', desc: 'Controle a visibilidade do seu perfil', view: 'privacy-settings' as SubView },
    { icon: Smartphone, label: 'Sessões Ativas', desc: 'Gerencie dispositivos conectados', view: 'sessions' as SubView },
    { icon: FileText, label: 'Termos de Uso', desc: 'Leia nossos termos de serviço', view: 'terms' as SubView },
    { icon: Shield, label: 'Política de Privacidade', desc: 'Como tratamos seus dados', view: 'policy' as SubView },
  ];

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2">
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Perfil</span>
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900">Privacidade e Segurança</h1>
          <p className="text-xs text-slate-500">Gerencie sua segurança e privacidade</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {menuItems.map(({ icon: Icon, label, desc, view }) => (
            <button
              key={label}
              onClick={() => setSubView(view)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-slate-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>

      <div className="bg-red-50 border border-red-100 rounded-2xl overflow-hidden">
        <button
          onClick={() => setSubView('sessions')}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-100 transition-colors"
        >
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-red-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-red-700">Encerrar Sessões</p>
            <p className="text-xs text-red-500 mt-0.5">Desconectar de todos os dispositivos</p>
          </div>
          <ChevronRight size={16} className="text-red-300" />
        </button>
      </div>
    </div>
  );
}
