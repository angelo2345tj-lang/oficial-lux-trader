import { Candle } from './indicators';
import { logger } from './logger';

interface CacheEntry {
  candles: Candle[];
  updatedAt: number;
  source: string;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

function key(symbol: string, timeframe: string) {
  return `${symbol}:${timeframe}`;
}

export const candleCache = {
  get(symbol: string, timeframe: string): Candle[] | null {
    const entry = cache.get(key(symbol, timeframe));
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > TTL_MS) return null;
    return entry.candles;
  },

  set(symbol: string, timeframe: string, candles: Candle[], source: string) {
    cache.set(key(symbol, timeframe), { candles, updatedAt: Date.now(), source });
  },

  mergeLatest(symbol: string, timeframe: string, candle: Candle, source: string) {
    const k = key(symbol, timeframe);
    const entry = cache.get(k);
    if (!entry || entry.candles.length === 0) {
      this.set(symbol, timeframe, [candle], source);
      return;
    }
    const list = [...entry.candles];
    const last = list[list.length - 1];
    if (last.timestamp === candle.timestamp) {
      list[list.length - 1] = candle;
    } else if (candle.timestamp > last.timestamp) {
      list.push(candle);
      if (list.length > 500) list.shift();
    }
    cache.set(k, { candles: list, updatedAt: Date.now(), source });
    logger.debug(`Candle cache updated ${symbol} ${timeframe}`, 'cache');
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
