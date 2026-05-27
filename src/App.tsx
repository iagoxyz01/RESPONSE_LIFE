import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDashboard from './pages/patient/PatientDashboard';
import NewRequestPage from './pages/patient/NewRequestPage';
import RequestDetailPage from './pages/patient/RequestDetailPage';
import CaregiverDashboard from './pages/caregiver/CaregiverDashboard';
import CaregiverRequestPage from './pages/caregiver/CaregiverRequestPage';
import FinancialPage from './pages/caregiver/FinancialPage';
import ChatListPage from './pages/ChatListPage';
import ChatPage from './pages/ChatPage';
import HistoryPage from './pages/HistoryPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import RatingPage from './pages/RatingPage';
import PaymentPage from './pages/PaymentPage';
import WalletPage from './pages/WalletPage';
import InstallPage from './pages/InstallPage';
import MonitoringHistoryPage from './pages/MonitoringHistoryPage';

type Page =
  | 'dashboard'
  | 'new-request'
  | 'request-detail'
  | 'chat'
  | 'chat-list'
  | 'history'
  | 'notifications'
  | 'profile'
  | 'financial'
  | 'rating'
  | 'payment'
  | 'wallet'
  | 'monitoring';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const { showToast } = useToast();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [chatRequestId, setChatRequestId] = useState<string | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const hasShownPrompt = sessionStorage.getItem('install_prompt_shown');
    if (isInstalled || hasShownPrompt) return;

    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setTimeout(() => setShowInstallPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Show welcome toast on first load
  useEffect(() => {
    if (profile && page === 'dashboard') {
      const welcomeKey = `welcome_${profile.id}`;
      if (!sessionStorage.getItem(welcomeKey)) {
        sessionStorage.setItem(welcomeKey, 'true');
        setTimeout(() => {
          showToast(`Bem-vindo, ${profile.full_name?.split(' ')[0]}!`, 'success');
        }, 500);
      }
    }
  }, [profile, page, showToast]);

  // Debug navigation
  useEffect(() => {
    console.log('Navigation state:', { page, selectedRequestId, chatRequestId });
  }, [page, selectedRequestId, chatRequestId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/30">
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
          <p className="text-white/50 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    if (authMode === 'register') {
      return (
        <RegisterPage
          onBack={() => {
            setAuthMode('login');
            setRegisteredSuccess(true);
          }}
        />
      );
    }
    return (
      <LoginPage
        onShowRegister={() => { setAuthMode('register'); setRegisteredSuccess(false); }}
        registeredSuccess={registeredSuccess}
      />
    );
  }

  const isCaregiver = profile.user_type === 'caregiver';

  // Full-screen pages (no bottom nav)
  const isFullScreen = page === 'chat' || page === 'rating' || page === 'payment' || page === 'new-request' || page === 'monitoring';

  // Chat page
  if (page === 'chat' && chatRequestId) {
    return (
      <Layout page="" onNavigate={() => {}} hideNav>
        <ChatPage
          requestId={chatRequestId}
          onBack={() => {
            setChatRequestId(null);
            setPage('chat-list');
          }}
        />
      </Layout>
    );
  }

  // Rating page
  if (page === 'rating' && selectedRequestId) {
    return (
      <Layout page="" onNavigate={() => {}} hideNav>
        <RatingPage
          requestId={selectedRequestId}
          onBack={() => {
            setSelectedRequestId(null);
            setPage('dashboard');
          }}
        />
      </Layout>
    );
  }

  // Payment page
  if (page === 'payment' && selectedRequestId) {
    return (
      <Layout page="" onNavigate={() => {}} hideNav>
        <PaymentPage
          requestId={selectedRequestId}
          onBack={() => {
            setSelectedRequestId(null);
            setPage('request-detail');
          }}
          onSuccess={() => {
            setSelectedRequestId(null);
            setPage('dashboard');
            showToast('Pagamento confirmado com sucesso!', 'success');
          }}
        />
      </Layout>
    );
  }

  // Monitoring history page
  if (page === 'monitoring' && selectedRequestId) {
    return (
      <Layout page="" onNavigate={() => {}} hideNav>
        <MonitoringHistoryPage
          requestId={selectedRequestId}
          onBack={() => {
            setPage('request-detail');
          }}
        />
      </Layout>
    );
  }

  // New request page
  if (page === 'new-request' && !isCaregiver) {
    return (
      <Layout page="" onNavigate={() => {}} hideNav>
        <NewRequestPage
          onBack={() => setPage('dashboard')}
          onSuccess={(id) => {
            setSelectedRequestId(id);
            setPage('request-detail');
            showToast('Solicitacao criada com sucesso!', 'success');
          }}
        />
      </Layout>
    );
  }

  const renderContent = () => {
    if (page === 'request-detail' && selectedRequestId) {
      if (isCaregiver) {
        return (
          <CaregiverRequestPage
            requestId={selectedRequestId}
            onBack={() => {
              setSelectedRequestId(null);
              setPage('dashboard');
            }}
            onOpenChat={(id) => {
              setChatRequestId(id);
              setPage('chat');
            }}
            onRate={(id) => {
              setSelectedRequestId(id);
              setPage('rating');
            }}
          />
        );
      }
      return (
        <RequestDetailPage
          requestId={selectedRequestId}
          onBack={() => {
            setSelectedRequestId(null);
            setPage('dashboard');
          }}
          onOpenChat={(id) => {
            setChatRequestId(id);
            setPage('chat');
          }}
          onOpenMonitoring={(id) => {
            setSelectedRequestId(id);
            setPage('monitoring');
          }}
          onOpenPayment={(id) => {
            setSelectedRequestId(id);
            setPage('payment');
          }}
          onRate={(id) => {
            setSelectedRequestId(id);
            setPage('rating');
          }}
        />
      );
    }

    if (page === 'chat-list') {
      return (
        <ChatListPage
          onOpenChat={(id) => {
            setChatRequestId(id);
            setPage('chat');
          }}
        />
      );
    }

    if (page === 'history') {
      return (
        <HistoryPage
          onViewRequest={(id) => {
            setSelectedRequestId(id);
            setPage('request-detail');
          }}
        />
      );
    }

    if (page === 'notifications') {
      return <NotificationsPage />;
    }

    if (page === 'profile') {
      return <ProfilePage />;
    }

    if (page === 'financial' && isCaregiver) {
      return <FinancialPage />;
    }

    if (page === 'wallet' && isCaregiver) {
      return <WalletPage />;
    }

    // Dashboard
    if (isCaregiver) {
      return (
        <CaregiverDashboard
          onViewRequest={(id) => {
            setSelectedRequestId(id);
            setPage('request-detail');
          }}
        />
      );
    }

    return (
      <PatientDashboard
        onNewRequest={() => setPage('new-request')}
        onViewRequest={(id) => {
          setSelectedRequestId(id);
          setPage('request-detail');
        }}
      />
    );
  };

  const navPage = ['new-request', 'request-detail', 'wallet', 'monitoring'].includes(page) ? 'dashboard' : page;

  return (
    <>
      <Layout
        page={navPage}
        onNavigate={(p) => {
          setSelectedRequestId(null);
          setPage(p as Page);
        }}
      >
        {renderContent()}
      </Layout>
      {showInstallPrompt && (
        <InstallPage
          onClose={() => {
            setShowInstallPrompt(false);
            sessionStorage.setItem('install_prompt_shown', 'true');
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
