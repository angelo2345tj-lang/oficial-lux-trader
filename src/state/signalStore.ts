import { TradeSignal } from '../../types';
import { realtimeState, CONFIDENCE_TTL_MS } from '../../services/realtime/realtimeState';

export const SIGNAL_STORE_TTL_MS = 30_000;

interface SignalStoreState {
  current: TradeSignal | null;
  lastUpdate: number;
  lastConfidence: number;
  createdAt: number;
}

const state: SignalStoreState = {
  current: null,
  lastUpdate: 0,
  lastConfidence: 0,
  createdAt: 0,
};

export function invalidateSignal(): void {
  state.current = null;
  state.lastConfidence = 0;
  state.createdAt = 0;
  realtimeState.invalidateConfidence();
}

export function invalidateStaleSignal(): void {
  const now = Date.now();
  if (!realtimeState.isStreamLive()) {
    invalidateSignal();
    return;
  }
  if (realtimeState.isStale() && realtimeState.snapshot().signalBlocked) {
    invalidateSignal();
    return;
  }
  if (state.current && now - state.createdAt > SIGNAL_STORE_TTL_MS) {
    invalidateSignal();
    return;
  }
  if (state.current && now - state.lastUpdate > CONFIDENCE_TTL_MS) {
    invalidateSignal();
  }
}

export function getStoredSignal(): TradeSignal | null {
  invalidateStaleSignal();
  if (realtimeState.isStale() && realtimeState.snapshot().signalBlocked) {
    return null;
  }
  return state.current;
}

export function persistSignal(next: TradeSignal, force = false): void {
  invalidateStaleSignal();
  if (!force && !realtimeState.isStreamLive()) return;

  const ts = new Date(next.timestamp as unknown as string).getTime() || Date.now();
  const confidence = Number(next.score ?? 0);
  const isNewer = ts > state.lastUpdate;

  if (!state.current || isNewer) {
    state.current = next;
    state.lastUpdate = Math.max(state.lastUpdate, ts);
    state.createdAt = Date.now();
    state.lastConfidence = confidence;
    void import('../../services/mobile/OfflineCache')
      .then(({ offlineCache }) => offlineCache.saveSignal(next))
      .catch(() => undefined);
  }
}
