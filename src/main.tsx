import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

window.addEventListener('appinstalled', () => {
  (window as any).deferredPrompt = null;
});

const isAdmin = window.location.pathname.startsWith('/admin');

const App = lazy(() => import('./App.tsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isAdmin ? <AdminApp /> : <App />}
    </Suspense>
  </StrictMode>
);
