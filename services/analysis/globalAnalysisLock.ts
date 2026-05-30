import { analysisLifecycle } from '../realtime/analysisLifecycle';
import { ANALYSIS_TIMEOUT_MS, LUX_REALTIME_DEBUG } from '../realtime/realtimeConfig';

let running = false;
let lastFinishedAt = 0;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let activeSource = '';

export const globalAnalysisLock = {
  isRunning(): boolean {
    return running;
  },

  canStart(): boolean {
    return !running;
  },

  lastFinishedAt(): number {
    return lastFinishedAt;
  },

  tryAcquire(source: string): boolean {
    if (running) {
      if (LUX_REALTIME_DEBUG) {
        console.log('[Lux:Analysis] skipped — busy', source);
      }
      return false;
    }
    running = true;
    activeSource = source;
    return true;
  },

  release(reason: 'done' | 'timeout' | 'error' = 'done'): void {
    if (!running) {
      console.log('[Lux:Analysis] release called but not running - forcing release anyway');
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      running = false;
      lastFinishedAt = Date.now();
      activeSource = '';
      return;
    }
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    running = false;
    lastFinishedAt = Date.now();
    activeSource = '';
    if (reason === 'timeout') {
      analysisLifecycle.forceComplete('watchdog-timeout');
    }
  },

  startWatchdog(onTimeout: () => void): void {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      if (running) {
        onTimeout();
        this.release('timeout');
      }
    }, ANALYSIS_TIMEOUT_MS);
  },

  async run<T>(source: string, fn: () => Promise<T>): Promise<T | null> {
    if (!this.tryAcquire(source)) return null;
    this.startWatchdog(() => {
      if (LUX_REALTIME_DEBUG) console.warn('[Lux:Analysis] watchdog', source);
    });
    try {
      return await fn();
    } finally {
      this.release('done');
    }
  },
};
