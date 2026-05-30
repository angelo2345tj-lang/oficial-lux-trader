import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { TradeSignal } from '../types';
import { SignalResult } from '../services/strategy/RealSignalEngine';
import { analyzeSignal } from '../services/api/signalsApi';
import { useMarket } from './MarketContext';
import { logger, LogEntry } from '../services/logger';
import { getStoredSignal, persistSignal, invalidateStaleSignal } from '../src/state/signalStore';
import { candleStreamService } from '../services/websocket/candleStreamService';
import { realtimeEventBus } from '../services/realtime/realtimeEventBus';
import { realtimeOrchestrator } from '../services/realtime/bootstrapRealtime';
import { API_ENABLED } from '../services/api/signalsApi';
import { INSTITUTIONAL_SIGNALS_ONLY, shouldAutoRefreshFromCandles } from '../services/institutional/institutionalMode';
import { analysisLifecycle } from '../services/realtime/analysisLifecycle';
import { globalAnalysisLock } from '../services/analysis/globalAnalysisLock';
import { ANALYSIS_TIMEOUT_MS } from '../services/realtime/realtimeConfig';

interface SignalContextValue {
  signal: TradeSignal | null;
  isAnalyzing: boolean;
  scanError: string | null;
  lastResult: SignalResult | null;
  isAIActive: boolean;
  logs: LogEntry[];
  analyze: (banca: number, riskPercent: number) => Promise<SignalResult>;
  startAutoScan: (banca: number, riskPercent: number, intervalMs?: number) => void;
  stopAutoScan: () => void;
  clearSignal: () => void;
}

const SignalContext = createContext<SignalContextValue | null>(null);
let globalAnalysisRunning = false;

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const { symbol, timeframe, price, marketLive } = useMarket();
  const [signal, setSignal] = useState<TradeSignal | null>(() => getStoredSignal());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SignalResult | null>(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeLockRef = useRef(false);
  const lastAnalyzeAtRef = useRef(0);
  const scanParamsRef = useRef({ banca: 10000, risk: 1.5 });
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return logger.subscribe(setLogs);
  }, []);

  const analyze = useCallback(
    async (banca: number, riskPercent: number, forceRest = false) => {
      if (analyzeLockRef.current || globalAnalysisLock.isRunning()) {
        return lastResult ?? { signal: getStoredSignal() };
      }
      if (globalAnalysisRunning) return lastResult ?? { signal: getStoredSignal() };
      const now = Date.now();
      if (now - lastAnalyzeAtRef.current < 2000) return lastResult ?? { signal: getStoredSignal() };

      scanParamsRef.current = { banca, risk: riskPercent };
      invalidateStaleSignal();

      const streamOk = candleStreamService.isSignalAllowed() || marketLive || forceRest;
      if (!streamOk) {
        console.log('[Lux:Fallback] REST signal mode — stream recovering');
        if (!marketLive && !realtimeOrchestrator.isRestAlive()) {
          setScanError('Sincronizando mercado…');
          return { signal: null, blockReason: 'SIGNAL_UNAVAILABLE' };
        }
      }

      analyzeLockRef.current = true;
      globalAnalysisRunning = true;
      lastAnalyzeAtRef.current = now;
      setIsAnalyzing(true);
      setScanError(null);
      const sessionId = analysisLifecycle.begin('signal-context');

      const timeout = window.setTimeout(() => {
        analysisLifecycle.forceComplete('timeout');
        setIsAnalyzing(false);
        analyzeLockRef.current = false;
        globalAnalysisRunning = false;
        setScanError('Mercado recalibrando…');
      }, ANALYSIS_TIMEOUT_MS);

      try {
        const result = await analyzeSignal({
          symbol,
          timeframe,
          balance: banca,
          riskPercent,
          livePrice: price > 0 ? price : undefined,
          timingMode: 'INSTANT',
          forceRest,
          analyzeOrigin: 'SIGNAL_CONTEXT',
        });
        setLastResult(result);
        if (result.signal) {
          persistSignal(result.signal);
          setSignal(getStoredSignal());
          setScanError(null);
          console.log('[Lux:Signal] generated', result.signal.type, result.score);
          logger.info(`Sinal: ${result.signal.type} ${result.score}%`, 'Signal');
        } else if (!result.blockReason?.includes('SIGNAL_UNAVAILABLE')) {
          setScanError(result.blockReason ?? 'Sem setup nos dados atuais');
        }
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro na análise';
        setScanError(msg);
        logger.error(msg, 'scanner', e);
        const cached = getStoredSignal();
        return { signal: cached, blockReason: msg };
      } finally {
        window.clearTimeout(timeout);
        setIsAnalyzing(false);
        analyzeLockRef.current = false;
        globalAnalysisRunning = false;
        analysisLifecycle.complete(sessionId, 'success');
      }
    },
    [symbol, timeframe, price, lastResult, marketLive]
  );

  const scheduleRefreshAnalyze = useCallback(
    (reason: string) => {
      if (INSTITUTIONAL_SIGNALS_ONLY || !shouldAutoRefreshFromCandles()) return;
      if (reason !== 'candle-close' && reason !== 'recovery' && reason !== 'boot-rest') return;
      if (globalAnalysisLock.isRunning() || analyzeLockRef.current) return;
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        refreshDebounceRef.current = null;
        if (globalAnalysisLock.isRunning()) return;
        const { banca, risk } = scanParamsRef.current;
        if (banca <= 0) return;
        void analyze(banca, risk, true);
      }, 2000);
    },
    [analyze]
  );

  const startAutoScan = useCallback(
    (banca: number, riskPercent: number, intervalMs = 20000) => {
      if (isAIActive) return;
      scanParamsRef.current = { banca, risk: riskPercent };
      setIsAIActive(true);
      const safeInterval = Math.max(15000, intervalMs);
      void analyze(banca, riskPercent, true);
      intervalRef.current = setInterval(() => {
        void analyze(banca, riskPercent, true);
      }, safeInterval);
      logger.info('Scanner automático ativado', 'scanner');
    },
    [isAIActive, analyze]
  );

  const stopAutoScan = useCallback(() => {
    setIsAIActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    logger.info('Scanner automático desativado', 'scanner');
  }, []);

  React.useEffect(() => {
    const unsubBus = realtimeEventBus.onSignalRefresh(({ reason }) => {
      scheduleRefreshAnalyze(reason);
    });
    return () => {
      unsubBus();
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    };
  }, [scheduleRefreshAnalyze]);

  React.useEffect(() => {
    if (INSTITUTIONAL_SIGNALS_ONLY || API_ENABLED) return;
    scanParamsRef.current = { banca: 10000, risk: 1.5 };
    const bootTimer = setTimeout(() => {
      if (!getStoredSignal() && !analyzeLockRef.current) {
        void analyze(10000, 1.5, true);
      }
    }, 3500);
    return () => clearTimeout(bootTimer);
  }, [symbol, timeframe, analyze]);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearSignal = useCallback(() => setSignal(null), []);

  return (
    <SignalContext.Provider
      value={{
        signal,
        isAnalyzing,
        scanError,
        lastResult,
        isAIActive,
        logs,
        analyze,
        startAutoScan,
        stopAutoScan,
        clearSignal,
      }}
    >
      {children}
    </SignalContext.Provider>
  );
}

export function useSignals() {
  const ctx = useContext(SignalContext);
  if (!ctx) throw new Error('useSignals must be used within SignalProvider');
  return ctx;
}
