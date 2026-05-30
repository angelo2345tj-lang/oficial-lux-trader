import { resolveMarketCategory } from '../../lib/services/marketData/marketRouter';
import { BLOCK_REASON } from './blockReasons';

/** Abertura forex spot (UTC) — domingo 22:00. Fechamento — sexta 22:00. */
const FOREX_OPEN_UTC_HOUR = 22;

export function isForexOrMetalCategory(symbol: string): boolean {
  const cat = resolveMarketCategory(symbol);
  return cat === 'forex' || cat === 'metal';
}

/**
 * Sessão retail forex/metal fechada:
 * - sábado inteiro
 * - domingo antes das 22:00 UTC
 * - sexta a partir das 22:00 UTC
 */
export function isRetailForexMetalSessionClosed(now = new Date()): boolean {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  if (day === 6) return true;
  if (day === 0 && hour < FOREX_OPEN_UTC_HOUR) return true;
  if (day === 5 && hour >= FOREX_OPEN_UTC_HOUR) return true;

  return false;
}

export interface MarketClosedCheck {
  closed: boolean;
  blockReason: string;
}

export function checkRetailMarketClosed(symbol: string, now = new Date()): MarketClosedCheck {
  if (!isForexOrMetalCategory(symbol)) {
    return { closed: false, blockReason: '' };
  }

  if (isRetailForexMetalSessionClosed(now)) {
    const sym = symbol.toUpperCase();
    console.log(`[Lux:Market] closed ${sym}`);
    return { closed: true, blockReason: BLOCK_REASON.MARKET_CLOSED };
  }

  return { closed: false, blockReason: '' };
}
