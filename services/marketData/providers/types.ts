import { Candle } from '../../indicators';

export type MarketProviderId = 'binance' | 'twelvedata' | 'finnhub';

export class MarketDataError extends Error {
  constructor(
    message: string,
    public code: 'NO_PROVIDER' | 'FETCH_FAILED' | 'RATE_LIMIT' | 'UNSUPPORTED',
    public symbol?: string
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

export interface MarketProvider {
  id: MarketProviderId;
  supports(symbol: string): boolean;
  fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
  fetchLastPrice?(symbol: string): Promise<number>;
}
