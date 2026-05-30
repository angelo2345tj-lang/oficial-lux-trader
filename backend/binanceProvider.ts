import { Candle } from '../../indicators';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { MarketDataError, MarketProvider } from './types';

export const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTCUSD: 'BTCUSDT',
  ETHUSD: 'ETHUSDT',
  SOLUSD: 'SOLUSDT',
  XRPUSD: 'XRPUSDT',
  BNBUSD: 'BNBUSDT',
  ADAUSD: 'ADAUSDT',
  DOGEUSD: 'DOGEUSDT',
};

const TF_MAP: Record<string, string> = {
  '1S': '1s',
  '5S': '1s',
  '15S': '1s',
  '30S': '1s',
  '1': '1m',
  '2': '1m',
  '3': '3m',
  '5': '5m',
  '10': '5m',
  '15': '15m',
  '30': '30m',
  '45': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '360': '6h',
  '480': '8h',
  '720': '12h',
  D: '1d',
  W: '1w',
  M: '1M',
};

const API = 'https://api.binance.com/api/v3';

function parseKlines(data: number[][]): Candle[] {
  return data.map((k) => ({
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
    timestamp: Number(k[0]),
  }));
}

export const binanceProvider: MarketProvider = {
  id: 'binance',

  supports(symbol: string) {
    return Boolean(BINANCE_SYMBOL_MAP[symbol]);
  },

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const binanceSym = BINANCE_SYMBOL_MAP[symbol];
    if (!binanceSym) {
      throw new MarketDataError(`Binance não suporta ${symbol}`, 'UNSUPPORTED', symbol);
    }
    const interval = TF_MAP[timeframe] || '1h';
    const url = `${API}/klines?symbol=${binanceSym}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
    const res = await fetchWithTimeout(url, undefined, 12_000);
    if (!res.ok) {
      throw new MarketDataError(`Binance HTTP ${res.status}`, 'FETCH_FAILED', symbol);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new MarketDataError('Binance retornou dados vazios', 'FETCH_FAILED', symbol);
    }
    return parseKlines(data);
  },

  async fetchLastPrice(symbol: string): Promise<number> {
    const binanceSym = BINANCE_SYMBOL_MAP[symbol];
    if (!binanceSym) throw new MarketDataError('Symbol not mapped', 'UNSUPPORTED', symbol);
    const res = await fetchWithTimeout(`${API}/ticker/price?symbol=${binanceSym}`, undefined, 8_000);
    if (!res.ok) throw new MarketDataError(`Binance price HTTP ${res.status}`, 'FETCH_FAILED', symbol);
    const json = await res.json();
    return parseFloat(json.price);
  },
};

export function binanceStreamSymbol(symbol: string): string | null {
  const mapped = BINANCE_SYMBOL_MAP[symbol];
  return mapped ? mapped.toLowerCase() : null;
}

export function binanceKlineInterval(timeframe: string): string {
  return TF_MAP[timeframe] || '1h';
}
