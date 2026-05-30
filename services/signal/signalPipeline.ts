import type { TradeSignal } from '../../types';
import type { SignalResult } from '../strategy/RealSignalEngine';
import { persistSignal } from '../../src/state/signalStore';
import { INSTITUTIONAL_SIGNALS_ONLY } from '../institutional/institutionalMode';

export type SignalPipelineListener = (result: SignalResult) => void;

const listeners = new Set<SignalPipelineListener>();

/** Registra listener UI (App monta uma vez). */
export function onSignalPipeline(listener: SignalPipelineListener): () => void {
  console.log('[AUDIT-PIPELINE] subscribe called - listeners.size before=', listeners.size);
  listeners.add(listener);
  console.log('[AUDIT-PIPELINE] subscribe completed - listeners.size after=', listeners.size);
  return () => {
    console.log('[AUDIT-PIPELINE] unsubscribe called - listeners.size before=', listeners.size);
    listeners.delete(listener);
    console.log('[AUDIT-PIPELINE] unsubscribe completed - listeners.size after=', listeners.size);
  };
}

/** Disparado assim que o motor local gera sinal — não espera API. */
export function emitSignalResult(result: SignalResult): void {
  console.log('[AUDIT-PIPELINE] emit called - listeners.size=', listeners.size, ' hasSignal=', !!result.signal, ' signalId=', result.signal?.id);
  if (INSTITUTIONAL_SIGNALS_ONLY) {
    console.warn('[Lux:Signal] emitSignalResult ignored — institutional API only');
    return;
  }
  if (result.signal) {
    persistSignal(result.signal, true);
    console.log(
      '[Lux:Signal] pipeline emit',
      result.signal.asset,
      result.signal.type,
      `${result.signal.score}%`
    );
  }
  console.log('[AUDIT-PIPELINE] notifying', listeners.size, 'listeners');
  listeners.forEach((l) => {
    try {
      l(result);
    } catch (e) {
      console.error('[Lux:Signal] pipeline listener error', e);
    }
  });
  console.log('[AUDIT-PIPELINE] emit completed');
}

export function commitSignalToStore(signal: TradeSignal): void {
  persistSignal(signal, true);
}
