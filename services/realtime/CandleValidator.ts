import { Candle } from '../indicators';

export const STALE_CANDLE_MS = 45_000;

/** Normaliza timestamp Binance (ms ou s). */
export function normalizeCandleTimestamp(ts: number): number {
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  if (ts < 1_000_000_000_000) return ts * 1000;
  return ts;
}

export function currentBarOpenTs(timeframe: string, now = Date.now()): number {
  const interval = timeframeToMs(timeframe);
  return Math.floor(now / interval) * interval;
}

export function timeframeToMs(tf: string): number {
  const map: Record<string, number> = {
    '1': 60_000,
    '3': 180_000,
    '5': 300_000,
    '15': 900_000,
    '30': 1_800_000,
    '60': 3_600_000,
    '120': 7_200_000,
    '240': 14_400_000,
  };
  return map[tf] ?? 60_000;
}

export function isValidCandle(candle: Candle, requireVolume = false): boolean {
  if (!candle || typeof candle !== 'object') return false;
  if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high)) return false;
  if (!Number.isFinite(candle.low) || !Number.isFinite(candle.close)) return false;
  if (!Number.isFinite(candle.timestamp) || candle.timestamp <= 0) return false;
  if (candle.high < candle.low) return false;
  if (candle.open < 0 || candle.close < 0) return false;
  if (requireVolume && (!Number.isFinite(candle.volume) || candle.volume <= 0)) return false;
  return true;
}

export function isDuplicateCandle(prev: Candle | null, next: Candle): boolean {
  if (!prev) return false;
  return (
    prev.timestamp === next.timestamp &&
    prev.close === next.close &&
    prev.high === next.high &&
    prev.low === next.low
  );
}

/**
 * Kline `t` = abertura do candle (Binance).
 * Candle atual ou barra anterior fechada NÃO são stale.
 */
export function isDelayedCandle(candle: Candle, timeframe: string, graceMs = STALE_CANDLE_MS): boolean {
  const ts = normalizeCandleTimestamp(candle.timestamp);
  if (!ts) return true;

  const interval = timeframeToMs(timeframe);
  const now = Date.now();
  const currentOpen = currentBarOpenTs(timeframe, now);
  const previousOpen = currentOpen - interval;

  if (ts >= currentOpen - 2000 || ts === previousOpen || ts === currentOpen) {
    return false;
  }

  const estimatedClose = ts + interval;
  return now - estimatedClose > interval + graceMs;
}

export function isStaleByAge(lastUpdateAt: number, maxAgeMs = STALE_CANDLE_MS): boolean {
  if (lastUpdateAt <= 0) return false;
  return Date.now() - lastUpdateAt > maxAgeMs;
}

export function mergeCandlesUnique(existing: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of existing) {
    if (isValidCandle(c)) map.set(c.timestamp, c);
  }
  for (const c of incoming) {
    if (isValidCandle(c)) map.set(c.timestamp, c);
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}
