import { Candle } from '../../services/indicators';

export interface ConfirmedCandle extends Candle {
  confirmed: boolean;
  barIndex: number;
}

/** Anti-repaint: só usa candles fechados (exclui último se ainda em formação) */
export function getConfirmedCandles(candles: Candle[], excludeLast = true): ConfirmedCandle[] {
  const slice = excludeLast && candles.length > 1 ? candles.slice(0, -1) : candles;
  return slice.map((c, i) => ({ ...c, confirmed: true, barIndex: i }));
}

export function isBarClosed(lastCandleTime: number, timeframeMs: number): boolean {
  return Date.now() - lastCandleTime >= timeframeMs * 0.95;
}

export const TIMEFRAME_MS: Record<string, number> = {
  '1': 60_000,
  '5': 300_000,
  '15': 900_000,
  '60': 3_600_000,
  '240': 14_400_000,
  D: 86_400_000,
};
