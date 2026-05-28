import { ReactNode } from 'react';
import { Bell, Home, ClipboardList, MessageSquare, DollarSign, User, LogOut, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
  page: string;
  onNavigate: (page: string) => void;
  hideNav?: boolean;
}

const patientNav = [
  { id: 'dashboard', icon: Home, label: 'Início' },
  { id: 'history', icon: ClipboardList, label: 'Histórico' },
  { id: 'chat-list', icon: MessageSquare, label: 'Chat' },
  { id: 'notifications', icon: Bell, label: 'Avisos' },
  { id: 'profile', icon: User, label: 'Perfil' },
];

const caregiverNav = [
  { id: 'dashboard', icon: Home, label: 'Inicio' },
  { id: 'history', icon: ClipboardList, label: 'Historico' },
  { id: 'chat-list', icon: MessageSquare, label: 'Chat' },
  { id: 'wallet', icon: DollarSign, label: 'Carteira' },
  { id: 'profile', icon: User, label: 'Perfil' },
];

export default function Layout({ children, page, onNavigate, hideNav }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const nav = profile?.user_type === 'caregiver' ? caregiverNav : patientNav;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Heart size={16} className="text-white fill-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Response Life</h1>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">
              {profile?.user_type === 'caregiver' ? 'Cuidador' : 'Paciente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('notifications')}
            className="relative p-2 text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Bell size={18} />
          </button>
          <button
            onClick={signOut}
            className="p-2 text-slate-500 hover:text-red-500 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto ${hideNav ? '' : 'pb-20'}`}>
        {children}
      </main>

      {/* Bottom nav */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 px-2 py-2 z-10 shadow-lg">
          <div className="flex justify-around">
            {nav.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  page === id
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
