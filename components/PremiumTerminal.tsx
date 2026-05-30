import React, { memo, useState, useMemo } from 'react';
import {
  Asset,
  TradeSignal,
  SignalTimingMode,
} from '../types';
import TradingViewWidget from './TradingViewWidget';
import SignalCard from './SignalCard';
import PremiumAILoader from './PremiumAILoader';
import {
  Loader2,
  Wifi,
  WifiOff,
  ChevronDown,
  Zap,
  Shield,
  Star,
  Globe,
  Cpu,
} from 'lucide-react';
import { TIMEFRAMES, CHART_TIMEZONES } from '../constants';
import { resolveBlockReasonDisplay } from '../services/institutional/blockReasonUI';

interface Props {
  asset: Asset;
  timeframe: string;
  theme: 'dark' | 'light';
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  livePrice: number;
  wsStatus: string;
  dataProvider: string | null;
  userBanca: number;
  todayPnl: number;
  timingMode: SignalTimingMode;
  onTimingModeChange: (m: SignalTimingMode) => void;
  onAssetClick: () => void;
  onTimeframeClick: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  scanError: string | null;
  scanBlockCode?: string | null;
  signal: TradeSignal | null;
  analyzeLabel: string;
  favoriteAssets: string[];
  favoriteTimeframes: string[];
  onToggleFavoriteAsset: (symbol: string) => void;
  onToggleFavoriteTimeframe: (tf: string) => void;
  onSelectFavoriteAsset?: (symbol: string) => void;
  onSelectFavoriteTimeframe?: (tf: string) => void;
  onSaveSignal?: () => void;
  autoAIEnabled?: boolean;
  onToggleAutoAI?: () => void;
}

const PremiumTerminal: React.FC<Props> = memo(
  ({
    asset,
    timeframe,
    theme,
    timezone,
    onTimezoneChange,
    livePrice,
    wsStatus,
    dataProvider,
    userBanca,
    todayPnl,
    timingMode,
    onTimingModeChange,
    onAssetClick,
    onTimeframeClick,
    onAnalyze,
    isAnalyzing,
    scanError,
    scanBlockCode,
    signal,
    analyzeLabel,
    favoriteAssets,
    favoriteTimeframes,
    onToggleFavoriteAsset,
    onToggleFavoriteTimeframe,
    onSelectFavoriteAsset,
    onSelectFavoriteTimeframe,
    onSaveSignal,
    autoAIEnabled = false,
    onToggleAutoAI,
  }) => {
    const [tzOpen, setTzOpen] = useState(false);
    const wsOk =
      wsStatus === 'connected' ||
      wsStatus === 'fallback' ||
      (dataProvider?.toLowerCase().includes('binance') ?? false);
    const tzCurrent =
      CHART_TIMEZONES.find((z) => z.value === timezone) ?? CHART_TIMEZONES[0];

    const connectionLabel = useMemo(() => {
      const prov = dataProvider?.toLowerCase() ?? '';
      if (prov.includes('binance')) return 'Binance Live';
      if (wsOk) return `${dataProvider ?? 'Market'} Live`;
      return 'Offline';
    }, [dataProvider, wsOk]);

    return (
      <div className="flex flex-col gap-4 p-3 sm:p-5 w-full max-w-3xl mx-auto min-h-0 overflow-x-hidden pb-6">
        {/* Header mobile-first */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Saldo</p>
              <p className="text-xl font-black text-white tabular-nums">
                ${userBanca.toLocaleString()}
              </p>
              <p
                className={`text-[10px] font-bold mt-0.5 ${
                  todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                Hoje {todayPnl >= 0 ? '+' : ''}
                {todayPnl.toFixed(2)}
              </p>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">
                Meta diária · Safe Lift ativo
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                  wsOk
                    ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5'
                    : 'text-red-400 border-red-500/20 bg-red-500/5'
                }`}
              >
                {wsOk ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {connectionLabel}
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTzOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-zinc-950 text-[10px] font-bold text-zinc-300"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {tzCurrent.utc}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {tzOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 shadow-xl py-1">
                    {CHART_TIMEZONES.map((z) => (
                      <button
                        key={z.value}
                        type="button"
                        onClick={() => {
                          onTimezoneChange(z.value);
                          setTzOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${
                          timezone === z.value ? 'text-cyan-400' : 'text-zinc-400'
                        }`}
                      >
                        {z.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ativo + TF */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAssetClick}
              className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-sm font-bold text-white"
            >
              {asset.symbol}
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </button>
            <button
              type="button"
              onClick={() => onToggleFavoriteAsset(asset.symbol)}
              className={`p-3 rounded-xl border ${
                favoriteAssets.includes(asset.symbol)
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  : 'border-white/10 text-zinc-500'
              }`}
            >
              <Star
                className={`w-5 h-5 ${
                  favoriteAssets.includes(asset.symbol) ? 'fill-current' : ''
                }`}
              />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onTimeframeClick}
              className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-sm font-semibold text-zinc-200"
            >
              {TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe}
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            </button>
            <button
              type="button"
              onClick={() => onToggleFavoriteTimeframe(timeframe)}
              className={`p-3 rounded-xl border ${
                favoriteTimeframes.includes(timeframe)
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  : 'border-white/10 text-zinc-500'
              }`}
            >
              <Star
                className={`w-5 h-5 ${
                  favoriteTimeframes.includes(timeframe) ? 'fill-current' : ''
                }`}
              />
            </button>
          </div>
          <div className="flex rounded-xl border border-white/10 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => onTimingModeChange('INSTANT')}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase rounded-lg ${
                timingMode === 'INSTANT' ? 'bg-blue-600 text-white' : 'text-zinc-500'
              }`}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Instantâneo
            </button>
            <button
              type="button"
              onClick={() => onTimingModeChange('CONFIRMED')}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase rounded-lg ${
                timingMode === 'CONFIRMED' ? 'bg-blue-600 text-white' : 'text-zinc-500'
              }`}
            >
              <Shield className="w-3 h-3 inline mr-1" />
              Confirmado
            </button>
          </div>
        </div>

        {(favoriteAssets.length > 0 || favoriteTimeframes.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {favoriteAssets.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => onSelectFavoriteAsset?.(sym)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                  sym === asset.symbol
                    ? 'border-amber-500/40 text-amber-300'
                    : 'border-white/10 text-zinc-500'
                }`}
              >
                ⭐ {sym}
              </button>
            ))}
            {favoriteTimeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onSelectFavoriteTimeframe?.(tf)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                  tf === timeframe
                    ? 'border-blue-500/40 text-blue-300'
                    : 'border-white/10 text-zinc-500'
                }`}
              >
                ⭐ {TIMEFRAMES.find((t) => t.value === tf)?.label ?? tf}
              </button>
            ))}
          </div>
        )}

        {/* Gráfico full width */}
        <TradingViewWidget
          asset={asset}
          currentSignal={scanBlockCode ? null : signal}
          timeframe={timeframe}
          timezone={timezone}
          theme={theme}
        />

        {livePrice > 0 && (
          <p className="text-center text-[10px] font-mono text-zinc-500 tabular-nums">
            {livePrice.toFixed(5)}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (isAnalyzing) return;
              onAnalyze();
            }}
            disabled={isAnalyzing}
            aria-busy={isAnalyzing}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_0_32px_rgba(37,99,235,0.35)] active:scale-[0.99] transition-transform"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analisando…
              </>
            ) : (
              analyzeLabel
            )}
          </button>
          {onToggleAutoAI && (
            <button
              type="button"
              onClick={onToggleAutoAI}
              className={`w-full py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 border transition-all ${
                autoAIEnabled
                  ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.2)]'
                  : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:border-cyan-500/30'
              }`}
            >
              <Cpu className={`w-4 h-4 ${autoAIEnabled ? 'animate-pulse' : ''}`} />
              IA automática {autoAIEnabled ? '· ON' : '· OFF'}
            </button>
          )}
        </div>

        {scanBlockCode && !isAnalyzing && (() => {
          const block = resolveBlockReasonDisplay(scanBlockCode, asset.symbol);
          const isClosed = block.code === 'MARKET_CLOSED';
          return (
            <div
              className={`rounded-xl border px-4 py-3 text-center ${
                isClosed
                  ? 'border-red-500/30 bg-red-950/40'
                  : 'border-amber-500/20 bg-amber-500/5'
              }`}
            >
              <p
                className={`text-xs font-bold tracking-wide whitespace-pre-line ${
                  isClosed ? 'text-red-300' : 'text-amber-300/90'
                }`}
              >
                {block.title}
              </p>
              {block.body ? (
                <p className="mt-2 text-[11px] text-zinc-400 whitespace-pre-line leading-relaxed">
                  {block.body}
                </p>
              ) : null}
              {!block.hideRetry && (
                <button
                  type="button"
                  onClick={onAnalyze}
                  className="mt-2 text-[10px] font-bold uppercase text-amber-200"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          );
        })()}

        {!scanBlockCode && scanError && !isAnalyzing && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300/90">{scanError}</p>
            <button
              type="button"
              onClick={onAnalyze}
              className="mt-2 text-[10px] font-bold uppercase text-amber-200"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isAnalyzing && <PremiumAILoader visible={isAnalyzing} />}

        {signal && !scanBlockCode && !isAnalyzing && (
          <SignalCard
            signal={signal}
            utcLabel={tzCurrent.utc}
            onSave={onSaveSignal}
          />
        )}
      </div>
    );
  }
);

PremiumTerminal.displayName = 'PremiumTerminal';
export default PremiumTerminal;
