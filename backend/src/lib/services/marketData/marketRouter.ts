import { BINANCE_SYMBOL_MAP } from './providers/binanceProvider';

export type MarketCategory = 'crypto' | 'forex' | 'metal' | 'index' | 'equity' | 'unknown';
export type MarketProviderId = 'binance' | 'twelvedata' | 'finnhub' | 'bybit' | 'coinbase';

const FOREX = new Set([
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD',
  'EURJPY',
  'GBPJPY',
  'EURGBP',
]);

const METALS = new Set(['XAUUSD', 'XAGUSD']);
const INDICES = new Set(['NAS100', 'US30', 'SPX500', 'GER40']);
const CRYPTO = new Set([
  'BTCUSD',
  'ETHUSD',
  'SOLUSD',
  'BNBUSD',
  'XRPUSD',
  'ADAUSD',
  'DOGEUSD',
  'AVAXUSD',
]);

export function normalizeSymbol(symbol: string): string {
  return String(symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function resolveMarketCategory(symbol: string): MarketCategory {
  const sym = normalizeSymbol(symbol);
  if (CRYPTO.has(sym) || BINANCE_SYMBOL_MAP[sym]) return 'crypto';
  if (FOREX.has(sym)) return 'forex';
  if (METALS.has(sym)) return 'metal';
  if (INDICES.has(sym)) return 'index';
  return 'unknown';
}

/** Ordem de providers por categoria — única fonte de roteamento. */
export function resolveProviderPriority(symbol: string): MarketProviderId[] {
  const cat = resolveMarketCategory(symbol);
  switch (cat) {
    case 'crypto':
      return ['binance', 'bybit', 'coinbase', 'twelvedata', 'finnhub'];
    case 'forex':
      return ['twelvedata', 'finnhub'];
    case 'metal':
      return ['twelvedata', 'finnhub'];
    case 'index':
      return ['twelvedata', 'finnhub'];
    default:
      return ['twelvedata', 'finnhub', 'binance'];
  }
}

export function supportsBinanceWs(symbol: string): boolean {
  return resolveMarketCategory(symbol) === 'crypto' && Boolean(BINANCE_SYMBOL_MAP[normalizeSymbol(symbol)]);
}

export function providerLabel(symbol: string): string {
  const cat = resolveMarketCategory(symbol);
  const chain = resolveProviderPriority(symbol);
  return `${cat} → ${chain[0]}`;
}
