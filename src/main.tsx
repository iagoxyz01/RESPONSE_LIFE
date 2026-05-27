import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// PWA Install Prompt Handler
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing
  e.preventDefault();
  // Stash the event for later use
  deferredPrompt = e;
  // Show install banner after 3 seconds
  setTimeout(() => {
    if (deferredPrompt) {
      (window as any).deferredPrompt = deferredPrompt;
    }
  }, 3000);
});

window.addEventListener('appinstalled', () => {
  console.log('Response Live installed as PWA');
  deferredPrompt = null;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
