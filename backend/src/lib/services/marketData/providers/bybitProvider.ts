import { Candle } from '../../indicators';
import { MarketDataError, MarketProvider } from './types';

const BYBIT_SYMBOL_MAP: Record<string, string> = {
  BTCUSD: 'BTCUSDT',
  ETHUSD: 'ETHUSDT',
  SOLUSD: 'SOLUSDT',
  XRPUSD: 'XRPUSDT',
  BNBUSD: 'BNBUSDT',
  ADAUSD: 'ADAUSDT',
  DOGEUSD: 'DOGEUSDT',
};

const TF_MAP: Record<string, string> = {
  '1': '1',
  '5': '5',
  '15': '15',
  '30': '30',
  '60': '60',
  '240': '240',
  D: 'D',
  W: 'W',
};

const API = 'https://api.bybit.com/v5/market';

export const bybitProvider: MarketProvider = {
  id: 'bybit',

  supports(symbol: string) {
    return Boolean(BYBIT_SYMBOL_MAP[symbol]);
  },

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const bybitSym = BYBIT_SYMBOL_MAP[symbol];
    if (!bybitSym) {
      throw new MarketDataError(`Bybit não suporta ${symbol}`, 'UNSUPPORTED', symbol);
    }

    const interval = TF_MAP[timeframe] || '60';
    const url = `${API}/kline?category=spot&symbol=${bybitSym}&interval=${interval}&limit=${Math.min(limit, 1000)}`;

    console.log('[DEBUG-BYBIT]', {
      action: 'fetchCandles_START',
      symbol,
      timeframe,
      limit,
      bybitSym,
      interval,
      url,
    });

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      console.log('[DEBUG-BYBIT]', {
        action: 'fetchCandles_RESPONSE',
        url,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        ok: res.ok,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.log('[DEBUG-BYBIT]', {
          action: 'fetchCandles_ERROR',
          httpStatus: res.status,
          errorBody: errorText,
        });

        if (res.status === 451) {
          throw new MarketDataError(`Bybit bloqueado (HTTP 451)`, 'BLOCKED', symbol);
        }
        throw new MarketDataError(`Bybit HTTP ${res.status}`, 'FETCH_FAILED', symbol);
      }

      const data = await res.json();

      console.log('[DEBUG-BYBIT]', {
        action: 'fetchCandles_DATA',
        dataType: Array.isArray(data?.result?.list) ? 'array' : typeof data,
        dataLength: Array.isArray(data?.result?.list) ? data.result.list.length : 'N/A',
      });

      if (!data?.result?.list || !Array.isArray(data.result.list) || data.result.list.length === 0) {
        console.log('[DEBUG-BYBIT]', {
          action: 'fetchCandles_EMPTY',
          dataType: typeof data,
          dataValue: data,
        });
        throw new MarketDataError('Bybit retornou dados vazios', 'FETCH_FAILED', symbol);
      }

      const candles = data.result.list
        .map((k: any) => ({
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          timestamp: parseInt(k[0]),
        }))
        .reverse();

      console.log('[DEBUG-BYBIT]', {
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
      
      console.log('[DEBUG-BYBIT]', {
        action: 'fetchCandles_EXCEPTION',
        errorMessage: e instanceof Error ? e.message : String(e),
        errorType: e instanceof Error ? e.constructor.name : typeof e,
      });

      if (e instanceof Error && e.name === 'AbortError') {
        throw new MarketDataError('Bybit timeout', 'FETCH_FAILED', symbol);
      }
      throw new MarketDataError(`Bybit erro: ${e instanceof Error ? e.message : String(e)}`, 'FETCH_FAILED', symbol);
    }
  },

  async fetchLastPrice(symbol: string): Promise<number> {
    const bybitSym = BYBIT_SYMBOL_MAP[symbol];
    if (!bybitSym) throw new MarketDataError('Symbol not mapped', 'UNSUPPORTED', symbol);
    
    const url = `${API}/tickers?category=spot&symbol=${bybitSym}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (!res.ok) throw new MarketDataError(`Bybit price HTTP ${res.status}`, 'FETCH_FAILED', symbol);
    
    const data = await res.json();
    return parseFloat(data.result.list[0].lastPrice);
  },
};
