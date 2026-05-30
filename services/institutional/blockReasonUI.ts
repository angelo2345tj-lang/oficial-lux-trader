import { getMarketClosedDisplay } from './marketHours';

export const BLOCK_REASON_CODE = {
  MARKET_CLOSED: 'MARKET_CLOSED',
  NO_PROVIDER: 'NO_PROVIDER',
  NO_MARKET_DATA: 'NO_MARKET_DATA',
  INSUFFICIENT_CANDLES: 'INSUFFICIENT_CANDLES',
  INVALID_SNAPSHOT: 'INVALID_SNAPSHOT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NO_CONSENSUS: 'NO_CONSENSUS',
  SIGNAL_UNAVAILABLE: 'SIGNAL_UNAVAILABLE',
} as const;

export type InstitutionalBlockCode =
  (typeof BLOCK_REASON_CODE)[keyof typeof BLOCK_REASON_CODE] | string;

export function normalizeBlockReasonCode(raw?: string | null): string {
  if (!raw?.trim()) return BLOCK_REASON_CODE.NO_MARKET_DATA;
  const code = raw.trim().split(':')[0].toUpperCase();
  const known = Object.values(BLOCK_REASON_CODE) as string[];
  if (known.includes(code)) return code;
  if (raw.toUpperCase().includes('NO_PROVIDER') || raw.toUpperCase().includes('SEM PROVIDER')) {
    return BLOCK_REASON_CODE.NO_PROVIDER;
  }
  if (raw.toUpperCase().includes('INSUFFICIENT')) {
    return BLOCK_REASON_CODE.INSUFFICIENT_CANDLES;
  }
  if (raw.toUpperCase().includes('NO_CONSENSUS')) {
    return BLOCK_REASON_CODE.NO_CONSENSUS;
  }
  if (raw.toUpperCase().includes('INVALID_SNAPSHOT')) {
    return BLOCK_REASON_CODE.INVALID_SNAPSHOT;
  }
  if (
    raw.toUpperCase().includes('PROVIDER_ERROR') ||
    raw.toUpperCase().includes('FETCH_FAILED')
  ) {
    return BLOCK_REASON_CODE.PROVIDER_ERROR;
  }
  if (raw.toUpperCase().includes('SIGNAL_UNAVAILABLE')) {
    return BLOCK_REASON_CODE.SIGNAL_UNAVAILABLE;
  }
  if (raw.toUpperCase().includes('MARKET_CLOSED') || raw.toUpperCase().includes('MERCADO FECHADO')) {
    return BLOCK_REASON_CODE.MARKET_CLOSED;
  }
  return BLOCK_REASON_CODE.PROVIDER_ERROR;
}

export interface BlockReasonDisplay {
  code: string;
  title: string;
  body: string;
  hideRetry: boolean;
}

export function resolveBlockReasonDisplay(code: string, symbol?: string): BlockReasonDisplay {
  switch (code) {
    case BLOCK_REASON_CODE.MARKET_CLOSED: {
      const closed = symbol ? getMarketClosedDisplay(symbol) : null;
      return {
        code,
        title: closed?.title ?? '🔴 Mercado Fechado',
        body:
          closed?.body ??
          'Nenhuma operação disponível no momento.\nAguardando abertura do mercado.',
        hideRetry: true,
      };
    }
    case BLOCK_REASON_CODE.NO_PROVIDER:
      return {
        code,
        title: '⚠️ Provedor não configurado.',
        body: '',
        hideRetry: false,
      };
    case BLOCK_REASON_CODE.INSUFFICIENT_CANDLES:
      return {
        code,
        title: '⚠️ Aguardando candles suficientes para análise.',
        body: '',
        hideRetry: false,
      };
    case BLOCK_REASON_CODE.NO_MARKET_DATA:
    default:
      return {
        code: BLOCK_REASON_CODE.NO_MARKET_DATA,
        title: '⚠️ Dados de mercado indisponíveis.',
        body: '',
        hideRetry: false,
      };
  }
}

export function logBlockReasonUi(code: string): void {
  switch (code) {
    case BLOCK_REASON_CODE.MARKET_CLOSED:
      console.log('[Lux:UI] MARKET_CLOSED');
      break;
    case BLOCK_REASON_CODE.NO_PROVIDER:
      console.log('[Lux:UI] NO_PROVIDER');
      break;
    case BLOCK_REASON_CODE.NO_MARKET_DATA:
      console.log('[Lux:UI] NO_MARKET_DATA');
      break;
    case BLOCK_REASON_CODE.INSUFFICIENT_CANDLES:
      console.log('[Lux:UI] INSUFFICIENT_CANDLES');
      break;
    default:
      break;
  }
}

export function shouldSkipAutoReanalysis(code: string): boolean {
  return code === BLOCK_REASON_CODE.MARKET_CLOSED;
}
