import { Download, Smartphone, Share2, Plus, ArrowRight, X } from 'lucide-react';

interface InstallPageProps {
  onClose: () => void;
}

export default function InstallPage({ onClose }: InstallPageProps) {
  const handleInstall = () => {
    // Check if PWA installation is available
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        (window as any).deferredPrompt = null;
        onClose();
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-md mx-auto p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Instalar Aplicativo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 mb-6 text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Smartphone size={40} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Response Live no seu celular</h3>
          <p className="text-slate-600 text-sm mt-2">Acesse o app como um aplicativo real, mesmo sem conexão</p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">1</div>
              <div>
                <h4 className="font-semibold text-slate-900">Android</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Abra o menu (⋮) ou menu do Chrome → "Instalar app" ou "Adicionar à tela inicial"
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">2</div>
              <div>
                <h4 className="font-semibold text-slate-900">iPhone/iPad</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Toque em <Share2 size={14} className="inline" /> → "Adicionar à tela inicial"
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">✓</div>
              <div>
                <h4 className="font-semibold text-slate-900">Pronto!</h4>
                <p className="text-sm text-slate-600 mt-1">
                  O app aparecerá na sua tela inicial. Abra como um aplicativo normal
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all"
          >
            Depois
          </button>
          <button
            onClick={handleInstall}
            className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
          >
            <Download size={18} />
            Instalar
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Você pode instalar em qualquer momento pelo menu do navegador
        </p>
      </div>
    </div>
  );
}
