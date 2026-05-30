
import React from 'react';
import { Info, Lock } from 'lucide-react';

const AutomationPanel: React.FC = () => {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 h-full min-h-[500px] animate-view-entry">
       <div className="w-24 h-24 bg-zinc-800/10 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
          <Lock className="w-10 h-10 text-zinc-700" />
       </div>
       <div className="max-w-xs space-y-3">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-zinc-400">Automação Restrita</h2>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-relaxed">Este terminal está configurado exclusivamente para análise de fluxo e emissão de sinais de alta precisão. A execução automatizada é um protocolo desativado para esta versão do Firmware Elite.</p>
       </div>
       <div className="flex items-center gap-3 bg-blue-600/5 px-6 py-3 rounded-2xl border border-blue-500/10">
          <Info className="w-4 h-4 text-blue-500" />
          <span className="text-[8px] font-black uppercase tracking-widest text-blue-500/70">Consulte o Manual para Operação Manual</span>
       </div>
    </div>
  );
};

export default AutomationPanel;
