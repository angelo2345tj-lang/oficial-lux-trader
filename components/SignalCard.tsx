import React, { memo, useCallback, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Share2,
  Save,
  Clock3,
  Target,
  BarChart3,
  Activity,
  Zap,
  Loader2,
  Check,
} from 'lucide-react';
import { TradeSignal, SignalType, AnalysisBlockStatus } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { shareOperation } from '../utils/shareOperation';
import ShareSignalImageCard from './ShareSignalImageCard';
import AISignalDetailPanel from './AISignalDetailPanel';

interface SignalCardProps {
  signal: TradeSignal;
  utcLabel?: string;
  onSave?: () => void;
}

const statusColors: Record<AnalysisBlockStatus, string> = {
  bullish: 'border-emerald-500/25 bg-emerald-500/5',
  bearish: 'border-red-500/25 bg-red-500/5',
  neutral: 'border-zinc-700 bg-zinc-900/50',
  warning: 'border-amber-500/25 bg-amber-500/5',
};

function SignalCardComponent({ signal, utcLabel, onSave }: SignalCardProps) {
  const isBuy = signal.type === SignalType.BUY;
  const isNeutral = signal.type === SignalType.NEUTRAL;
  const sym = signal.asset;
  const glow = isNeutral
    ? 'shadow-[0_0_40px_rgba(148,163,184,0.08)] border-zinc-600/30'
    : isBuy
      ? 'shadow-[0_0_40px_rgba(16,185,129,0.12)] border-emerald-500/20'
      : 'shadow-[0_0_40px_rgba(239,68,68,0.12)] border-red-500/20';

  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    setShareDone(false);
    try {
      await shareOperation(signal, shareRef.current, utcLabel);
      setShareDone(true);
      setTimeout(() => setShareDone(false), 2500);
    } catch {
      /* cancelado pelo usuário */
    } finally {
      setSharing(false);
    }
  }, [signal, utcLabel, sharing]);

  const displayConfidence = signal.confidence ?? signal.score;
  const scoreColor =
    displayConfidence >= 85
      ? 'text-emerald-400'
      : displayConfidence >= 72
        ? 'text-cyan-400'
        : displayConfidence >= 58
          ? 'text-amber-400'
          : 'text-orange-400';

  return (
    <div
      className={`w-full max-w-full rounded-2xl border bg-zinc-950/95 p-4 sm:p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 ${glow}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center ${
              isBuy ? 'bg-emerald-500/15' : 'bg-red-500/15'
            }`}
          >
            {isNeutral ? (
              <Activity className="text-zinc-400" size={28} />
            ) : isBuy ? (
              <TrendingUp className="text-emerald-400" size={28} />
            ) : (
              <TrendingDown className="text-red-400" size={28} />
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Lux Trader IA</p>
            <p
              className={`text-3xl font-black ${
                isNeutral ? 'text-zinc-300' : isBuy ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {signal.type === 'BUY' ? 'COMPRA' : 'VENDA'}
            </p>
            <p className="text-zinc-400 text-sm">{signal.asset}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase text-zinc-500">Score IA</p>
          <p className={`text-4xl sm:text-5xl font-black tabular-nums ${scoreColor}`}>
            {displayConfidence}%
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{signal.confidenceLabel}</p>
          {signal.winProbability != null && (
            <p className="text-[10px] text-cyan-500/80">Win {signal.winProbability}%</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {signal.timingMode && (
          <span className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-300 uppercase">
            <Zap className="w-3 h-3 inline mr-1" />
            {signal.timingMode}
          </span>
        )}
        {signal.marketCondition && (
          <span className="px-2 py-1 rounded-lg bg-zinc-800 text-[10px] text-zinc-400">
            {signal.marketCondition}
          </span>
        )}
        {signal.riskLevel && (
          <span
            className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
              signal.riskLevel === 'HIGH'
                ? 'bg-red-500/10 text-red-400'
                : signal.riskLevel === 'MEDIUM'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-400'
            }`}
          >
            Risco {signal.riskLevel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {[
          ['Entrada', formatPrice(signal.entry, sym), 'text-white'],
          ['SL', formatPrice(signal.sl, sym), 'text-red-400'],
          ['TP1', formatPrice(signal.tp1, sym), 'text-emerald-400'],
          ['TP2', formatPrice(signal.tp2, sym), 'text-emerald-400/90'],
          ['TP3', formatPrice(signal.tp3, sym), 'text-emerald-400/70'],
          ['R:R', signal.riskReward, 'text-cyan-400'],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-3">
            <p className="text-[10px] uppercase text-zinc-500">{l}</p>
            <p className={`text-base font-bold tabular-nums mt-1 break-all ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[10px]">
        <div className="rounded-lg bg-zinc-900/60 p-2 border border-zinc-800">
          <Clock3 className="w-3 h-3 text-zinc-500 mb-1" />
          <p className="text-zinc-500">Tempo</p>
          <p className="text-white font-bold">{signal.estimatedMinutes ?? '—'}m</p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-2 border border-zinc-800">
          <Target className="w-3 h-3 text-zinc-500 mb-1" />
          <p className="text-zinc-500">Inv.</p>
          <p className="text-orange-400 font-bold tabular-nums break-all">
            {signal.invalidation != null ? formatPrice(signal.invalidation, sym) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-2 border border-zinc-800">
          <Activity className="w-3 h-3 text-zinc-500 mb-1" />
          <p className="text-zinc-500">Vol.</p>
          <p className="text-white font-bold">{signal.volatility ?? '—'}%</p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-2 border border-zinc-800">
          <BarChart3 className="w-3 h-3 text-zinc-500 mb-1" />
          <p className="text-zinc-500">Spread</p>
          <p className="text-white font-bold">
            {signal.spread != null ? `${signal.spread.toFixed(1)} bps` : '—'}
          </p>
        </div>
      </div>

      {(signal.orderFlow || signal.institutionalBias) && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-1 text-xs text-zinc-400">
          {signal.orderFlow && <p>Order flow: {signal.orderFlow}</p>}
          {signal.institutionalBias && <p>Bias: {signal.institutionalBias}</p>}
          {signal.session && <p>Sessão: {signal.session}</p>}
        </div>
      )}

      {signal.confluences && signal.confluences.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase text-cyan-500/90 mb-2">Confluências</p>
          <div className="flex flex-wrap gap-1.5">
            {signal.confluences.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/15 text-[11px] text-cyan-300"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {signal.institutionalAnalysis && (
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-400 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Análise Institucional
          </p>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            {signal.institutionalAnalysis.decisionReason}
          </p>
          <div className="space-y-2">
            {signal.institutionalAnalysis.blocks.map((block) => (
              <div
                key={block.id}
                className={`rounded-xl border p-3 ${statusColors[block.status]}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">
                    {block.label}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{block.value}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                  {block.interpretation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {signal.risks && signal.risks.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase text-red-400/90 mb-2 flex items-center gap-1">
            <AlertTriangle size={12} /> Riscos detalhados
          </p>
          <ul className="space-y-1.5">
            {signal.risks.map((r, i) => (
              <li
                key={i}
                className="text-xs text-zinc-400 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AISignalDetailPanel
        signal={signal}
        winProbability={signal.winProbability}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6">
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="h-12 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-70 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20"
        >
          {sharing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : shareDone ? (
            <Check size={18} />
          ) : (
            <Share2 size={18} />
          )}
          {sharing ? 'Gerando imagem…' : shareDone ? 'Pronto!' : 'Compartilhar Operação'}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-sm flex items-center justify-center gap-2"
        >
          <Save size={18} />
          Salvar no Histórico
        </button>
      </div>

      {/* Card off-screen para export PNG premium */}
      <div
        className="fixed -left-[10000px] top-0 pointer-events-none"
        aria-hidden
      >
        <ShareSignalImageCard ref={shareRef} signal={signal} utcLabel={utcLabel} />
      </div>
    </div>
  );
}

const SignalCard = memo(SignalCardComponent);
export default SignalCard;
