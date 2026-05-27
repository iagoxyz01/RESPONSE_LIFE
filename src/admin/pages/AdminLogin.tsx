import { useState } from 'react';
import { Heart, Eye, EyeOff, Shield, Lock, Mail, KeyRound } from 'lucide-react';
import { api, setToken, setAdmin, type AdminUser } from '../lib/api';

interface Props { onLogin: (admin: AdminUser) => void; }

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await api.login(email, password, requires2FA ? totpToken : undefined);

    if (res.requires_2fa) {
      setRequires2FA(true);
      setLoading(false);
      return;
    }

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setToken(res.token);
    setAdmin(res.admin);
    onLogin(res.admin);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-40" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-600/40">
            <Heart size={28} className="text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Response Live</h1>
          <p className="text-slate-400 text-sm mt-1">Painel Administrativo</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Shield size={16} className="text-blue-400" />
            <p className="text-slate-300 text-sm font-medium">
              {requires2FA ? 'Verificação em 2 Etapas' : 'Acesso Restrito'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="admin@responselive.com"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">Senha</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-slate-400 text-xs mb-1.5 font-medium">Código de Autenticação (6 dígitos)</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={totpToken}
                    onChange={e => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600"
                  />
                </div>
                <button type="button" onClick={() => setRequires2FA(false)} className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Voltar ao login
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2 shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                requires2FA ? 'Verificar Código' : 'Entrar no Painel'
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800">
            <p className="text-slate-600 text-xs text-center">
              Acesso monitorado. Todas as ações são registradas.
            </p>
          </div>
        </div>

        <p className="text-slate-700 text-xs text-center mt-4">
          Response Live Admin v1.0 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
