const CANONICAL_SNAPSHOT = /^[A-Z0-9]{3,12}_\d+_\d{10,}$/;

/** Extrai timestamp da barra fechada do snapshotId canônico (SYMBOL_TF_BAR_TS). */
export function snapshotBarTimestamp(snapshotId: string | undefined | null): number {
  if (!snapshotId) return 0;
  const m = /^[A-Z0-9]{3,12}_\d+_(\d+)$/i.exec(snapshotId.trim());
  return m ? Number(m[1]) : 0;
}

export function isCanonicalSnapshotId(snapshotId: string | undefined | null): boolean {
  if (!snapshotId || typeof snapshotId !== 'string') return false;
  const id = snapshotId.trim().toUpperCase();
  if (id.includes('NODATA') || id.startsWith('SIG-')) return false;
  return CANONICAL_SNAPSHOT.test(id);
}

export function canTransmitPayload(payload: {
  status: string;
  signal: unknown;
  confidence: number;
  snapshotId: string;
  blockReason?: string;
}): boolean {
  if (payload.status !== 'OK') return false;
  if (!payload.signal) return false;
  if (payload.confidence <= 0) return false;
  if (!isCanonicalSnapshotId(payload.snapshotId)) return false;
  const br = payload.blockReason ?? '';
  if (
    br.includes('NO_PROVIDER') ||
    br.includes('NO_MARKET_DATA') ||
    br.includes('MARKET_CLOSED') ||
    br.includes('INSUFFICIENT_CANDLES') ||
    br.includes('PROVIDER_ERROR') ||
    br.includes('INVALID_SNAPSHOT') ||
    br.includes('Sem provider')
  ) {
    return false;
  }
  return true;
}
