import { Candle } from '../../indicators';
import { validateEnv } from '../../security/envValidation';
import { MarketDataError, MarketProvider } from './types';

const FOREX_MAP: Record<string, string> = {
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY',
  AUDUSD: 'AUD/USD',
  USDCAD: 'USD/CAD',
  USDCHF: 'USD/CHF',
  NZDUSD: 'NZD/USD',
  EURJPY: 'EUR/JPY',
  GBPJPY: 'GBP/JPY',
  EURGBP: 'EUR/GBP',
  XAUUSD: 'XAU/USD',
  XAGUSD: 'XAG/USD',
  US30: 'DJI',
  NAS100: 'IXIC',
  SPX500: 'SPX',
  GER40: 'DAX',
  USOIL: 'WTI/USD',
  UKOIL: 'BZ/USD',
  AAPL: 'AAPL',
  TSLA: 'TSLA',
  META: 'META',
  NVDA: 'NVDA',
  GOOGL: 'GOOGL',
  AMZN: 'AMZN',
  MSFT: 'MSFT',
};

const TF_MAP: Record<string, string> = {
  '1': '1min',
  '5': '5min',
  '15': '15min',
  M15: '15min',
  '30': '30min',
  M30: '30min',
  '60': '1h',
  H1: '1h',
  '120': '2h',
  H2: '2h',
  '240': '4h',
  H4: '4h',
  D: '1day',
  D1: '1day',
  W: '1week',
  W1: '1week',
};

function getApiKey(): string | null {
  return validateEnv().twelveDataKey;
}

export const twelveDataProvider: MarketProvider = {
  id: 'twelvedata',

  supports(symbol: string) {
    return Boolean(FOREX_MAP[symbol]) && Boolean(getApiKey());
  },

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new MarketDataError(
        'Configure VITE_TWELVE_DATA_KEY no .env para Forex/Commodities',
        'NO_PROVIDER',
        symbol
      );
    }
    const pair = FOREX_MAP[symbol];
    if (!pair) throw new MarketDataError(`TwelveData não suporta ${symbol}`, 'UNSUPPORTED', symbol);

    const interval = TF_MAP[timeframe] || '1h';
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(pair)}&interval=${interval}&outputsize=${Math.min(limit, 500)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new MarketDataError(`TwelveData HTTP ${res.status}`, 'FETCH_FAILED', symbol);

    const json = await res.json();
    if (json.status === 'error') {
      throw new MarketDataError(json.message || 'TwelveData error', 'FETCH_FAILED', symbol);
    }
    const values = json.values as Array<{
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume?: string;
    }>;
    if (!values?.length) throw new MarketDataError('TwelveData sem candles', 'FETCH_FAILED', symbol);

    return values
      .map((v) => ({
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseFloat(v.volume || '0'),
        timestamp: new Date(v.datetime).getTime(),
      }))
      .reverse();
  },

  async fetchLastPrice(symbol: string): Promise<number> {
    const apiKey = getApiKey();
    if (!apiKey) throw new MarketDataError('TwelveData key missing', 'NO_PROVIDER', symbol);
    const pair = FOREX_MAP[symbol];
    if (!pair) throw new MarketDataError('Unsupported', 'UNSUPPORTED', symbol);
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(pair)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new MarketDataError(`TwelveData price HTTP ${res.status}`, 'FETCH_FAILED', symbol);
    const json = await res.json();
    return parseFloat(json.price);
  },
};

export function twelveDataSupports(symbol: string): boolean {
  return Boolean(FOREX_MAP[symbol]);
}
