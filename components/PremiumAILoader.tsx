import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const STEPS = [
  'ANALISANDO MERCADO',
  'PROCESSANDO CONFLUÊNCIAS',
  'VALIDANDO IA',
  'CONFIRMANDO ENTRADA',
  'GERANDO SINAL',
] as const;

interface Props {
  visible: boolean;
}

const PremiumAILoader: React.FC<Props> = ({ visible }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    if (!visible) {
      setStepIdx(0);
      setProgress(12);
      return;
    }
    const stepTimer = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, 1400);
    const progTimer = setInterval(() => {
      setProgress((p) => (p >= 92 ? 18 : p + 8 + Math.random() * 6));
    }, 400);
    return () => {
      clearInterval(stepTimer);
      clearInterval(progTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="glass-morphism rounded-2xl border border-cyan-500/25 p-5 space-y-4 shadow-[0_0_40px_rgba(6,182,212,0.12)] overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-600/10 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300 animate-pulse truncate">
            {STEPS[stepIdx]}
          </p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1 tracking-widest">
            Scanner IA institucional
          </p>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-900 border border-white/5 overflow-hidden relative z-10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default PremiumAILoader;
