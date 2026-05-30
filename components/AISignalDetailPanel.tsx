import React, { memo, useMemo } from 'react';
import {
  Activity,
  BarChart3,
  Brain,
  Gauge,
  Layers,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { TradeSignal, SignalType } from '../types';
import { formatPrice } from '../utils/formatPrice';

interface Props {
  signal: TradeSignal;
  winProbability?: number;
  idealTimeframe?: string;
}

function Metric({
  label,
  value,
  sub,
  accent = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/70 p-3 min-w-0">
      <p className="text-[9px] uppercase tracking-widest text-zinc-500 truncate">{label}</p>
      <p className={`text-sm font-black tabular-nums mt-1 break-all ${accent}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function AISignalDetailPanelComponent({ signal, winProbability, idealTimeframe }: Props) {
  const sym = signal.asset;
  const ind = signal.indicatorCalculations;
  const wp = winProbability ?? signal.winProbability;
  const isBuy = signal.type === SignalType.BUY;

  const statusLabel = useMemo(() => {
    if (signal.confirmationStatus) return signal.confirmationStatus;
    if (signal.timingMode === 'CONFIRMED') return 'Aguardando confirmação de candle';
    return 'Entrada ativa — modo instantâneo';
  }, [signal.confirmationStatus, signal.timingMode]);

  const entryWindow = useMemo(() => {
    const mins = signal.estimatedMinutes;
    if (!mins) return 'Monitorar próximos candles';
    return `Janela ideal: ~${mins} min · TF ${idealTimeframe ?? 'atual'}`;
  }, [signal.estimatedMinutes, idealTimeframe]);

  const indicatorList = useMemo(
    () =>
      [
        { name: 'RSI', val: ind?.rsi },
        { name: 'MACD', val: ind?.macd },
        { name: 'EMA 8/21/50', val: ind?.ema },
        { name: 'Bollinger', val: ind?.bollinger },
        { name: 'ADX', val: ind?.adx },
        { name: 'Volume', val: ind?.volume },
        { name: 'Liquidez', val: ind?.liquidity },
        { name: 'Estrutura', val: ind?.structure },
        { name: 'VWAP', val: ind?.vwap },
        { name: 'Momentum', val: ind?.momentum },
        { name: 'Macro', val: ind?.macroTrend },
        { name: 'Candle', val: ind?.candleConfirm },
      ].filter((x) => x.val),
    [ind]
  );

  return (
    <div className="mt-5 rounded-2xl border border-blue-500/15 bg-gradient-to-b from-blue-950/30 to-zinc-950/80 p-4 sm:p-5 space-y-4 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Brain className="w-5 h-5 text-cyan-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">
            Painel IA Operacional
          </p>
          <p className="text-[10px] text-zinc-500 truncate">{statusLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric
          label="AI Score"
          value={`${signal.confidence ?? signal.score}%`}
          accent="text-cyan-400"
        />
        <Metric
          label="Força do sinal"
          value={signal.aiStrengthTier ?? signal.confidenceLabel ?? '—'}
          sub={signal.strength}
        />
        <Metric
          label="Qualidade do setup"
          value={
            signal.signalQuality != null
              ? `${signal.signalQuality}%`
              : signal.confidenceLabel ?? '—'
          }
          sub="Score estrutural composto"
        />
        <Metric
          label="Nível de risco"
          value={signal.riskLevel ?? '—'}
          sub={signal.marketCondition ?? signal.trend}
        />
      </div>

      {signal.mainReason && (
        <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
          <p className="text-[10px] uppercase text-zinc-500 mb-1">Motivo do sinal</p>
          <p className="text-xs text-zinc-200 leading-relaxed">{signal.mainReason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Regime" value={signal.localAiRegime ?? signal.marketCondition ?? '—'} />
        <Metric
          label="BOS"
          value={signal.bosActive ? 'Detectado' : '—'}
          accent={signal.bosActive ? 'text-emerald-400' : undefined}
        />
        <Metric
          label="CHOCH"
          value={signal.chochActive ? 'Detectado' : '—'}
          accent={signal.chochActive ? 'text-amber-400' : undefined}
        />
        <Metric
          label="MTF confirm."
          value={signal.mtfConfirmationPct != null ? `${signal.mtfConfirmationPct}%` : '—'}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metric label="Tendência" value={ind?.macroTrend ?? signal.trend} />
        <Metric label="Momentum" value={ind?.momentum ?? `${signal.sentiment ?? '—'}`} />
        <Metric label="Volatilidade" value={`${signal.volatility ?? '—'}%`} />
        <Metric
          label="Confirmação estrutural"
          value={ind?.structure ?? signal.smcStatus ?? '—'}
        />
        <Metric label="Confirmação candle" value={ind?.candleConfirm ?? '—'} />
        <Metric
          label="Assertividade"
          value={wp != null ? `${wp}%` : '—'}
          sub="Probabilidade operacional"
          accent="text-emerald-400"
        />
        <Metric label="R:R" value={signal.riskReward} accent="text-cyan-300" />
        <Metric label="SL inteligente" value={formatPrice(signal.sl, sym)} accent="text-red-400" />
        <Metric
          label="TP automático"
          value={formatPrice(signal.tp1, sym)}
          sub={`TP2 ${formatPrice(signal.tp2, sym)} · TP3 ${formatPrice(signal.tp3, sym)}`}
          accent="text-emerald-400"
        />
      </div>

      <div className="rounded-xl border border-white/5 bg-black/30 p-3 flex items-start gap-3">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-amber-400/90 font-bold">Janela de entrada</p>
          <p className="text-xs text-zinc-300 mt-1">{entryWindow}</p>
          <p className="text-[10px] text-zinc-500 mt-1">
            Execução: {signal.executionType ?? 'INTRADAY'} · Sessão: {signal.session ?? '—'}
          </p>
        </div>
      </div>

      {indicatorList.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> Indicadores utilizados
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {indicatorList.map((item) => (
              <div
                key={item.name}
                className="flex justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[11px]"
              >
                <span className="text-zinc-500 font-bold uppercase shrink-0">{item.name}</span>
                <span className="text-zinc-300 text-right break-all">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {signal.mtf && (
        <div className="flex flex-wrap gap-2">
          {(['m5', 'm15', 'h1', 'h4'] as const).map((tf) => (
            <span
              key={tf}
              className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400"
            >
              {tf.toUpperCase()}: {signal.mtf[tf]}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-zinc-400">
            Bias: <strong className="text-white">{signal.institutionalBias ?? signal.smcStatus}</strong>
          </span>
        </div>
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-zinc-400">
            Liquidez: <strong className="text-white">{signal.liquidity}%</strong>
          </span>
        </div>
        <div className="rounded-lg border border-violet-500/15 bg-violet-500/5 p-2 flex items-center gap-2 col-span-2">
          <Shield className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="text-zinc-400">
            Fluxo institucional:{' '}
            <strong className="text-white">{signal.orderFlow ?? signal.institutionalBias ?? '—'}</strong>
          </span>
        </div>
        <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 p-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-zinc-400">
            Status: <strong className={isBuy ? 'text-emerald-400' : 'text-red-400'}>
              {isBuy ? 'COMPRA' : 'VENDA'}
            </strong>
          </span>
        </div>
      </div>

      {signal.scoreBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {signal.scoreBreakdown.positives.length > 0 && (
            <div>
              <p className="text-[9px] uppercase text-emerald-500/80 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Drivers
              </p>
              <ul className="space-y-1">
                {signal.scoreBreakdown.positives.slice(0, 5).map((p, i) => (
                  <li key={i} className="text-[10px] text-zinc-400">
                    + {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {signal.scoreBreakdown.negatives.length > 0 && (
            <div>
              <p className="text-[9px] uppercase text-amber-500/80 mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> Filtros
              </p>
              <ul className="space-y-1">
                {signal.scoreBreakdown.negatives.slice(0, 5).map((n, i) => (
                  <li key={i} className="text-[10px] text-zinc-500">
                    − {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {signal.aiExplanation && (
        <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3">
          <p className="text-[10px] uppercase text-cyan-400/90 mb-2 font-bold">
            Explicação da entrada da IA
          </p>
          <p className="text-xs text-zinc-300 leading-relaxed">{signal.aiExplanation}</p>
        </div>
      )}
    </div>
  );
}

const AISignalDetailPanel = memo(AISignalDetailPanelComponent);
export default AISignalDetailPanel;
