import { SignalResult } from '../strategy/RealSignalEngine';
import { globalAnalysisLock } from '../analysis/globalAnalysisLock';
import { ANALYSIS_MIN_GAP_MS } from '../realtime/realtimeConfig';

interface CacheEntry {
  result: SignalResult;
  expires: number;
}

const CACHE_TTL_MS = 8_000;
const cache = new Map<string, CacheEntry>();
let chain: Promise<unknown> = Promise.resolve();

export function clearAnalysisCache(): void {
  cache.clear();
}

/** Uma análise global por vez — fila serial, sem concorrência. */
export function enqueueAnalysis<T extends SignalResult>(
  key: string,
  run: () => Promise<T>,
  origin?: string
): Promise<T> {
  // Bypass cache for manual analyses to ensure fresh results on every user click
  const bypassCache =
    origin === 'USER_CLICK' ||
    origin === 'MANUAL' ||
    origin === 'INSTANT' ||
    origin === 'manual-scan';

  if (!bypassCache) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      console.log('[AUDIT-CACHE] cache HIT - key=', key, ' expires=', hit.expires, ' now=', Date.now(), ' age=', Date.now() - (hit.expires - CACHE_TTL_MS));
      console.log('[AUDIT-CACHE] cached signal.id=', hit.result.signal?.id);
      return Promise.resolve(hit.result as T);
    }
  }
  console.log('[AUDIT-CACHE] cache MISS or bypass - key=', key, ' bypassCache=', bypassCache, ' origin=', origin);

  const task = chain
    .catch(() => undefined)
    .then(async () => {
      const gap = Date.now() - globalAnalysisLock.lastFinishedAt();
      if (gap < ANALYSIS_MIN_GAP_MS) {
        await new Promise((r) => setTimeout(r, ANALYSIS_MIN_GAP_MS - gap));
      }

      const wrapped = await globalAnalysisLock.run('queue', run);
      if (wrapped === null) {
        return {
          signal: null,
          blockReason: 'ANALYSIS_BUSY',
          success: false,
          message: 'ANALYSIS_BUSY',
        } as unknown as T;
      }

      // Only cache if not a manual analysis
      if (!bypassCache && wrapped.signal && wrapped.status !== 'NO_DATA') {
        cache.set(key, { result: wrapped, expires: Date.now() + CACHE_TTL_MS });
        console.log('[AUDIT-CACHE] cache SET - key=', key, ' signal.id=', wrapped.signal?.id, ' expires=', Date.now() + CACHE_TTL_MS);
      }
      console.log('[AUDIT-CACHE] returning new result - signal.id=', wrapped.signal?.id, ' bypassCache=', bypassCache);
      return wrapped;
    });

  chain = task;
  return task as Promise<T>;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
