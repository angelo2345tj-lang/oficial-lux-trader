import type { InstitutionalSignalPayload } from './types';
import { isCanonicalSnapshotId, snapshotBarTimestamp } from './snapshotValidation';

export interface InstitutionalAuditEntry {
  symbol: string;
  timeframe: string;
  status: string;
  direction: string;
  confidence: number;
  snapshotId: string;
  snapshotBarTs: number;
  providerId: string | null;
  candleCount: number;
  blockReason: string;
  cacheAgeMs: number | null;
  okReason: string;
  noDataReason: string;
}

export function buildAuditEntry(
  payload: InstitutionalSignalPayload,
  meta: {
    providerId: string | null;
    candleCount: number;
    cacheAgeMs: number | null;
    noDataReason?: string;
    okReason?: string;
  }
): InstitutionalAuditEntry {
  const blockReason = payload.blockReason ?? '';
  const noDataReason =
    meta.noDataReason ||
    (payload.status === 'NO_DATA' ? blockReason || payload.reasoning[0] || 'UNKNOWN' : '');
  const okReason =
    meta.okReason ||
    (payload.status === 'OK'
      ? `consensus+validation conf=${payload.confidence}% snap=${payload.snapshotId}`
      : '');

  return {
    symbol: payload.symbol,
    timeframe: payload.timeframe,
    status: payload.status,
    direction: payload.direction,
    confidence: payload.confidence,
    snapshotId: payload.snapshotId,
    snapshotBarTs: snapshotBarTimestamp(payload.snapshotId),
    providerId: meta.providerId,
    candleCount: meta.candleCount,
    blockReason,
    cacheAgeMs: meta.cacheAgeMs,
    okReason,
    noDataReason,
  };
}

export function logInstitutionalAuditReport(entry: InstitutionalAuditEntry): void {
  const staleRisk =
    entry.status === 'OK' &&
    (!isCanonicalSnapshotId(entry.snapshotId) || entry.confidence <= 0);

  console.log(
    `[Lux:AuditReport] ${entry.symbol} TF${entry.timeframe} status=${entry.status} ` +
      `dir=${entry.direction} conf=${entry.confidence}% ` +
      `provider=${entry.providerId ?? 'none'} candles=${entry.candleCount} ` +
      `snap=${entry.snapshotId} barTs=${entry.snapshotBarTs} ` +
      `cacheAge=${entry.cacheAgeMs ?? 'n/a'}ms ` +
      `noData=${entry.noDataReason || '—'} ok=${entry.okReason || '—'} ` +
      `stalePromoted=${staleRisk}`
  );
}
