import { fetchCandles } from '../../lib/services/marketData';
import { candleCache } from '../../lib/services/candleCache';
import { MarketDataError } from '../../lib/services/marketData/providers/types';
import type { Candle } from '../../lib/services/indicators';
import { fetchCandlesWithFallback } from '../../lib/services/marketData/MarketDataManager';

const MIN_BARS = 20;

export interface SnapshotCandleResult {
  candles: Candle[];
  requestedTimeframe: string;
  providerTimeframe: string;
  source: string;
  cacheCandles: number;
}

/**
 * Resolve candles para snapshot — cache WS/REST primeiro (backend compartilha candleCache).
 */
export async function resolveSnapshotPrimaryCandles(
  symbol: string,
  requestedTimeframe: string,
  limit = 120
): Promise<SnapshotCandleResult> {
  const sym = symbol.toUpperCase();
  const cached = candleCache.get(sym, requestedTimeframe);
  const cacheCandles = cached?.length ?? 0;

  console.log('[DEBUG-SNAPSHOT]', {
    action: 'resolveSnapshotPrimaryCandles_START',
    symbol: sym,
    requestedTimeframe,
    limit,
    cacheCandles,
    cachedFirst: cached?.[0],
    cachedLast: cached?.[cached.length - 1],
  });

  console.log(
    `[Lux:SnapshotBuild] symbol=${sym} requestedTimeframe=${requestedTimeframe} ` +
      `cacheCandles=${cacheCandles} providerTimeframe=${requestedTimeframe}`
  );

  try {
    const result = await fetchCandlesWithFallback(sym, requestedTimeframe, limit);
    const candles = result.candles;
    console.log(
      `[Lux:SnapshotBuild] symbol=${sym} timeframe=${requestedTimeframe} candles=${candles.length} source=fetch provider=${result.provider}`
    );
    console.log('[DEBUG-SNAPSHOT]', {
      action: 'resolveSnapshotPrimaryCandles_FETCH_SUCCESS',
      symbol: sym,
      timeframe: requestedTimeframe,
      candlesLength: candles.length,
      firstCandle: candles[0],
      lastCandle: candles[candles.length - 1],
      firstTimestamp: candles[0]?.timestamp,
      lastTimestamp: candles[candles.length - 1]?.timestamp,
      source: 'fetch',
      provider: result.provider,
    });
    candleCache.set(sym, requestedTimeframe, candles, result.provider);
    return {
      candles,
      requestedTimeframe,
      providerTimeframe: requestedTimeframe,
      source: 'fetch',
      cacheCandles,
    };
  } catch (e) {
    if (cached && cached.length >= MIN_BARS) {
      const slice = cached.slice(-limit);
      console.log(
        `[Lux:SnapshotBuild] symbol=${sym} timeframe=${requestedTimeframe} candles=${slice.length} source=cache-fallback`
      );
      console.log('[DEBUG-SNAPSHOT]', {
        action: 'resolveSnapshotPrimaryCandles_CACHE_FALLBACK',
        symbol: sym,
        timeframe: requestedTimeframe,
        candlesLength: slice.length,
        cacheCandles,
        source: 'cache-fallback',
      });
      return {
        candles: slice,
        requestedTimeframe,
        providerTimeframe: requestedTimeframe,
        source: 'cache-fallback',
        cacheCandles,
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.log(
      `[Lux:SnapshotBuild] failed symbol=${sym} timeframe=${requestedTimeframe} cache=${cacheCandles} err=${msg}`
    );
    console.log('[DEBUG-SNAPSHOT]', {
      action: 'resolveSnapshotPrimaryCandles_ERROR',
      symbol: sym,
      timeframe: requestedTimeframe,
      cacheCandles,
      errorMessage: msg,
      errorType: e instanceof Error ? e.constructor.name : typeof e,
      errorStack: e instanceof Error ? e.stack : undefined,
    });
    throw e;
  }
}

export function assertValidSnapshotBar(
  symbol: string,
  timeframe: string,
  candles: Candle[],
  barTs: number
): void {
  if (!candles.length) return;
  if (barTs >= 1_000_000_000_000) return;
  throw new MarketDataError(
    `INVALID_SNAPSHOT barTs=${barTs} candles=${candles.length}`,
    'FETCH_FAILED',
    symbol
  );
}
