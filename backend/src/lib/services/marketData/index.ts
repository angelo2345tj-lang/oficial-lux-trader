import { Candle } from '../indicators';
import { candleCache } from '../candleCache';
import { logger } from '../logger';
import { binanceProvider } from './providers/binanceProvider';
import { finnhubProvider } from './providers/finnhubProvider';
import { twelveDataProvider } from './providers/twelveDataProvider';
import { MarketDataError, MarketProvider } from './providers/types';
import {
  normalizeSymbol,
  resolveProviderPriority,
  resolveMarketCategory,
  supportsBinanceWs,
  providerLabel,
} from './marketRouter';

const PROVIDERS: Record<string, MarketProvider> = {
  binance: binanceProvider,
  twelvedata: twelveDataProvider,
  finnhub: finnhubProvider,
};

function providerChain(symbol: string): MarketProvider[] {
  const sym = normalizeSymbol(symbol);
  return resolveProviderPriority(sym)
    .map((id) => PROVIDERS[id])
    .filter((p): p is MarketProvider => Boolean(p && p.supports(sym)));
}

async function fetchFromProvider(
  provider: MarketProvider,
  symbol: string,
  timeframe: string,
  limit: number
): Promise<Candle[]> {
  const sym = normalizeSymbol(symbol);
  const candles = await provider.fetchCandles(sym, timeframe, limit);
  candleCache.set(sym, timeframe, candles, provider.id);
  logger.info(`[Lux:Realtime] candles ${sym} TF${timeframe} via ${provider.id}`, 'marketData');
  return candles;
}

export async function fetchCandles(
  symbol: string,
  timeframe = '60',
  limit = 100,
  useCache = true
): Promise<Candle[]> {
  const sym = normalizeSymbol(symbol);
  if (!sym || sym.length < 3) {
    throw new MarketDataError('Ativo não informado', 'UNSUPPORTED', sym || 'undefined');
  }

  if (useCache) {
    const cached = candleCache.get(sym, timeframe);
    if (cached && cached.length >= Math.min(limit, 40)) return cached.slice(-limit);
  }

  const chain = providerChain(sym);
  if (!chain.length) {
    candleCache.clear(sym);
    const category = resolveMarketCategory(sym);
    const msg = `Sem provider para ${sym} (${category}). Configure TwelveData para Forex.`;
    console.log(`[Lux:ProviderCheck] ${sym} category=${category} available=false reason=NO_PROVIDER`);
    throw new MarketDataError(msg, 'NO_PROVIDER', sym);
  }

  let lastError: Error | null = null;
  for (const provider of chain) {
    try {
      return await fetchFromProvider(provider, sym, timeframe, limit);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      logger.warn(`[Lux:Recovery] ${provider.id} falhou ${sym}: ${lastError.message}`, 'marketData');
    }
  }

  const stale = candleCache.get(sym, timeframe);
  if (stale && stale.length >= 20) {
    logger.warn(`Cache stale ${sym} TF${timeframe} bars=${stale.length}`, 'marketData');
    console.log(
      `[Lux:AnalyzeCandles] stale-fallback ${sym} TF${timeframe} bars=${stale.length} providersAttempted=${chain.length}`
    );
    return stale.slice(-limit);
  }

  throw new MarketDataError(
    lastError?.message ?? `Sem dados para ${sym}`,
    'FETCH_FAILED',
    sym
  );
}

export async function fetchLastPrice(symbol: string): Promise<number> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return 0;

  for (const provider of providerChain(sym)) {
    try {
      if (provider.fetchLastPrice) {
        return await provider.fetchLastPrice(sym);
      }
      const candles = await fetchFromProvider(provider, sym, '1', 2);
      return candles[candles.length - 1]?.close ?? 0;
    } catch {
      continue;
    }
  }
  const candles = await fetchCandles(sym, '1', 2, true);
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

export async function fetchMTFExtended(symbol: string): Promise<{
  m1: Candle[];
  m5: Candle[];
  m15: Candle[];
  h1: Candle[];
  h4: Candle[];
}> {
  const [m1, m5, m15, h1, h4] = await Promise.all([
    fetchCandles(symbol, '1', 80),
    fetchCandles(symbol, '5', 80),
    fetchCandles(symbol, '15', 80),
    fetchCandles(symbol, '60', 80),
    fetchCandles(symbol, '240', 80),
  ]);
  return { m1, m5, m15, h1, h4 };
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
  const chain = providerChain(normalizeSymbol(symbol));
  return chain[0]?.id ?? null;
}

export function isCrypto(symbol: string): boolean {
  return resolveMarketCategory(symbol) === 'crypto';
}

export {
  normalizeSymbol,
  resolveMarketCategory,
  resolveProviderPriority,
  supportsBinanceWs,
  providerLabel,
  MarketDataError,
};
