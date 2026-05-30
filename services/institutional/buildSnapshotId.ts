import type { Candle } from '../indicators';

const TF_MS: Record<string, number> = {
  '1': 60_000,
  '5': 300_000,
  '15': 900_000,
  '30': 1_800_000,
  '60': 3_600_000,
  '120': 7_200_000,
  '240': 14_400_000,
};

/** Barra fechada canônica — mesmo formato do backend institucional (SYMBOL_TF_BAR_TS). */
export function buildCanonicalSnapshotId(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): string | null {
  if (!candles.length) return null;
  const sym = symbol.toUpperCase();
  const last = candles[candles.length - 1];
  let ts = last.timestamp;
  if (ts > 0 && ts < 1_000_000_000_000) ts *= 1000;
  const interval = TF_MS[timeframe] ?? 3_600_000;
  const barTs = Math.floor(ts / interval) * interval;
  if (barTs < 1_000_000_000_000) return null;
  return `${sym}_${timeframe}_${barTs}`;
}
