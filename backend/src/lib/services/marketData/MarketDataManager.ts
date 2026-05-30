import { Candle } from '../indicators';
import { MarketDataError, MarketProvider, MarketProviderId } from './providers/types';
import { binanceProvider } from './providers/binanceProvider';
import { bybitProvider } from './providers/bybitProvider';
import { coinbaseProvider } from './providers/coinbaseProvider';
import { twelveDataProvider } from './providers/twelveDataProvider';
import { finnhubProvider } from './providers/finnhubProvider';
import { resolveProviderPriority } from './marketRouter';

const PROVIDERS: Record<MarketProviderId, MarketProvider> = {
  binance: binanceProvider,
  twelvedata: twelveDataProvider,
  finnhub: finnhubProvider,
  bybit: bybitProvider,
  coinbase: coinbaseProvider,
};

const PROVIDER_HEALTH = new Map<MarketProviderId, { healthy: boolean; lastCheck: number; blockedUntil?: number }>();
const PROVIDER_FAILURE_COUNT = new Map<MarketProviderId, number>();

const BLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutos
const MAX_FAILURES = 3;

export interface ProviderAttempt {
  provider: MarketProviderId;
  success: boolean;
  error?: string;
  duration: number;
}

export interface FetchResult {
  candles: Candle[];
  provider: MarketProviderId;
  attempts: ProviderAttempt[];
}

function isProviderBlocked(providerId: MarketProviderId): boolean {
  const health = PROVIDER_HEALTH.get(providerId);
  if (!health) return false;
  
  if (health.blockedUntil && Date.now() < health.blockedUntil) {
    return true;
  }
  
  return false;
}

function markProviderFailure(providerId: MarketProviderId, error: string): void {
  const failures = (PROVIDER_FAILURE_COUNT.get(providerId) || 0) + 1;
  PROVIDER_FAILURE_COUNT.set(providerId, failures);
  
  console.log('[ProviderFail]', {
    provider: providerId,
    failures,
    maxFailures: MAX_FAILURES,
    error,
  });
  
  if (failures >= MAX_FAILURES) {
    const blockedUntil = Date.now() + BLOCK_DURATION_MS;
    PROVIDER_HEALTH.set(providerId, {
      healthy: false,
      lastCheck: Date.now(),
      blockedUntil,
    });
    
    console.log('[ProviderBlocked]', {
      provider: providerId,
      blockedUntil: new Date(blockedUntil).toISOString(),
      duration: BLOCK_DURATION_MS,
    });
  }
}

function markProviderSuccess(providerId: MarketProviderId): void {
  PROVIDER_FAILURE_COUNT.delete(providerId);
  PROVIDER_HEALTH.set(providerId, {
    healthy: true,
    lastCheck: Date.now(),
  });
  
  console.log('[ProviderSuccess]', {
    provider: providerId,
    healthy: true,
  });
}

export async function fetchCandlesWithFallback(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<FetchResult> {
  const sym = symbol.toUpperCase();
  const providerChain = resolveProviderPriority(sym);
  
  console.log('[ProviderAttempt]', {
    action: 'START',
    symbol: sym,
    timeframe,
    limit,
    providerChain,
  });
  
  const attempts: ProviderAttempt[] = [];
  
  for (const providerId of providerChain) {
    const provider = PROVIDERS[providerId];
    if (!provider) {
      console.log('[ProviderSkip]', { provider: providerId, reason: 'NOT_FOUND' });
      continue;
    }
    
    if (!provider.supports(sym)) {
      console.log('[ProviderSkip]', { provider: providerId, reason: 'NOT_SUPPORTED' });
      continue;
    }
    
    if (isProviderBlocked(providerId)) {
      console.log('[ProviderSkip]', { provider: providerId, reason: 'BLOCKED' });
      continue;
    }
    
    const startTime = Date.now();
    
    try {
      console.log('[ProviderAttempt]', {
        provider: providerId,
        symbol: sym,
        timeframe,
        limit,
      });
      
      const candles = await provider.fetchCandles(sym, timeframe, limit);
      const duration = Date.now() - startTime;
      
      markProviderSuccess(providerId);
      
      attempts.push({
        provider: providerId,
        success: true,
        duration,
      });
      
      console.log('[ProviderSuccess]', {
        provider: providerId,
        symbol: sym,
        timeframe,
        candlesReturned: candles.length,
        duration,
        attempts: attempts.length,
      });
      
      return {
        candles,
        provider: providerId,
        attempts,
      };
    } catch (e) {
      const duration = Date.now() - startTime;
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      markProviderFailure(providerId, errorMessage);
      
      attempts.push({
        provider: providerId,
        success: false,
        error: errorMessage,
        duration,
      });
      
      console.log('[ProviderFail]', {
        provider: providerId,
        symbol: sym,
        timeframe,
        error: errorMessage,
        duration,
        attempts: attempts.length,
      });
      
      // Se for erro de bloqueio (HTTP 451), marcar como bloqueado imediatamente
      if (errorMessage.includes('451') || errorMessage.includes('BLOCKED')) {
        const blockedUntil = Date.now() + BLOCK_DURATION_MS;
        PROVIDER_HEALTH.set(providerId, {
          healthy: false,
          lastCheck: Date.now(),
          blockedUntil,
        });
        
        console.log('[ProviderBlocked]', {
          provider: providerId,
          reason: 'HTTP_451',
          blockedUntil: new Date(blockedUntil).toISOString(),
        });
      }
    }
  }
  
  // Todos os providers falharam
  console.log('[ProviderAllFailed]', {
    symbol: sym,
    timeframe,
    attempts: attempts.length,
    attemptsDetails: attempts,
  });
  
  throw new MarketDataError(
    `Todos os providers falharam para ${sym}. Tentativas: ${attempts.map(a => `${a.provider}(${a.success ? 'OK' : 'FAIL'})`).join(', ')}`,
    'NO_PROVIDER',
    sym
  );
}

export function getProviderHealth(): Record<MarketProviderId, { healthy: boolean; blockedUntil?: number }> {
  const result: Partial<Record<MarketProviderId, { healthy: boolean; blockedUntil?: number }>> = {};
  
  for (const [providerId, health] of PROVIDER_HEALTH.entries()) {
    result[providerId] = {
      healthy: health.healthy,
      blockedUntil: health.blockedUntil,
    };
  }
  
  return result as Record<MarketProviderId, { healthy: boolean; blockedUntil?: number }>;
}

export function resetProviderHealth(providerId?: MarketProviderId): void {
  if (providerId) {
    PROVIDER_HEALTH.delete(providerId);
    PROVIDER_FAILURE_COUNT.delete(providerId);
    console.log('[ProviderReset]', { provider: providerId });
  } else {
    PROVIDER_HEALTH.clear();
    PROVIDER_FAILURE_COUNT.clear();
    console.log('[ProviderReset]', { all: true });
  }
}
