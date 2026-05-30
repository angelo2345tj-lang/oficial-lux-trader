import { useState, useCallback } from 'react';
import { BacktestEngine, BacktestResult } from '../services/backtesting/BacktestEngine';

export function useBacktest() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (symbol: string, timeframe: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await BacktestEngine.run(symbol, timeframe);
      setResult(r);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro no backtest';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, run };
}
