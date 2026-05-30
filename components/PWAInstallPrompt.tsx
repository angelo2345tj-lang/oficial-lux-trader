import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const dismissed = sessionStorage.getItem('lux_pwa_install_dismissed');
    if (dismissed) setHidden(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (isStandalone || hidden || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  };

  return (
    <div className="fixed bottom-28 left-3 right-3 z-[250] max-w-md mx-auto sm:left-auto sm:right-6 sm:bottom-32">
      <div className="glass-morphism rounded-2xl border border-blue-500/20 p-4 flex items-start gap-3 shadow-2xl">
        <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-white">
            Instalar Lux Trader FX
          </p>
          <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
            App instalável — modo standalone, offline e alertas push.
          </p>
          <button
            type="button"
            onClick={install}
            className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest"
          >
            Instalar aplicativo
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('lux_pwa_install_dismissed', '1');
            setHidden(true);
          }}
          className="text-zinc-600 hover:text-white shrink-0"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
