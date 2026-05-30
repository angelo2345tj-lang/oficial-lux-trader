import { Candle } from './indicators';
import { CACHE_MERGE_THROTTLE_MS, LUX_REALTIME_DEBUG } from './realtime/realtimeConfig';

interface CacheEntry {
  candles: Candle[];
  updatedAt: number;
  source: string;
  lastMergeAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60_000;

function key(symbol: string, timeframe: string) {
  return `${symbol}:${timeframe}`;
}

export function candlesEqual(a: Candle, b: Candle): boolean {
  return (
    a.timestamp === b.timestamp &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume
  );
}

export const candleCache = {
  get(symbol: string, timeframe: string): Candle[] | null {
    const entry = cache.get(key(symbol, timeframe));
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > TTL_MS) return null;
    return entry.candles;
  },

  set(symbol: string, timeframe: string, candles: Candle[], source: string) {
    const k = key(symbol, timeframe);
    const prev = cache.get(k);
    if (
      prev &&
      prev.candles.length === candles.length &&
      prev.candles.length > 0 &&
      candlesEqual(prev.candles[prev.candles.length - 1], candles[candles.length - 1])
    ) {
      return;
    }
    cache.set(k, {
      candles,
      updatedAt: Date.now(),
      source,
      lastMergeAt: Date.now(),
    });
  },

  mergeLatest(symbol: string, timeframe: string, candle: Candle, source: string): boolean {
    const k = key(symbol, timeframe);
    const now = Date.now();
    const entry = cache.get(k);

    if (entry && now - entry.lastMergeAt < CACHE_MERGE_THROTTLE_MS) {
      const last = entry.candles[entry.candles.length - 1];
      if (last && candlesEqual(last, candle)) return false;
    }

    if (!entry || entry.candles.length === 0) {
      cache.set(k, {
        candles: [candle],
        updatedAt: now,
        source,
        lastMergeAt: now,
      });
      return true;
    }

    const list = entry.candles;
    const last = list[list.length - 1];
    if (last.timestamp === candle.timestamp) {
      if (candlesEqual(last, candle)) return false;
      const next = [...list];
      next[next.length - 1] = candle;
      cache.set(k, { candles: next, updatedAt: now, source, lastMergeAt: now });
      if (LUX_REALTIME_DEBUG) {
        console.debug(`[Lux:Cache] update ${symbol} ${timeframe}`);
      }
      return true;
    }

    if (candle.timestamp > last.timestamp) {
      const next = [...list, candle];
      if (next.length > 500) next.shift();
      cache.set(k, { candles: next, updatedAt: now, source, lastMergeAt: now });
      if (LUX_REALTIME_DEBUG) {
        console.debug(`[Lux:Cache] new bar ${symbol} ${timeframe}`);
      }
      return true;
    }

    return false;
  },

  clear(symbol?: string) {
    if (!symbol) {
      cache.clear();
      return;
    }
    for (const k of cache.keys()) {
      if (k.startsWith(`${symbol}:`)) cache.delete(k);
    }
  },
};
