import { useState, useEffect } from 'react';
import { getToken, getAdmin, setAdmin as saveAdmin, clearToken, api, type AdminUser } from './lib/api';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import CaregiversPage from './pages/CaregiversPage';
import RequestsPage from './pages/RequestsPage';
import FinancialPage from './pages/FinancialPage';
import IdentityPage from './pages/IdentityPage';
import LogsPage from './pages/LogsPage';
import SupportPage from './pages/SupportPage';
import SettingsPage from './pages/SettingsPage';
import AdminsPage from './pages/AdminsPage';

export type AdminPage =
  | 'dashboard' | 'users' | 'caregivers' | 'requests'
  | 'financial' | 'identity' | 'logs' | 'support' | 'settings' | 'admins';

export default function AdminApp() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const saved = getAdmin();

    if (!token || !saved) {
      setLoading(false);
      return;
    }

    // Validate token and get fresh admin data (permissions, role, etc.)
    api.me()
      .then(res => {
        if (res?.admin) {
          const fresh: AdminUser = { ...saved, ...res.admin };
          saveAdmin(fresh);
          setAdmin(fresh);
        } else {
          // Token inválido — limpar e mostrar login
          clearToken();
        }
      })
      .catch(() => {
        // Sem rede — usar dados em cache para não deslogar offline
        setAdmin(saved);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (adminUser: AdminUser) => {
    setAdmin(adminUser);
    setPage('dashboard');
  };

  const handleLogout = () => {
    clearToken();
    setAdmin(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 text-xs">Verificando sessão...</p>
      </div>
    );
  }

  if (!admin) return <AdminLogin onLogin={handleLogin} />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return <Dashboard admin={admin} />;
      case 'users':      return <UsersPage admin={admin} />;
      case 'caregivers': return <CaregiversPage admin={admin} />;
      case 'requests':   return <RequestsPage admin={admin} />;
      case 'financial':  return <FinancialPage admin={admin} />;
      case 'identity':   return <IdentityPage admin={admin} />;
      case 'logs':       return <LogsPage admin={admin} />;
      case 'support':    return <SupportPage admin={admin} />;
      case 'settings':   return <SettingsPage admin={admin} />;
      case 'admins':     return <AdminsPage admin={admin} />;
      default:           return <Dashboard admin={admin} />;
    }
  };

  return (
    <AdminLayout admin={admin} page={page} onNavigate={setPage} onLogout={handleLogout}>
      {renderPage()}
    </AdminLayout>
  );
}
