import { useState, useEffect } from 'react';
import { getToken, getAdmin, clearToken, type AdminUser } from './lib/api';
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

export type AdminPage =
  | 'dashboard' | 'users' | 'caregivers' | 'requests'
  | 'financial' | 'identity' | 'logs' | 'support' | 'settings';

export default function AdminApp() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const saved = getAdmin();
    if (token && saved) setAdmin(saved);
    setLoading(false);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) return <AdminLogin onLogin={handleLogin} />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard admin={admin} />;
      case 'users': return <UsersPage admin={admin} />;
      case 'caregivers': return <CaregiversPage admin={admin} />;
      case 'requests': return <RequestsPage admin={admin} />;
      case 'financial': return <FinancialPage admin={admin} />;
      case 'identity': return <IdentityPage admin={admin} />;
      case 'logs': return <LogsPage admin={admin} />;
      case 'support': return <SupportPage admin={admin} />;
      case 'settings': return <SettingsPage admin={admin} />;
      default: return <Dashboard admin={admin} />;
    }
  };

  return (
    <AdminLayout admin={admin} page={page} onNavigate={setPage} onLogout={handleLogout}>
      {renderPage()}
    </AdminLayout>
  );
}
