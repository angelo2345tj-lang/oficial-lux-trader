import { Candle } from '../indicators';
import { candleCache } from '../candleCache';
import { logger } from '../logger';
import { binanceProvider, BINANCE_SYMBOL_MAP } from './providers/binanceProvider';
import { finnhubProvider } from './providers/finnhubProvider';
import { twelveDataProvider } from './providers/twelveDataProvider';
import { MarketDataError, MarketProvider } from './providers/types';

function isCrypto(symbol: string): boolean {
  return Boolean(BINANCE_SYMBOL_MAP[symbol]);
}

function providerChain(symbol: string): MarketProvider[] {
  if (isCrypto(symbol)) {
    return [binanceProvider, twelveDataProvider, finnhubProvider];
  }
  return [twelveDataProvider, finnhubProvider, binanceProvider];
}

async function fetchFromProvider(
  provider: MarketProvider,
  symbol: string,
  timeframe: string,
  limit: number
): Promise<Candle[]> {
  const candles = await provider.fetchCandles(symbol, timeframe, limit);
  candleCache.set(symbol, timeframe, candles, provider.id);
  logger.info(`Candles: ${symbol} TF${timeframe} via ${provider.id}`, 'marketData', {
    count: candles.length,
  });
  return candles;
}

export async function fetchCandles(
  symbol: string,
  timeframe = '60',
  limit = 100,
  useCache = true
): Promise<Candle[]> {
  if (useCache) {
    const cached = candleCache.get(symbol, timeframe);
    if (cached && cached.length >= Math.min(limit, 40)) return cached.slice(-limit);
  }

  const chain = providerChain(symbol).filter((p) => p.supports(symbol));
  let lastError: Error | null = null;

  for (const provider of chain) {
    try {
      return await fetchFromProvider(provider, symbol, timeframe, limit);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      logger.warn(
        `Fallback ${provider.id} falhou para ${symbol}: ${lastError.message}`,
        'marketData'
      );
    }
  }

  const stale = candleCache.get(symbol, timeframe);
  if (stale && stale.length >= 20) {
    logger.warn(`Usando cache local para ${symbol}`, 'marketData');
    return stale.slice(-limit);
  }

  throw new MarketDataError(
    lastError?.message ??
      `Sem dados para ${symbol}. Crypto: Binance. Forex: TwelveData.`,
    'FETCH_FAILED',
    symbol
  );
}

export async function fetchLastPrice(symbol: string): Promise<number> {
  for (const provider of providerChain(symbol).filter((p) => p.supports(symbol))) {
    try {
      if (provider.fetchLastPrice) {
        return await provider.fetchLastPrice(symbol);
      }
      const candles = await fetchFromProvider(provider, symbol, '1', 2);
      return candles[candles.length - 1]?.close ?? 0;
    } catch {
      continue;
    }
  }
  const candles = await fetchCandles(symbol, '1', 2, true);
  return candles[candles.length - 1]?.close ?? 0;
}

export function getCurrentPrice(candles: Candle[]): number {
  return candles[candles.length - 1]?.close ?? 0;
}

function trendFromCandles(candles: Candle[]): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (candles.length < 22) return 'NEUTRAL';
  const closes = candles.map((c) => c.close);
  const k = 2 / 22;
  let e21 = closes[0];
  for (let i = 0; i < closes.length; i++) {
    e21 = i === 0 ? closes[i] : closes[i] * k + e21 * (1 - k);
  }
  const price = closes[closes.length - 1];
  if (price > e21 * 1.0002) return 'BUY';
  if (price < e21 * 0.9998) return 'SELL';
  return 'NEUTRAL';
}

export async function fetchMTFCandles(symbol: string): Promise<{
  m5: Candle[];
  m15: Candle[];
  h1: Candle[];
  h4: Candle[];
}> {
  const [m5, m15, h1, h4] = await Promise.all([
    fetchCandles(symbol, '5', 80),
    fetchCandles(symbol, '15', 80),
    fetchCandles(symbol, '60', 80),
    fetchCandles(symbol, '240', 80),
  ]);
  return { m5, m15, h1, h4 };
}

export async function checkMTFAlignment(symbol: string, direction: 'BUY' | 'SELL'): Promise<boolean> {
  try {
    const { h1, h4 } = await fetchMTFCandles(symbol);
    const t1 = trendFromCandles(h1);
    const t4 = trendFromCandles(h4);
    if (t1 === 'NEUTRAL' || t4 === 'NEUTRAL') return t1 === direction || t4 === direction;
    return t1 === direction && t4 === direction;
  } catch {
    return true;
  }
}

export function getProviderForSymbol(symbol: string): string | null {
  if (isCrypto(symbol)) return 'binance';
  if (twelveDataProvider.supports(symbol)) return 'twelvedata';
  try {
    const p = providerChain(symbol).find((pr) => pr.supports(symbol));
    return p?.id ?? null;
  } catch {
    return null;
  }
}

export { MarketDataError };
