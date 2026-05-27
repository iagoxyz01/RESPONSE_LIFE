import { useState, ReactNode } from 'react';
import {
  LayoutDashboard, Users, UserCheck, ClipboardList, DollarSign,
  ShieldCheck, ScrollText, HeadphonesIcon, Settings, LogOut,
  Heart, Menu, X, ChevronRight, Bell
} from 'lucide-react';
import type { AdminPage } from '../AdminApp';
import type { AdminUser } from '../lib/api';

interface Props {
  admin: AdminUser;
  page: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onLogout: () => void;
  children: ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  master: 'Admin Master',
  moderator: 'Moderador',
  financial: 'Financeiro',
  support: 'Suporte',
};

const ROLE_COLORS: Record<string, string> = {
  master: 'bg-rose-500/20 text-rose-300',
  moderator: 'bg-blue-500/20 text-blue-300',
  financial: 'bg-emerald-500/20 text-emerald-300',
  support: 'bg-amber-500/20 text-amber-300',
};

const ROLE_PERMS: Record<string, AdminPage[]> = {
  master:     ['dashboard','users','caregivers','requests','financial','identity','logs','support','settings'],
  moderator:  ['dashboard','users','caregivers','requests','identity','support','logs'],
  financial:  ['dashboard','financial','logs'],
  support:    ['dashboard','support','users'],
};

const NAV_ITEMS: { id: AdminPage; icon: any; label: string }[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'users', icon: Users, label: 'Usuários' },
  { id: 'caregivers', icon: UserCheck, label: 'Cuidadores' },
  { id: 'requests', icon: ClipboardList, label: 'Atendimentos' },
  { id: 'financial', icon: DollarSign, label: 'Financeiro' },
  { id: 'identity', icon: ShieldCheck, label: 'Identidade' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
  { id: 'support', icon: HeadphonesIcon, label: 'Suporte' },
  { id: 'settings', icon: Settings, label: 'Configurações' },
];

export default function AdminLayout({ admin, page, onNavigate, onLogout, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const allowed = ROLE_PERMS[admin.role] || [];

  const navItems = NAV_ITEMS.filter(item => allowed.includes(item.id));
  const currentItem = NAV_ITEMS.find(i => i.id === page);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Heart size={18} className="text-white fill-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Response Live</p>
            <p className="text-slate-500 text-[10px]">Painel Administrativo</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { onNavigate(id); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              page === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon size={17} />
            <span className="flex-1 text-left">{label}</span>
            {page === id && <ChevronRight size={14} className="opacity-60" />}
          </button>
        ))}
      </nav>

      {/* Admin info */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {admin.full_name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{admin.full_name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[admin.role]}`}>
              {ROLE_LABELS[admin.role]}
            </span>
          </div>
          <button onClick={onLogout} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col bg-slate-900 border-r border-slate-800 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 lg:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-white font-semibold text-base">{currentItem?.label || 'Dashboard'}</h1>
              <p className="text-slate-500 text-xs hidden sm:block">Response Live Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700">
              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {admin.full_name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white text-xs font-medium leading-tight">{admin.full_name}</p>
                <p className={`text-[10px] ${ROLE_COLORS[admin.role].split(' ')[1]}`}>{ROLE_LABELS[admin.role]}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
