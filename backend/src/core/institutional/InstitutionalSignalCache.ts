import type { InstitutionalSignalPayload } from './types';
import { isCanonicalSnapshotId, canTransmitPayload } from './snapshotValidation';

const CACHE = new Map<string, { payload: InstitutionalSignalPayload; at: number }>();
const TTL_MS = 120_000;
/** Replay WS só para snapshots recentes (evita BUY stale após falha de provider). */
const MAX_REPLAY_AGE_MS = 90_000;

function cacheKey(snapshotId: string, timingMode: string): string {
  return `${snapshotId}:${timingMode}`;
}

export function invalidateSymbolCache(symbol: string): void {
  const sym = symbol.toUpperCase();
  for (const [key, entry] of CACHE) {
    if (entry.payload.symbol === sym) {
      CACHE.delete(key);
    }
  }
  console.log(`[Lux:CacheWrite] invalidated ${sym}`);
}

export function getCachedSignal(
  snapshotId: string,
  timingMode: string
): { payload: InstitutionalSignalPayload; ageMs: number } | null {
  const hit = CACHE.get(cacheKey(snapshotId, timingMode));
  if (!hit) return null;
  const ageMs = Date.now() - hit.at;
  if (ageMs > TTL_MS) {
    CACHE.delete(cacheKey(snapshotId, timingMode));
    return null;
  }
  if (!canTransmitPayload(hit.payload)) {
    CACHE.delete(cacheKey(snapshotId, timingMode));
    return null;
  }
  console.log(
    `[Lux:CacheRead] hit ${hit.payload.symbol} snap=${hit.payload.snapshotId} conf=${hit.payload.confidence}% age=${ageMs}ms`
  );
  return { payload: hit.payload, ageMs };
}

export function setCachedSignal(payload: InstitutionalSignalPayload): void {
  if (!canTransmitPayload(payload)) {
    invalidateSymbolCache(payload.symbol);
    console.log(`[Lux:CacheWrite] skip status=${payload.status} ${payload.symbol} snap=${payload.snapshotId}`);
    return;
  }
  const key = cacheKey(payload.snapshotId, payload.timingMode);
  CACHE.set(key, { payload, at: Date.now() });
  console.log(
    `[Lux:CacheWrite] stored ${payload.symbol} snap=${payload.snapshotId} conf=${payload.confidence}% provider=${payload.providerId ?? '—'}`
  );
}

/**
 * Último snapshot válido para replay WS — somente ID canônico + prefixo TF + idade máxima.
 */
export function getLatestForSymbol(
  symbol: string,
  timeframe: string
): { payload: InstitutionalSignalPayload; ageMs: number } | null {
  const sym = symbol.toUpperCase();
  const prefix = `${sym}_${timeframe}_`;
  const now = Date.now();
  let latest: { payload: InstitutionalSignalPayload; at: number } | null = null;

  for (const [, v] of CACHE) {
    const p = v.payload;
    if (!canTransmitPayload(p)) continue;
    if (!p.snapshotId.startsWith(prefix)) continue;
    if (!isCanonicalSnapshotId(p.snapshotId)) continue;
    if (now - v.at > MAX_REPLAY_AGE_MS) continue;

    if (!latest || p.snapshotTimestamp > latest.payload.snapshotTimestamp) {
      latest = v;
    }
  }

  if (latest) {
    const ageMs = now - latest.at;
    console.log(
      `[Lux:StreamReplay] candidate ${sym} snap=${latest.payload.snapshotId} conf=${latest.payload.confidence}% age=${ageMs}ms`
    );
    return { payload: latest.payload, ageMs };
  }

  return null;
}
