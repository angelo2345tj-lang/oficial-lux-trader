import { Candle } from '../../indicators';
import { validateEnv } from '../../security/envValidation';
import { MarketDataError, MarketProvider } from './types';

const FOREX_MAP: Record<string, string> = {
  EURUSD: 'OANDA:EUR_USD',
  GBPUSD: 'OANDA:GBP_USD',
  USDJPY: 'OANDA:USD_JPY',
  AUDUSD: 'OANDA:AUD_USD',
  USDCAD: 'OANDA:USD_CAD',
  USDCHF: 'OANDA:USD_CHF',
  NZDUSD: 'OANDA:NZD_USD',
  XAUUSD: 'OANDA:XAU_USD',
};

const TF_RESOLUTION: Record<string, string> = {
  '1': '1',
  '5': '5',
  '15': '15',
  '30': '30',
  '60': '60',
  '240': '240',
  D: 'D',
  W: 'W',
};

function getApiKey(): string | null {
  return validateEnv().finnhubKey;
}

export const finnhubProvider: MarketProvider = {
  id: 'finnhub',

  supports(symbol: string) {
    return Boolean(FOREX_MAP[symbol]) && Boolean(getApiKey());
  },

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new MarketDataError('Configure VITE_FINNHUB_KEY no .env para Forex', 'NO_PROVIDER', symbol);
    }
    const finnhubSym = FOREX_MAP[symbol];
    if (!finnhubSym) throw new MarketDataError(`Finnhub não suporta ${symbol}`, 'UNSUPPORTED', symbol);

    const resolution = TF_RESOLUTION[timeframe] || '60';
    const to = Math.floor(Date.now() / 1000);
    const from = to - limit * parseInt(resolution === 'D' ? '86400' : resolution === '60' ? '3600' : '300', 10) * 2;

    const url = `https://finnhub.io/api/v1/forex/candle?symbol=${finnhubSym}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new MarketDataError(`Finnhub HTTP ${res.status}`, 'FETCH_FAILED', symbol);

    const json = await res.json();
    if (json.s !== 'ok' || !json.t?.length) {
      throw new MarketDataError('Finnhub sem dados', 'FETCH_FAILED', symbol);
    }

    const candles: Candle[] = [];
    for (let i = 0; i < json.t.length; i++) {
      candles.push({
        timestamp: json.t[i] * 1000,
        open: json.o[i],
        high: json.h[i],
        low: json.l[i],
        close: json.c[i],
        volume: json.v?.[i] ?? 0,
      });
    }
    return candles.slice(-limit);
  },

  async fetchLastPrice(symbol: string): Promise<number> {
    const candles = await this.fetchCandles(symbol, '1', 2);
    return candles[candles.length - 1]?.close ?? 0;
  },
};
