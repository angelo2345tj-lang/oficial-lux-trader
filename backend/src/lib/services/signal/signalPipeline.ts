import type { SignalResult } from '../strategy/RealSignalEngine';

/** API server — sem pipeline UI; apenas log estruturado. */
export function emitSignalResult(result: SignalResult): void {
  if (!result.signal) return;
  console.log(
    '[Lux:Signal]',
    result.signal.asset,
    result.signal.type,
    `${result.confidence ?? result.signal.confidence ?? result.signal.score}%`
  );
}
