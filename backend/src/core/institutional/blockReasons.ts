/** Códigos padronizados de blockReason — única fonte no backend institucional. */
export const BLOCK_REASON = {
  MARKET_CLOSED: 'MARKET_CLOSED',
  NO_PROVIDER: 'NO_PROVIDER',
  NO_MARKET_DATA: 'NO_MARKET_DATA',
  INSUFFICIENT_CANDLES: 'INSUFFICIENT_CANDLES',
  INVALID_SNAPSHOT: 'INVALID_SNAPSHOT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NO_CONSENSUS: 'NO_CONSENSUS',
  SIGNAL_UNAVAILABLE: 'SIGNAL_UNAVAILABLE',
} as const;

export type InstitutionalBlockReason =
  (typeof BLOCK_REASON)[keyof typeof BLOCK_REASON];

export function normalizeBlockReason(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return BLOCK_REASON.NO_MARKET_DATA;
  const code = raw.trim().split(':')[0].toUpperCase();
  const values = Object.values(BLOCK_REASON) as string[];
  if (values.includes(code)) return code;
  if (raw.toUpperCase().includes('SEM PROVIDER') || raw.toUpperCase().includes('NO_PROVIDER')) {
    return BLOCK_REASON.NO_PROVIDER;
  }
  if (raw.toUpperCase().includes('INSUFFICIENT')) return BLOCK_REASON.INSUFFICIENT_CANDLES;
  if (raw.toUpperCase().includes('NO_CONSENSUS')) return BLOCK_REASON.NO_CONSENSUS;
  if (raw.toUpperCase().includes('INVALID_SNAPSHOT')) return BLOCK_REASON.INVALID_SNAPSHOT;
  if (
    raw.toUpperCase().includes('PROVIDER_ERROR') ||
    raw.toUpperCase().includes('FETCH_FAILED')
  ) {
    return BLOCK_REASON.PROVIDER_ERROR;
  }
  if (raw.toUpperCase().includes('MARKET_CLOSED') || raw.toUpperCase().includes('MERCADO FECHADO')) {
    return BLOCK_REASON.MARKET_CLOSED;
  }
  if (raw.toUpperCase().includes('SIGNAL_UNAVAILABLE')) return BLOCK_REASON.SIGNAL_UNAVAILABLE;
  return BLOCK_REASON.PROVIDER_ERROR;
}

/** Nunca NO_MARKET_DATA quando já existem candles na análise. */
export function blockReasonForContext(
  rawReason: string,
  candleCount: number
): string {
  const code = normalizeBlockReason(rawReason);
  if (candleCount <= 0) {
    if (code === BLOCK_REASON.NO_CONSENSUS || code === BLOCK_REASON.INSUFFICIENT_CANDLES) {
      return code;
    }
    return code === BLOCK_REASON.NO_PROVIDER ? code : BLOCK_REASON.NO_MARKET_DATA;
  }
  if (code === BLOCK_REASON.NO_MARKET_DATA) return BLOCK_REASON.INVALID_SNAPSHOT;
  return code;
}
