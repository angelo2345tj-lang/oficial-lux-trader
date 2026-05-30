import React, { memo, useRef, useState } from 'react';

import { TradeSignal, SignalType } from '../types';

import {

  TrendingUp,

  TrendingDown,

  Target,

  Shield,

  Clock,

  Ban,

  Save,

  Share2,

  Loader2,

  Check,

} from 'lucide-react';

import { TIMEFRAMES } from '../constants';

import { shareSignalImage } from '../utils/shareSignal';



interface Props {

  signal: TradeSignal;

  winProbability?: number;

  timeframe?: string;

  language?: 'pt_BR' | 'en_US';

  onSave?: () => void;

}



const PremiumSignalCard: React.FC<Props> = memo(

  ({ signal, winProbability, timeframe, language = 'pt_BR', onSave }) => {

    const isBuy = signal.type === SignalType.BUY;

    const isPt = language === 'pt_BR';

    const directionLabel = isPt

      ? isBuy

        ? 'COMPRA'

        : 'VENDA'

      : isBuy

        ? 'CALL'

        : 'PUT';

    const confidence = signal.confidence ?? winProbability ?? signal.score;

    const shareRef = useRef<HTMLDivElement>(null);

    const [sharing, setSharing] = useState(false);

    const [shareDone, setShareDone] = useState(false);



    const fmt = (n: number) => {

      if (n >= 1000) return n.toFixed(2);

      if (n >= 10) return n.toFixed(4);

      return n.toFixed(5);

    };



    const tfLabel =

      TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe ?? '—';



    const handleShare = async () => {

      if (!shareRef.current || sharing) return;

      setSharing(true);

      try {

        await shareSignalImage(

          shareRef.current,

          `Lux-${signal.asset}-${Date.now()}.png`,

          `Lux Trader — ${signal.asset} ${directionLabel}`

        );

        setShareDone(true);

        setTimeout(() => setShareDone(false), 2500);

      } catch {

        /* usuário cancelou share ou erro */

      } finally {

        setSharing(false);

      }

    };



    const rows: { label: string; value: string; accent?: string }[] = [

      { label: isPt ? 'Entrada' : 'Entry', value: fmt(signal.entry), accent: 'text-blue-400' },

      { label: 'Stop Loss', value: fmt(signal.sl), accent: 'text-red-400' },

      { label: 'Take Profit', value: fmt(signal.tp1), accent: 'text-emerald-400' },

    ];

    if (signal.invalidation != null) {

      rows.push({

        label: isPt ? 'Invalidação' : 'Invalidation',

        value: fmt(signal.invalidation),

        accent: 'text-amber-400',

      });

    }

    if (signal.estimatedMinutes != null) {

      rows.push({

        label: isPt ? 'Tempo estimado' : 'Est. time',

        value: `~${signal.estimatedMinutes} min`,

        accent: 'text-zinc-300',

      });

    }



    return (

      <div className="space-y-3">

        {/* Card visível */}

        <div

          className={`rounded-2xl border p-5 sm:p-6 backdrop-blur-xl transition-all duration-300 ${

            isBuy

              ? 'border-emerald-500/25 bg-emerald-500/[0.04] shadow-[0_0_48px_rgba(16,185,129,0.1)]'

              : 'border-red-500/25 bg-red-500/[0.04] shadow-[0_0_48px_rgba(239,68,68,0.1)]'

          }`}

        >

          <div className="flex flex-col gap-4">

            <div

              className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${

                isBuy ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'

              }`}

            >

              <div className="flex items-center gap-3 min-w-0">

                {isBuy ? (

                  <TrendingUp className="w-7 h-7 text-emerald-400 shrink-0" />

                ) : (

                  <TrendingDown className="w-7 h-7 text-red-400 shrink-0" />

                )}

                <div className="min-w-0">

                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 truncate">

                    {signal.asset}

                  </p>

                  <h2

                    className={`text-2xl sm:text-3xl font-black tracking-tight ${

                      isBuy ? 'text-emerald-400' : 'text-red-400'

                    }`}

                  >

                    {directionLabel}

                  </h2>

                </div>

              </div>

            </div>



            <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-center">

              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 mb-1">

                {isPt ? 'Confiança' : 'Confidence'}

              </p>

              <p className="text-3xl font-black text-white tabular-nums">{confidence}%</p>

            </div>



            <div className="flex flex-col gap-2.5">

              {rows.map((row) => (

                <div

                  key={row.label}

                  className="rounded-xl border border-white/[0.06] bg-black/35 px-4 py-3 flex items-center justify-between gap-3"

                >

                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">

                    {row.label}

                  </span>

                  <span className={`text-base font-bold tabular-nums ${row.accent ?? 'text-white'}`}>

                    {row.value}

                  </span>

                </div>

              ))}

            </div>

          </div>

        </div>



        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

          {onSave && (

            <button

              type="button"

              onClick={onSave}

              className="w-full py-3.5 rounded-xl border border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"

            >

              <Save className="w-4 h-4" />

              Salvar operação

            </button>

          )}

          <button

            type="button"

            onClick={handleShare}

            disabled={sharing}

            className={`w-full py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${

              onSave ? '' : 'sm:col-span-2'

            } bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white shadow-[0_0_24px_rgba(37,99,235,0.25)]`}

          >

            {sharing ? (

              <Loader2 className="w-4 h-4 animate-spin" />

            ) : shareDone ? (

              <Check className="w-4 h-4" />

            ) : (

              <Share2 className="w-4 h-4" />

            )}

            {sharing ? 'Gerando…' : shareDone ? 'Pronto!' : 'Compartilhar operação'}

          </button>

        </div>



        {/* Card oculto para export (share) */}

        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden>

          <div

            ref={shareRef}

            className="w-[400px] rounded-3xl border border-white/10 bg-[#050507] p-8 text-white"

            style={{ fontFamily: 'system-ui, sans-serif' }}

          >

            <div className="flex items-center justify-between mb-6">

              <div>

                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Lux Trader FX</p>

                <h1 className="text-xl font-black italic mt-1">Lux Trader IA</h1>

              </div>

              <div

                className={`px-3 py-1 rounded-lg text-xs font-black ${

                  isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'

                }`}

              >

                {directionLabel}

              </div>

            </div>

            <p className="text-3xl font-black mb-1">{signal.asset}</p>

            <p className="text-sm text-zinc-500 mb-6">{tfLabel}</p>

            <div className="space-y-3 text-sm">

              <div className="flex justify-between border-b border-white/5 pb-2">

                <span className="text-zinc-500">Confiança</span>

                <span className="font-bold">{confidence}%</span>

              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">

                <span className="text-zinc-500">Entrada</span>

                <span className="font-mono text-blue-400">{fmt(signal.entry)}</span>

              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">

                <span className="text-zinc-500">Stop</span>

                <span className="font-mono text-red-400">{fmt(signal.sl)}</span>

              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">

                <span className="text-zinc-500">Take</span>

                <span className="font-mono text-emerald-400">{fmt(signal.tp1)}</span>

              </div>

            </div>

            <p className="text-[10px] text-zinc-600 mt-8 uppercase tracking-widest">

              {new Date(signal.timestamp).toLocaleString('pt-BR')}

            </p>

            <p className="text-[9px] text-blue-500/80 mt-2 uppercase tracking-[0.2em]">

              Gerado por Lux Trader IA

            </p>

          </div>

        </div>

      </div>

    );

  }

);



PremiumSignalCard.displayName = 'PremiumSignalCard';

export default PremiumSignalCard;

