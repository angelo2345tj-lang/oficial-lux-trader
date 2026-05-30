import type { InstitutionalSignalPayload } from './types';
import { canTransmitPayload, snapshotBarTimestamp } from './snapshotValidation';

type Subscriber = (payload: InstitutionalSignalPayload, meta: { live: boolean }) => void;

const subs = new Set<Subscriber>();
const SERVER_BOOT_AT = Date.now();
/** Sem replay WS durante boot do servidor. */
export const STREAM_BOOT_GRACE_MS = 45_000;

/** Última barra analisada por símbolo:timeframe (timestamp no snapshotId). */
const lastAnalyzedBarTs = new Map<string, string>();

function streamKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}:${timeframe}`;
}

export function markAnalyzedSnapshot(
  snapshotId: string,
  symbol: string,
  timeframe: string
): void {
  const barTs = snapshotBarTimestamp(snapshotId);
  if (barTs <= 0) return;
  lastAnalyzedBarTs.set(streamKey(symbol, timeframe), String(barTs));
  console.log(`[Lux:AnalyzeResult] marked analyzed ${symbol} TF${timeframe} barTs=${barTs}`);
}

export function getLastAnalyzedBarTs(symbol: string, timeframe: string): number {
  const raw = lastAnalyzedBarTs.get(streamKey(symbol, timeframe));
  return raw ? Number(raw) : 0;
}

export function isStreamBootGraceActive(): boolean {
  return Date.now() - SERVER_BOOT_AT < STREAM_BOOT_GRACE_MS;
}

/**
 * Replay só após primeira análise na sessão e somente se a barra for mais recente que a última analisada.
 */
export function canReplayCachedSnapshot(
  snapshotId: string,
  symbol: string,
  timeframe: string
): boolean {
  if (isStreamBootGraceActive()) {
    console.log(`[Lux:StreamReplay] blocked boot-grace ${symbol} snap=${snapshotId}`);
    return false;
  }

  const barTs = snapshotBarTimestamp(snapshotId);
  if (barTs <= 0) {
    console.log(`[Lux:StreamReplay] blocked non-canonical ${symbol} snap=${snapshotId}`);
    return false;
  }

  const last = getLastAnalyzedBarTs(symbol, timeframe);
  if (last <= 0) {
    console.log(`[Lux:StreamReplay] blocked no-prior-analysis ${symbol} snap=${snapshotId}`);
    return false;
  }

  if (barTs <= last) {
    console.log(
      `[Lux:StreamReplay] blocked stale snap=${snapshotId} barTs=${barTs} lastAnalyzed=${last}`
    );
    return false;
  }

  console.log(
    `[Lux:StreamReplay] allowed ${symbol} snap=${snapshotId} barTs=${barTs} lastAnalyzed=${last}`
  );
  return true;
}

export function subscribeInstitutionalStream(cb: Subscriber): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function broadcastInstitutionalSignal(payload: InstitutionalSignalPayload): void {
  if (!canTransmitPayload(payload)) {
    console.log(
      `[Lux:StreamLive] broadcast blocked ${payload.symbol} status=${payload.status} snap=${payload.snapshotId}`
    );
    return;
  }

  markAnalyzedSnapshot(payload.snapshotId, payload.symbol, payload.timeframe);

  const msg = JSON.stringify({ type: 'institutional_signal', live: true, payload });
  for (const cb of subs) {
    try {
      cb(payload, { live: true });
    } catch (e) {
      console.error('[Lux:Realtime] stream subscriber error', e);
    }
  }
  if (typeof globalThis !== 'undefined') {
    (globalThis as { __luxLastInstitutional?: string }).__luxLastInstitutional = msg;
  }
  console.log(
    `[Lux:StreamLive] ${payload.symbol} ${payload.direction} ${payload.confidence}% snap=${payload.snapshotId}`
  );
}
