import {
  getProviderForSymbol,
  resolveMarketCategory,
  MarketDataError,
} from '../../lib/services/marketData';
import { candleCache } from '../../lib/services/candleCache';
import { BLOCK_REASON } from './blockReasons';

export interface ProviderCheckResult {
  available: boolean;
  providerId: string | null;
  category: string;
  reason: string;
}

export function checkProviderAvailability(symbol: string): ProviderCheckResult {
  const sym = symbol.toUpperCase();
  const category = resolveMarketCategory(sym);
  const providerId = getProviderForSymbol(sym);

  if (!providerId) {
    console.log(
      `[Lux:ProviderCheck] ${sym} category=${category} available=false reason=${BLOCK_REASON.NO_PROVIDER}`
    );
    return { available: false, providerId: null, category, reason: BLOCK_REASON.NO_PROVIDER };
  }

  console.log(
    `[Lux:ProviderCheck] ${sym} category=${category} available=true provider=${providerId}`
  );
  return { available: true, providerId, category, reason: '' };
}

export function blockReasonFromMarketError(err: MarketDataError): string {
  if (err.code === 'NO_PROVIDER' || err.code === 'UNSUPPORTED') {
    return BLOCK_REASON.NO_PROVIDER;
  }
  if (err.message.toUpperCase().includes('INVALID_SNAPSHOT')) {
    return BLOCK_REASON.INVALID_SNAPSHOT;
  }
  if (err.code === 'RATE_LIMIT') return BLOCK_REASON.PROVIDER_ERROR;
  if (err.code === 'FETCH_FAILED') {
    const msg = err.message.toUpperCase();
    if (msg.includes('VAZIOS') || msg.includes('EMPTY')) {
      return BLOCK_REASON.PROVIDER_ERROR;
    }
    return BLOCK_REASON.PROVIDER_ERROR;
  }
  return BLOCK_REASON.PROVIDER_ERROR;
}

export function clearMarketDataForSymbol(symbol: string): void {
  candleCache.clear(symbol.toUpperCase());
}
