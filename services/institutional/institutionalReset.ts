import { invalidateStaleSignal } from '../../src/state/signalStore';
import { realtimeState } from '../realtime/realtimeState';

/** Zera viés persistido antes de cada análise institucional. */
export function resetInstitutionalAnalysisState(): void {
  resetDecisionState();
  resetRealtimeBias();
  resetSignalConfidence();
  resetInstitutionalState();
}

export function resetDecisionState(): void {
  /* engines são stateless por chamada — flag para logs e guards */
  if (typeof window !== 'undefined') {
    (window as Window & { __luxDecisionEpoch?: number }).__luxDecisionEpoch =
      ((window as Window & { __luxDecisionEpoch?: number }).__luxDecisionEpoch ?? 0) + 1;
  }
}

export function resetRealtimeBias(): void {
  realtimeState.clearStale();
}

export function resetSignalConfidence(): void {
  invalidateStaleSignal();
  realtimeState.invalidateConfidence();
}

export function resetInstitutionalState(): void {
  if (typeof window !== 'undefined') {
    const w = window as Window & { __luxLastAnalysisId?: string };
    w.__luxLastAnalysisId = `${Date.now()}`;
  }
}
