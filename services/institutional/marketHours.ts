import { resolveMarketCategory } from '../marketData/marketRouter';

const FOREX_OPEN_UTC_HOUR = 22;

export function isForexOrMetalSymbol(symbol: string): boolean {
  const cat = resolveMarketCategory(symbol);
  return cat === 'forex' || cat === 'metal';
}

export function isRetailForexMetalSessionClosed(now = new Date()): boolean {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  if (day === 6) return true;
  if (day === 0 && hour < FOREX_OPEN_UTC_HOUR) return true;
  if (day === 5 && hour >= FOREX_OPEN_UTC_HOUR) return true;

  return false;
}

/** Cripto opera 24/7 — nunca tratado como mercado fechado. */
export function isAssetMarketClosed(symbol: string, now = new Date()): boolean {
  if (!isForexOrMetalSymbol(symbol)) return false;
  return isRetailForexMetalSessionClosed(now);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatUtcDateTime(d: Date): string {
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Próxima abertura retail Forex/Metal — domingo 22:00 UTC. */
export function getNextForexMetalOpenUtc(now = new Date()): Date {
  const open = new Date(now);
  open.setUTCSeconds(0, 0);
  open.setUTCHours(FOREX_OPEN_UTC_HOUR, 0, 0, 0);

  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  if (day === 6) {
    open.setUTCDate(open.getUTCDate() + 1);
    return open;
  }
  if (day === 0 && hour < FOREX_OPEN_UTC_HOUR) {
    return open;
  }
  if (day === 5 && hour >= FOREX_OPEN_UTC_HOUR) {
    open.setUTCDate(open.getUTCDate() + 2);
    return open;
  }
  if (day >= 1 && day <= 4) {
    return open;
  }
  open.setUTCDate(open.getUTCDate() + (7 - day));
  return open;
}

export interface MarketClosedDisplay {
  title: string;
  body: string;
}

export function getMarketClosedDisplay(symbol: string, now = new Date()): MarketClosedDisplay {
  const cat = resolveMarketCategory(symbol);
  const reopen = getNextForexMetalOpenUtc(now);
  const reopenLabel = formatUtcDateTime(reopen);

  if (cat === 'forex') {
    return {
      title: 'Mercado Forex fechado.',
      body: `Reabertura prevista: ${reopenLabel} UTC`,
    };
  }
  if (cat === 'metal') {
    return {
      title: 'Mercado de metais fechado.',
      body: `Reabertura prevista: ${reopenLabel} UTC`,
    };
  }
  return {
    title: 'Mercado fechado.',
    body: '',
  };
}
