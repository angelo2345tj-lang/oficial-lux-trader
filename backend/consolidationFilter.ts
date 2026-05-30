import { Candle } from '../indicators';
import { StructureAnalysis } from '../../engines/MarketStructureEngine';
import { CandleAnalysis } from '../../engines/CandleAnalyzer';
import { SignalTimingMode } from '../../types';

export interface ConsolidationResult {
  blocked: boolean;
  reason?: string;
  advisory?: string;
}

/** INSTANT: nunca bloqueia — só aviso. CONFIRMED: bloqueio apenas em range extremo. */
export function isConsolidatingMarket(
  candles: Candle[],
  structure: StructureAnalysis,
  candleAnalysis: CandleAnalysis,
  timingMode: SignalTimingMode = 'INSTANT'
): ConsolidationResult {
  if (candles.length < 25) {
    return { blocked: false };
  }

  const window = candles.slice(-24);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  const mid = (high + low) / 2;
  const rangePct = mid > 0 ? ((high - low) / mid) * 100 : 0;

  const inTightRange = rangePct < 0.04 && candleAnalysis.volatility < 28;
  const rangeNoBreak = structure.trend === 'RANGE' && !structure.bos && !structure.choch;

  if (timingMode === 'INSTANT') {
    if (rangeNoBreak || inTightRange) {
      return {
        blocked: false,
        advisory: 'Microestrutura em range — sinal por momentum/fluxo',
      };
    }
    return { blocked: false };
  }

  if (inTightRange && structure.score < 40) {
    return {
      blocked: true,
      reason: 'Range muito estreito — aguarde expansão',
    };
  }

  if (rangeNoBreak && rangePct < 0.06 && candleAnalysis.volatility < 32) {
    return {
      blocked: true,
      reason: 'Consolidação extrema — prefira rompimento',
    };
  }

  return { blocked: false };
}
