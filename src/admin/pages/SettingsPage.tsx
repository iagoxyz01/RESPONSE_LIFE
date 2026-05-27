import { useState } from 'react';
import { Shield, Bell, Database, Percent, Save, CheckCircle } from 'lucide-react';
import { type AdminUser } from '../lib/api';

interface Props { admin: AdminUser; }

export default function SettingsPage({ admin }: Props) {
  const [saved, setSaved] = useState(false);
  const [platformFee, setPlatformFee] = useState('15');
  const [minWithdrawal, setMinWithdrawal] = useState('50');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const isMaster = admin.role === 'master';

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-white font-bold">Configurações</h2>

      {/* Financial settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <Percent size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Configurações Financeiras</p>
            <p className="text-slate-500 text-xs">Taxas e limites da plataforma</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Taxa da Plataforma (%)</label>
            <input
              type="number"
              value={platformFee}
              onChange={e => setPlatformFee(e.target.value)}
              disabled={!isMaster}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-slate-600 text-xs mt-1">Percentual cobrado sobre cada pagamento</p>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Saque Mínimo (R$)</label>
            <input
              type="number"
              value={minWithdrawal}
              onChange={e => setMinWithdrawal(e.target.value)}
              disabled={!isMaster}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-slate-600 text-xs mt-1">Valor mínimo para solicitar saque</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <Bell size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Notificações</p>
            <p className="text-slate-500 text-xs">Alertas e comunicações do sistema</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm">Notificações do sistema</p>
              <p className="text-slate-500 text-xs">Alertas internos para admins</p>
            </div>
            <button
              onClick={() => setNotificationsEnabled(v => !v)}
              disabled={!isMaster}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* System */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-500/10 rounded-lg flex items-center justify-center">
            <Database size={16} className="text-slate-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Sistema</p>
            <p className="text-slate-500 text-xs">Controles gerais da plataforma</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm">Modo de manutenção</p>
              <p className="text-slate-500 text-xs">Bloqueia acesso de novos usuários</p>
            </div>
            <button
              onClick={() => setMaintenanceMode(v => !v)}
              disabled={!isMaster}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${maintenanceMode ? 'bg-red-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Security info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Segurança</p>
            <p className="text-slate-500 text-xs">Informações de acesso e autenticação</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Sessão expira em</span>
            <span className="text-slate-200">8 horas</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">2FA</span>
            <span className="text-emerald-400">TOTP habilitado</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Seu perfil</span>
            <span className="text-slate-200">{admin.full_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Função</span>
            <span className="text-slate-200 capitalize">{admin.role}</span>
          </div>
        </div>
      </div>

      {isMaster && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {!isMaster && (
        <p className="text-slate-600 text-xs text-center">Apenas o Admin Master pode alterar as configurações</p>
      )}
    </div>
  );
}
