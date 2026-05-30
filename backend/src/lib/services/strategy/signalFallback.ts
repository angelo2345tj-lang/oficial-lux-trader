/**
 * @deprecated Não gera sinais fake. Use RealSignalEngine com status NO_DATA.
 */
import type { TradeSignal } from '../../types';

/** Mantido apenas para imports legados — sempre retorna null. */
export function buildGuaranteedSignal(): TradeSignal | null {
  console.warn('[Lux:Signal] buildGuaranteedSignal deprecated — use NO_DATA');
  return null;
}
