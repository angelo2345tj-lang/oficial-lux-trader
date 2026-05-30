import { Candle } from '../services/indicators';
import { StructureAnalysis } from './MarketStructureEngine';
import { CandleAnalysis } from './CandleAnalyzer';
import type { MarketPhase } from './MarketPhaseEngine';
import { logger } from '../services/logger';
import { realtimeState } from '../services/realtime/realtimeState';

let streamStaleGuard = false;

export function setStreamStaleGuard(stale: boolean): void {
  streamStaleGuard = stale;
}

export interface PhaseBlendWeights {
  macro: number;
  reversal: number;
  momentum: number;
  structure: number;
}

export const PHASE_BLEND_WEIGHTS: Record<MarketPhase, PhaseBlendWeights> = {
  TRENDING: { macro: 0.35, reversal: 0.3, momentum: 0.2, structure: 0.15 },
  REVERSAL: { macro: 0.2, reversal: 0.45, momentum: 0.2, structure: 0.15 },
  BREAKOUT: { macro: 0.2, reversal: 0.3, momentum: 0.35, structure: 0.15 },
  RANGING: { macro: 0.2, reversal: 0.25, momentum: 0.2, structure: 0.35 },
  ACCUMULATION: { macro: 0.35, reversal: 0.25, momentum: 0.2, structure: 0.2 },
  DISTRIBUTION: { macro: 0.35, reversal: 0.25, momentum: 0.2, structure: 0.2 },
  EXHAUSTION: { macro: 0.3, reversal: 0.25, momentum: 0.2, structure: 0.25 },
};

export interface LocalStructureBias {
  bullish: number;
  bearish: number;
  bias: 'BUY' | 'SELL';
  displacementBullish: boolean;
  displacementBearish: boolean;
  recoveryBullish: boolean;
  recoveryBearish: boolean;
}

export interface DecisionInput {
  phase: MarketPhase;
  macroDirection: 'BUY' | 'SELL';
  macroStrength: number;
  h4Bearish: boolean;
  h1Bearish: boolean;
  h4Bullish: boolean;
  h1Bullish: boolean;
  reversalBull: number;
  reversalBear: number;
  momentumBullish: boolean;
  momentumBearish: boolean;
  m15Bullish: boolean;
  m5Bullish: boolean;
  m15Bearish: boolean;
  m5Bearish: boolean;
  localStructure: LocalStructureBias;
  exhaustion: boolean;
}

export interface DecisionResult {
  direction: 'BUY' | 'SELL';
  confidence: number;
  winningBias: 'BUY' | 'SELL';
  compositeBull: number;
  compositeBear: number;
  primaryReason: string;
  weights: PhaseBlendWeights;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

/** Score 0–100 de viés estrutural local (M15/M5/chart) — peso alto em REVERSAL/BREAKOUT. */
export function computeLocalStructureBias(
  candles: Candle[],
  m15: Candle[],
  m5: Candle[],
  structure: StructureAnalysis,
  candleAnalysis: CandleAnalysis
): LocalStructureBias {
  let bullish = 50;
  let bearish = 50;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const displacementBullish =
    candleAnalysis.pattern === 'REVERSAL_BULL' ||
    (last.close > last.open && last.close > prev.high && Math.abs(last.close - last.open) > (last.high - last.low) * 0.55);
  const displacementBearish =
    candleAnalysis.pattern === 'REVERSAL_BEAR' ||
    (last.close < last.open && last.close < prev.low && Math.abs(last.close - last.open) > (last.high - last.low) * 0.55);

  let pv = 0;
  let vol = 0;
  for (const c of candles.slice(-25)) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = Math.max(c.volume, 1);
    pv += tp * v;
    vol += v;
  }
  const vwap = vol > 0 ? pv / vol : last.close;
  const recoveryBullish = last.close > vwap && prev.close <= vwap;
  const recoveryBearish = last.close < vwap && prev.close >= vwap;

  if (displacementBullish) bullish += 22;
  if (displacementBearish) bearish += 22;
  if (recoveryBullish) bullish += 18;
  if (recoveryBearish) bearish += 18;
  if (structure.bos && (structure.direction === 'BUY' || structure.trend === 'BULLISH')) bullish += 15;
  if (structure.bos && (structure.direction === 'SELL' || structure.trend === 'BEARISH')) bearish += 15;
  if (structure.choch && structure.direction === 'BUY') bullish += 12;
  if (structure.choch && structure.direction === 'SELL') bearish += 12;
  if (candleAnalysis.continuation && candleAnalysis.direction === 'BUY') bullish += 10;
  if (candleAnalysis.continuation && candleAnalysis.direction === 'SELL') bearish += 10;

  const m15Last = m15[m15.length - 1];
  const m5Last = m5[m5.length - 1];
  if (m15Last && m15Last.close >= m15Last.open) bullish += 6;
  else if (m15Last) bearish += 6;
  if (m5Last && m5Last.close >= m5Last.open) bullish += 6;
  else if (m5Last) bearish += 6;

  bullish = clamp(bullish);
  bearish = clamp(bearish);

  return {
    bullish,
    bearish,
    bias: bullish >= bearish ? 'BUY' : 'SELL',
    displacementBullish,
    displacementBearish,
    recoveryBullish,
    recoveryBearish,
  };
}

function directionConfidenceAgreement(
  direction: 'BUY' | 'SELL',
  confidence: number,
  reversalBull: number,
  reversalBear: number
): number {
  if (direction === 'SELL' && reversalBull >= 52 && reversalBull > reversalBear) {
    return clamp(confidence - (reversalBull - reversalBear) * 0.55, 52, 68);
  }
  if (direction === 'BUY' && reversalBear >= 52 && reversalBear > reversalBull) {
    return clamp(confidence - (reversalBear - reversalBull) * 0.55, 52, 68);
  }
  return confidence;
}

function applyConfidenceCaps(
  direction: 'BUY' | 'SELL',
  confidence: number,
  macroDirection: 'BUY' | 'SELL',
  bullishCluster: boolean,
  bearishCluster: boolean,
  input: DecisionInput
): number {
  const ls = input.localStructure;
  const fullBear =
    input.h4Bearish &&
    input.h1Bearish &&
    input.m15Bearish &&
    input.m5Bearish &&
    input.momentumBearish &&
    ls.displacementBearish;
  const fullBull =
    input.h4Bullish &&
    input.h1Bullish &&
    input.m15Bullish &&
    input.m5Bullish &&
    input.momentumBullish &&
    ls.displacementBullish;

  let c = confidence;
  if (direction !== macroDirection) c -= 6;
  if (direction === 'SELL' && bullishCluster) c -= 8;
  if (direction === 'BUY' && bearishCluster) c -= 8;
  return clamp(c, 42, 94);
}

function confidenceForContext(
  _direction: 'BUY' | 'SELL',
  phase: MarketPhase,
  compositeMargin: number,
  reversalDominant: boolean,
  strongTrend: boolean,
  exhaustion: boolean
): number {
  if (exhaustion) return clamp(48 + compositeMargin * 14, 44, 68);

  if (reversalDominant && (phase === 'REVERSAL' || phase === 'BREAKOUT')) {
    return clamp(62 + compositeMargin * 22, 58, 86);
  }

  if (strongTrend && phase === 'TRENDING') {
    return clamp(64 + compositeMargin * 24, 60, 90);
  }

  if (phase === 'RANGING') {
    return clamp(50 + compositeMargin * 12, 46, 64);
  }

  return clamp(54 + compositeMargin * 20, 48, 92);
}

export class InstitutionalDecisionEngine {
  static resolve(input: DecisionInput): DecisionResult {
    const weights = { ...PHASE_BLEND_WEIGHTS[input.phase] };
    let macroW = weights.macro;
    let revW = weights.reversal;
    let momW = weights.momentum;
    let structW = weights.structure;

    const macroBull = input.macroDirection === 'BUY' ? input.macroStrength : 0;
    const macroBear = input.macroDirection === 'SELL' ? input.macroStrength : 0;

    const ls = input.localStructure;

    if (
      input.reversalBull >= 55 &&
      ls.displacementBullish &&
      ls.recoveryBullish
    ) {
      macroW *= 0.6;
      revW = Math.min(0.55, revW + 0.08);
      const sum = macroW + revW + momW + structW;
      macroW /= sum;
      revW /= sum;
      momW /= sum;
      structW /= sum;
      weights.macro = macroW;
      weights.reversal = revW;
      weights.momentum = momW;
      weights.structure = structW;
    }

    const fullBullishReversal =
      input.reversalBull >= 52 &&
      input.m15Bullish &&
      input.m5Bullish &&
      input.momentumBullish &&
      (ls.displacementBullish || ls.recoveryBullish);

    const fullBearishReversal =
      input.reversalBear >= 52 &&
      input.m15Bearish &&
      input.m5Bearish &&
      input.momentumBearish &&
      (ls.displacementBearish || ls.recoveryBearish);

    let macroBullAdj = macroBull;
    let macroBearAdj = macroBear;
    if (fullBullishReversal) macroBearAdj *= 0.22;
    if (fullBearishReversal) macroBullAdj *= 0.22;

    const compositeBull =
      macroBullAdj * macroW +
      input.reversalBull * revW +
      (input.momentumBullish ? 72 : 28) * momW +
      ls.bullish * structW;

    const compositeBear =
      macroBearAdj * macroW +
      input.reversalBear * revW +
      (input.momentumBearish ? 72 : 28) * momW +
      ls.bearish * structW;

    const winningBias: 'BUY' | 'SELL' = compositeBull >= compositeBear ? 'BUY' : 'SELL';
    let direction = winningBias;
    const total = compositeBull + compositeBear || 1;
    const compositeMargin = Math.abs(compositeBull - compositeBear) / total;

    const bullishReversalCluster = fullBullishReversal;
    const bearishReversalCluster = fullBearishReversal;

    if (fullBullishReversal) {
      direction = 'BUY';
      logger.info('Reversal bullish prioritário — macro bearish atenuado', 'Reversal');
    } else if (fullBearishReversal) {
      direction = 'SELL';
      logger.info('Reversal bearish prioritário — macro bullish atenuado', 'Reversal');
    } else if (
      input.reversalBull >= 52 &&
      input.momentumBullish &&
      input.m15Bullish &&
      input.m5Bullish &&
      (input.phase === 'REVERSAL' || input.phase === 'BREAKOUT' || input.phase === 'TRENDING')
    ) {
      direction = 'BUY';
    } else if (
      input.reversalBear >= 52 &&
      input.momentumBearish &&
      input.m15Bearish &&
      input.m5Bearish &&
      (input.phase === 'REVERSAL' || input.phase === 'BREAKOUT' || input.phase === 'TRENDING')
    ) {
      direction = 'SELL';
    }

    const sellAllowed =
      input.h4Bearish &&
      input.h1Bearish &&
      input.reversalBull < 52 &&
      input.momentumBearish &&
      !ls.displacementBullish &&
      !ls.recoveryBullish;

    const bullishReversalPriority =
      input.reversalBull >= 58 &&
      input.m5Bullish &&
      input.m15Bullish &&
      (ls.displacementBullish || ls.recoveryBullish);

    let reversalPriorityCap: number | null = null;
    if (direction === 'SELL' && bullishReversalPriority) {
      direction = 'BUY';
      reversalPriorityCap = 65;
      logger.info('SELL bloqueado — reversão bullish M5+reclaim', 'Reversal');
    }

    if (direction === 'SELL' && !sellAllowed && bullishReversalCluster) {
      direction = 'BUY';
    }

    const buyAllowed =
      input.h4Bullish &&
      input.h1Bullish &&
      input.reversalBear < 45 &&
      input.momentumBullish &&
      !ls.displacementBearish &&
      !ls.recoveryBearish;

    if (direction === 'BUY' && !buyAllowed && bearishReversalCluster && input.reversalBear >= 50) {
      direction = 'SELL';
    }

    const strongMacroBear = input.h4Bearish && input.h1Bearish && input.macroStrength >= 62;
    const strongMacroBull = input.h4Bullish && input.h1Bullish && input.macroStrength >= 62;
    const reversalDominant =
      (direction === 'BUY' && input.reversalBull > input.reversalBear + 10) ||
      (direction === 'SELL' && input.reversalBear > input.reversalBull + 10);

    let confidence = confidenceForContext(
      direction,
      input.phase,
      compositeMargin,
      reversalDominant,
      (direction === 'BUY' && strongMacroBull) || (direction === 'SELL' && strongMacroBear),
      input.exhaustion
    );

    confidence = directionConfidenceAgreement(
      direction,
      confidence,
      input.reversalBull,
      input.reversalBear
    );

    if (reversalPriorityCap != null) {
      confidence = Math.min(confidence, reversalPriorityCap);
    }

    if (bullishReversalCluster && direction === 'SELL') {
      confidence = Math.min(confidence, 68);
      direction = 'BUY';
    }

    if (bearishReversalCluster && direction === 'BUY') {
      confidence = Math.min(confidence, 68);
    }

    if (direction === 'BUY' && bullishReversalCluster) {
      confidence = clamp(confidence + 4, 68, 82);
    }

    confidence = applyConfidenceCaps(
      direction,
      confidence,
      input.macroDirection,
      bullishReversalCluster,
      bearishReversalCluster,
      input
    );

    if (streamStaleGuard || realtimeState.isStale()) {
      confidence = Math.max(48, confidence - 12);
      logger.warn('[Lux:Realtime] stream stale — decision ref reduced', 'Decision');
    }

    const primaryReason =
      direction === 'BUY' && bullishReversalCluster
        ? 'Decision: reversão bullish — M15/M5 + displacement/recovery'
        : direction === 'SELL' && bearishReversalCluster
          ? 'Decision: reversão bearish confirmada'
          : direction === winningBias
            ? `Decision: composite ${winningBias} (macro ${weights.macro * 100}% rev ${weights.reversal * 100}%)`
            : `Decision: override → ${direction} vs composite ${winningBias}`;

    logger.info(
      `phase=${input.phase} macroW=${weights.macro} revW=${weights.reversal} ` +
        `bull=${compositeBull.toFixed(0)} bear=${compositeBear.toFixed(0)} ` +
        `win=${winningBias} final=${direction} conf=${confidence}%`,
      'Decision'
    );

    return {
      direction,
      confidence,
      winningBias,
      compositeBull,
      compositeBear,
      primaryReason,
      weights,
    };
  }
}
