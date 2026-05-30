import { LUX_REALTIME_DEBUG } from './realtimeConfig';

export type AnalysisCompleteReason = 'success' | 'error' | 'timeout' | 'stale' | 'recovery' | 'cancel';

export type AnalysisLifecycleEvent =
  | { type: 'started'; sessionId: number; source: string }
  | { type: 'completed'; sessionId: number; reason: AnalysisCompleteReason }
  | { type: 'force-complete'; reason: string };

type Listener = (ev: AnalysisLifecycleEvent) => void;

let sessionSeq = 0;
const listeners = new Set<Listener>();

function logFinalize(msg: string, ...args: unknown[]): void {
  if (LUX_REALTIME_DEBUG) console.log('[Lux:Finalize]', msg, ...args);
}

export const analysisLifecycle = {
  begin(source: string): number {
    const sessionId = ++sessionSeq;
    logFinalize('started', source, sessionId);
    listeners.forEach((l) => l({ type: 'started', sessionId, source }));
    return sessionId;
  },

  complete(sessionId: number, reason: AnalysisCompleteReason = 'success'): void {
    logFinalize('completed', reason, sessionId);
    listeners.forEach((l) => l({ type: 'completed', sessionId, reason }));
  },

  forceComplete(reason: string): void {
    console.warn('[Lux:Finalize] force', reason);
    listeners.forEach((l) => l({ type: 'force-complete', reason }));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
