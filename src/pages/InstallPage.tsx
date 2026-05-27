import { Download, X, Heart } from 'lucide-react';

interface InstallPageProps {
  onClose: () => void;
}

export default function InstallPage({ onClose }: InstallPageProps) {
  const handleInstall = () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        (window as any).deferredPrompt = null;
        onClose();
      });
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full p-6 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Heart size={24} className="text-white fill-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base">Response Live</p>
              <p className="text-xs text-slate-500">Adicionar à tela inicial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X size={22} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all"
          >
            Agora não
          </button>
          <button
            onClick={handleInstall}
            className="py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
          >
            <Download size={16} />
            Instalar app
          </button>
        </div>
      </div>
    </div>
  );
}
