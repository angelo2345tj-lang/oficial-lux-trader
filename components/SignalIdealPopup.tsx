import React, { useEffect } from 'react';
import { TradeSignal, SignalType } from '../types';

import Logo from './Logo';

import {
  TrendingUp,
  TrendingDown,
  X,
  Zap,
  Target,
  ShieldCheck
} from 'lucide-react';

interface SignalIdealPopupProps {
  signal: TradeSignal | null;
  winProbability?: number;
  onClose: () => void;
  onConfirm?: () => void;
}

const SignalIdealPopup: React.FC<SignalIdealPopupProps> = ({
  signal,
  winProbability,
  onClose,
  onConfirm,
}) => {

  useEffect(() => {

    if (!signal) return;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };

  }, [signal]);

  if (!signal) return null;

  const isBuy = signal.type === SignalType.BUY;

  const directionText = isBuy ? 'COMPRA' : 'VENDA';

  const displayScore = signal.confidence ?? signal.score;
  const isElite = displayScore >= 85;

  return (

    <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-500">

      {/* BACKDROP */}

      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
        onClick={onClose}
      />

      {/* POPUP */}

      <div
        className="
          relative
          w-full
          sm:max-w-md
          glass-morphism
          rounded-t-[3rem]
          sm:rounded-[3rem]
          border
          border-cyan-500/30
          shadow-[0_0_120px_rgba(34,211,238,0.25)]
          overflow-hidden
          animate-in
          slide-in-from-bottom-full
          sm:zoom-in-95
          duration-700
          max-h-[95vh]
          overflow-y-auto
          custom-scrollbar
        "
      >

        {/* GLOW */}

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-cyan-500/10 blur-[60px] pointer-events-none" />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-20 bg-amber-500/10 blur-[40px] pointer-events-none" />

        {/* BOTÃO FECHAR */}

        <button
          onClick={onClose}
          className="
            absolute
            top-5
            right-5
            z-20
            p-2.5
            bg-white/5
            rounded-full
            text-zinc-500
            hover:text-white
            border
            border-white/10
            transition-all
          "
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* CONTEÚDO */}

        <div className="relative z-10 p-6 sm:p-10 flex flex-col items-center text-center space-y-6">

          {/* LOGO */}

          <Logo
            className="w-32 h-32 sm:w-40 sm:h-40"
            animate
            variant="full"
          />

          {/* BADGE */}

          <div
            className={`
              inline-flex
              items-center
              gap-2
              px-5
              py-2
              rounded-full
              border
              text-[10px]
              font-black
              uppercase
              tracking-[0.35em]
              italic
              ${
                isElite
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.2)]'
                  : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
              }
            `}
          >
            <Zap className="w-4 h-4" />

            {isElite
              ? 'SINAL ELITE DETECTADO'
              : 'SINAL IDEAL DETECTADO'
            }
          </div>

          {/* DIREÇÃO */}

          <div
            className={`
              w-full
              p-6
              rounded-[2rem]
              border-2
              ${
                isBuy
                  ? 'border-blue-500/40 bg-blue-600/10'
                  : 'border-red-500/40 bg-red-600/10'
              }
            `}
          >

            <div className="flex items-center justify-center gap-4 mb-3">

              {isBuy ? (
                <TrendingUp className="w-10 h-10 text-blue-400" />
              ) : (
                <TrendingDown className="w-10 h-10 text-red-400" />
              )}

              <div className="text-left">

                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Operação
                </p>

                <p
                  className={`
                    text-3xl
                    font-black
                    italic
                    uppercase
                    ${
                      isBuy
                        ? 'text-blue-400'
                        : 'text-red-400'
                    }
                  `}
                >
                  {directionText}
                </p>

              </div>
            </div>

            <p className="text-2xl font-black text-white italic tracking-tighter">
              {signal.asset}
            </p>

          </div>

          {/* MÉTRICAS */}

          <div className="grid grid-cols-3 gap-3 w-full">

            <div className="p-4 rounded-2xl bg-black/50 border border-white/5">

              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                Score
              </p>

              <p className="text-2xl font-black italic text-cyan-400 mono mt-1">
                {displayScore}%
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-black/50 border border-white/5">

              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                Probabilidade
              </p>

              <p className="text-2xl font-black italic text-green-400 mono mt-1">
                {winProbability ?? '—'}%
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-black/50 border border-white/5">

              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                Entrada
              </p>

              <p className="text-sm font-black italic text-white mono mt-2">
                {signal.entry.toFixed(5)}
              </p>

            </div>
          </div>

          {/* TP E SL */}

          <div
            className="
              flex
              items-center
              gap-3
              w-full
              p-4
              rounded-2xl
              bg-black/40
              border
              border-white/5
              text-left
            "
          >

            <Target className="w-5 h-5 text-green-500 shrink-0" />

            <div>

              <p className="text-[8px] font-black text-zinc-600 uppercase">
                Take Profit
              </p>

              <p className="text-sm font-black mono text-green-400">
                {signal.tp1.toFixed(5)}
              </p>

            </div>

            <div className="ml-auto text-right">

              <p className="text-[8px] font-black text-zinc-600 uppercase">
                Stop Loss
              </p>

              <p className="text-sm font-black mono text-red-400">
                {signal.sl.toFixed(5)}
              </p>

            </div>
          </div>

          {/* MOTIVO */}

          <p
            className="
              text-[9px]
              font-bold
              text-zinc-600
              uppercase
              tracking-widest
              leading-relaxed
              px-4
            "
          >
            {signal.mainReason}
          </p>

          {/* BOTÕES */}

          <div className="flex flex-col sm:flex-row gap-3 w-full pt-2 pb-4 safe-area-bottom">

            <button
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
              className={`
                flex-1
                py-5
                rounded-[2rem]
                font-black
                uppercase
                text-[11px]
                tracking-[0.3em]
                flex
                items-center
                justify-center
                gap-3
                transition-all
                active:scale-95
                italic
                shadow-2xl
                ${
                  isBuy
                    ? 'bg-blue-600 hover:bg-blue-500 text-white border-b-4 border-blue-800'
                    : 'bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800'
                }
              `}
            >

              <ShieldCheck className="w-5 h-5" />

              EXECUTAR {directionText}

            </button>

            <button
              onClick={onClose}
              className="
                flex-1
                py-5
                rounded-[2rem]
                font-black
                uppercase
                text-[11px]
                tracking-[0.3em]
                bg-white/5
                border
                border-white/10
                text-zinc-400
                hover:text-white
                transition-all
                italic
              "
            >
              ANALISAR DEPOIS
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalIdealPopup;