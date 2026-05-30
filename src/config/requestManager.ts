/**
 * Deduplicação e cancelamento de requests HTTP (anti-flood / anti-race).
 */

const inflight = new Map<string, AbortController>();
let lastGlobalRequestAt = 0;
const MIN_GLOBAL_GAP_MS = 120;

export function cancelInflight(key: string): void {
  inflight.get(key)?.abort();
  inflight.delete(key);
}

export function cancelAllInflight(): void {
  for (const c of inflight.values()) c.abort();
  inflight.clear();
}

export async function withRequestDedup<T>(
  key: string,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const prev = inflight.get(key);
  if (prev) prev.abort();

  const controller = new AbortController();
  inflight.set(key, controller);

  const now = Date.now();
  const gap = now - lastGlobalRequestAt;
  if (gap < MIN_GLOBAL_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GLOBAL_GAP_MS - gap));
  }
  lastGlobalRequestAt = Date.now();

  try {
    return await run(controller.signal);
  } finally {
    if (inflight.get(key) === controller) inflight.delete(key);
  }
}
