import { globalAnalysisLock } from '../analysis/globalAnalysisLock';
import { logger } from '../logger';
import { realtimeEventBus } from './realtimeEventBus';
import { LUX_REALTIME_DEBUG, REFRESH_COOLDOWN_MS } from './realtimeConfig';

export type RefreshReason =
  | 'candle-close'
  | 'candle-tick'
  | 'boot-rest'
  | 'recovery'
  | 'bos'
  | 'reclaim'
  | 'displacement'
  | 'volume-spike'
  | 'reconnect';

const ANALYZABLE: Set<RefreshReason> = new Set([
  'candle-close',
  'boot-rest',
  'recovery',
  'reconnect',
  'bos',
  'reclaim',
  'displacement',
  'volume-spike',
]);

export class SignalRefreshDispatcher {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDispatchAt = 0;
  private symbol = '';
  private timeframe = '';
  private onOrchestratorEmit: ((reason: string) => void) | null = null;

  configure(symbol: string, timeframe: string): void {
    this.symbol = symbol;
    this.timeframe = timeframe;
  }

  setEmitHandler(handler: (reason: string) => void): void {
    this.onOrchestratorEmit = handler;
  }

  dispatch(reason: RefreshReason, debounceMs = 0): void {
    if (!this.symbol) return;
    if (!ANALYZABLE.has(reason)) return;
    if (globalAnalysisLock.isRunning()) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const run = () => {
      this.debounceTimer = null;
      const now = Date.now();
      if (now - this.lastDispatchAt < REFRESH_COOLDOWN_MS) return;
      if (globalAnalysisLock.isRunning()) return;

      this.lastDispatchAt = now;
      const payload = { symbol: this.symbol, timeframe: this.timeframe, reason };
      realtimeEventBus.emitSignalRefresh(payload);
      this.onOrchestratorEmit?.(reason);
      if (LUX_REALTIME_DEBUG) {
        console.log('[Lux:Refresh]', reason);
      } else if (reason === 'candle-close' || reason === 'recovery') {
        logger.info(`refresh ${reason}`, 'Refresh');
      }
    };

    if (debounceMs > 0) {
      this.debounceTimer = setTimeout(run, debounceMs);
    } else {
      run();
    }
  }

  clear(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
}
