import { Candle } from '../../indicators';
import { MarketDataError, MarketProvider } from './types';

const COINBASE_SYMBOL_MAP: Record<string, string> = {
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  SOLUSD: 'SOL-USD',
  XRPUSD: 'XRP-USD',
  BNBUSD: 'BNB-USD',
  ADAUSD: 'ADA-USD',
  DOGEUSD: 'DOGE-USD',
};

const TF_MAP: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  D: '1d',
  W: '1w',
};

const API = 'https://api.exchange.coinbase.com';

export const coinbaseProvider: MarketProvider = {
  id: 'coinbase',

  supports(symbol: string) {
    return Boolean(COINBASE_SYMBOL_MAP[symbol]);
  },

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const coinbaseSym = COINBASE_SYMBOL_MAP[symbol];
    if (!coinbaseSym) {
      throw new MarketDataError(`Coinbase não suporta ${symbol}`, 'UNSUPPORTED', symbol);
    }

    const granularity = TF_MAP[timeframe] || '1h';
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (limit * getGranularitySeconds(granularity));

    const url = `${API}/products/${coinbaseSym}/candles?granularity=${granularity}&start=${startTime}&end=${endTime}`;

    console.log('[DEBUG-COINBASE]', {
      action: 'fetchCandles_START',
      symbol,
      timeframe,
      limit,
      coinbaseSym,
      granularity,
      url,
    });

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      console.log('[DEBUG-COINBASE]', {
        action: 'fetchCandles_RESPONSE',
        url,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        ok: res.ok,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.log('[DEBUG-COINBASE]', {
          action: 'fetchCandles_ERROR',
          httpStatus: res.status,
          errorBody: errorText,
        });

        if (res.status === 451) {
          throw new MarketDataError(`Coinbase bloqueado (HTTP 451)`, 'BLOCKED', symbol);
        }
        throw new MarketDataError(`Coinbase HTTP ${res.status}`, 'FETCH_FAILED', symbol);
      }

      const data = await res.json();

      console.log('[DEBUG-COINBASE]', {
        action: 'fetchCandles_DATA',
        dataType: Array.isArray(data) ? 'array' : typeof data,
        dataLength: Array.isArray(data) ? data.length : 'N/A',
      });

      if (!Array.isArray(data) || data.length === 0) {
        console.log('[DEBUG-COINBASE]', {
          action: 'fetchCandles_EMPTY',
          dataType: typeof data,
          dataValue: data,
        });
        throw new MarketDataError('Coinbase retornou dados vazios', 'FETCH_FAILED', symbol);
      }

      const candles = data
        .map((k: any) => ({
          open: parseFloat(k[3]),
          high: parseFloat(k[2]),
          low: parseFloat(k[1]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          timestamp: parseInt(k[0]),
        }))
        .reverse();

      console.log('[DEBUG-COINBASE]', {
        action: 'fetchCandles_SUCCESS',
        symbol,
        timeframe,
        candlesReturned: candles.length,
        firstCandle: candles[0],
        lastCandle: candles[candles.length - 1],
        firstTimestamp: candles[0]?.timestamp,
        lastTimestamp: candles[candles.length - 1]?.timestamp,
      });

      return candles;
    } catch (e) {
      if (e instanceof MarketDataError) throw e;
      
      console.log('[DEBUG-COINBASE]', {
        action: 'fetchCandles_EXCEPTION',
        errorMessage: e instanceof Error ? e.message : String(e),
        errorType: e instanceof Error ? e.constructor.name : typeof e,
      });

      if (e instanceof Error && e.name === 'AbortError') {
        throw new MarketDataError('Coinbase timeout', 'FETCH_FAILED', symbol);
      }
      throw new MarketDataError(`Coinbase erro: ${e instanceof Error ? e.message : String(e)}`, 'FETCH_FAILED', symbol);
    }
  },

  async fetchLastPrice(symbol: string): Promise<number> {
    const coinbaseSym = COINBASE_SYMBOL_MAP[symbol];
    if (!coinbaseSym) throw new MarketDataError('Symbol not mapped', 'UNSUPPORTED', symbol);
    
    const url = `${API}/products/${coinbaseSym}/ticker`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (!res.ok) throw new MarketDataError(`Coinbase price HTTP ${res.status}`, 'FETCH_FAILED', symbol);
    
    const data = await res.json();
    return parseFloat(data.price);
  },
};

function getGranularitySeconds(granularity: string): number {
  const map: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
    '1w': 604800,
  };
  return map[granularity] || 3600;
}
