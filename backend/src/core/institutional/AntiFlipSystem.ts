export interface FlipState {
  direction: 'BUY' | 'SELL';
  confidence: number;
  at: number;
}

const STATE = new Map<string, FlipState>();

const MIN_FLIP_DELTA = 14;
const MIN_HOLD_MS = 90_000;

/**
 * Histerese institucional — evita BUY→SELL→BUY em segundos.
 */
export function applyAntiFlip(
  key: string,
  direction: 'BUY' | 'SELL',
  confidence: number
): { direction: 'BUY' | 'SELL'; confidence: number; flipped: boolean } {
  const prev = STATE.get(key);
  const now = Date.now();

  if (!prev) {
    STATE.set(key, { direction, confidence, at: now });
    return { direction, confidence, flipped: false };
  }

  if (prev.direction === direction) {
    const smoothed = Math.round(prev.confidence * 0.35 + confidence * 0.65);
    STATE.set(key, { direction, confidence: smoothed, at: now });
    return { direction, confidence: smoothed, flipped: false };
  }

  const elapsed = now - prev.at;
  const delta = Math.abs(confidence - prev.confidence);

  if (elapsed < MIN_HOLD_MS || delta < MIN_FLIP_DELTA) {
    const holdConf = Math.max(48, Math.min(prev.confidence, confidence - 4));
    return { direction: prev.direction, confidence: holdConf, flipped: false };
  }

  STATE.set(key, { direction, confidence, at: now });
  return { direction, confidence, flipped: true };
}

export function resetAntiFlip(symbol: string): void {
  for (const k of STATE.keys()) {
    if (k.startsWith(symbol.toUpperCase())) STATE.delete(k);
  }
}
