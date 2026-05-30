import { useCallback } from 'react';
import { useSignals } from '../context/SignalContext';
import { useMarket } from '../context/MarketContext';

export function useRealTimeAnalysis() {
  const { analyze, isAnalyzing, signal, scanError, isAIActive, startAutoScan, stopAutoScan, lastResult } =
    useSignals();
  const { price, status, provider, dataError, candles } = useMarket();

  const runAnalysis = useCallback(
    (banca: number, risk: number) => analyze(banca, risk),
    [analyze]
  );

  return {
    runAnalysis,
    isAnalyzing,
    signal,
    scanError,
    isAIActive,
    startAutoScan,
    stopAutoScan,
    lastResult,
    livePrice: price,
    wsStatus: status,
    dataProvider: provider,
    dataError,
    candleCount: candles.length,
  };
}
