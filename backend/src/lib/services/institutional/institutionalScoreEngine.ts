import type { SupremeAnalysis } from '../../engines/InstitutionalSupremeEngine';
import type { CandleAnalysis } from '../../engines/CandleAnalyzer';
import type { StructureAnalysis } from '../../engines/MarketStructureEngine';
import type { LiquidityAnalysis } from '../../engines/LiquidityEngine';

/** Pesos oficiais — única fórmula de confidence do sistema. */
export const SCORE_WEIGHTS = {
  trend: 0.35,
  momentum: 0.1,
  reversal: 0.25,
  structure: 0.15,
  volume: 0.1,
  volatility: 0.05,
} as const;

export interface ScoreBreakdown {
  trend: number;
  momentum: number;
  reversal: number;
  structure: number;
  volume: number;
  volatility: number;
  finalConfidence: number;
  decisionRef?: number;
  entropyNote?: string;
}

export interface OrganicScoreInput {
  symbol: string;
  direction: 'BUY' | 'SELL';
  supreme: SupremeAnalysis;
  candleAnalysis: CandleAnalysis;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  mtfAligned: boolean;
  ensembleScore: number;
}

const GLOBAL_RECENT: number[] = [];
const PER_SYMBOL = new Map<string, number[]>();

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function directionalScore(bull: number, bear: number, direction: 'BUY' | 'SELL'): number {
  const margin = bull - bear;
  return clamp(direction === 'BUY' ? 50 + margin * 0.5 : 50 - margin * 0.5);
}

function componentTrend(
  supreme: SupremeAnalysis,
  mtfAligned: boolean,
  ensembleScore: number
): number {
  const s = supreme.scores;
  const macroCap = Math.min(supreme.macroStrength, 100) * 0.35;
  const raw =
    s.trendScore * 0.4 +
      supreme.mtfAlignmentScore * 100 * 0.25 +
      macroCap * 0.2 +
      (mtfAligned ? 10 : -5) +
      ensembleScore * 0.1;
  const result = clamp(raw);
  
  console.log('[DEBUG-SCORE-TREND]', {
    trendScore: s.trendScore,
    mtfAlignmentScore: supreme.mtfAlignmentScore,
    macroStrength: supreme.macroStrength,
    macroCap,
    mtfAligned,
    ensembleScore,
    raw,
    result,
  });
  
  return result;
}

function validateDiversity(symbol: string, score: number): void {
  const symKey = symbol.toUpperCase();
  const symHist = PER_SYMBOL.get(symKey) ?? [];
  symHist.push(score);
  if (symHist.length > 8) symHist.shift();
  PER_SYMBOL.set(symKey, symHist);

  GLOBAL_RECENT.push(score);
  if (GLOBAL_RECENT.length > 12) GLOBAL_RECENT.shift();

  if (symHist.length >= 5 && symHist.every((v) => v === symHist[0])) {
    console.warn('[Lux:Score] repetition anomaly detected', symKey, score);
  }

  if (GLOBAL_RECENT.length >= 6) {
    const unique = new Set(GLOBAL_RECENT);
    if (unique.size === 1) {
      console.warn('[Lux:Score] low entropy — global repetition', score);
    }
  }
}

/**
 * ÚNICA função que calcula confidence exibida na UI.
 * Proibido pós-processar o retorno em outros módulos.
 */
export function computeOrganicConfidence(input: OrganicScoreInput): ScoreBreakdown {
  const {
    symbol,
    supreme,
    direction,
    candleAnalysis,
    structure,
    liquidity,
    mtfAligned,
    ensembleScore,
  } = input;
  const s = supreme.scores;

  console.log('[DEBUG-SCORE-RAW]', {
    symbol,
    direction,
    mtfAligned,
    ensembleScore,
    macroDirection: supreme.macroDirection,
    macroStrength: supreme.macroStrength,
    exhaustion: supreme.exhaustion,
    fakeBreakout: supreme.fakeBreakout,
  });

  const trend = componentTrend(supreme, mtfAligned, ensembleScore);
  const momentum = clamp(supreme.momentum);
  const reversal = directionalScore(supreme.reversalBull, supreme.reversalBear, direction);

  let structureScore = s.structureScore;
  if (structure.bos && structure.direction === direction) structureScore += 6;
  if (structure.choch && structure.direction === direction) structureScore += 5;
  if (structure.trend === 'RANGE') structureScore -= 4;
  structureScore = clamp(structureScore);

  const volume = clamp(s.volumeScore + (liquidity.sweepDetected ? 5 : 0));
  const volatility = clamp(100 - Math.abs(candleAnalysis.volatility - 50) * 1.05);

  console.log('[DEBUG-SCORE-COMPONENTS]', {
    symbol,
    trend,
    momentum,
    reversal,
    structureScore,
    volume,
    volatility,
  });

  const w = SCORE_WEIGHTS;
  let raw =
    trend * w.trend +
    momentum * w.momentum +
    reversal * w.reversal +
    structureScore * w.structure +
    volume * w.volume +
    volatility * w.volatility;

  console.log('[DEBUG-SCORE-WEIGHTED]', {
    symbol,
    raw,
    weights: w,
    weighted: {
      trend: trend * w.trend,
      momentum: momentum * w.momentum,
      reversal: reversal * w.reversal,
      structure: structureScore * w.structure,
      volume: volume * w.volume,
      volatility: volatility * w.volatility,
    },
  });

  if (supreme.exhaustion) raw -= 6;
  if (supreme.fakeBreakout) raw -= 8;
  if (direction !== supreme.macroDirection) raw -= 4;

  console.log('[DEBUG-SCORE-PENALTIES]', {
    symbol,
    rawAfterWeighted: raw,
    exhaustion: supreme.exhaustion,
    exhaustionPenalty: supreme.exhaustion ? -6 : 0,
    fakeBreakout: supreme.fakeBreakout,
    fakeBreakoutPenalty: supreme.fakeBreakout ? -8 : 0,
    macroDirection: supreme.macroDirection,
    macroDirectionPenalty: direction !== supreme.macroDirection ? -4 : 0,
    rawAfterPenalties: raw,
  });

  const finalConfidence = Math.round(clamp(raw, 41, 95));

  console.log('[DEBUG-SCORE-FINAL]', {
    symbol,
    rawBeforeClamp: raw,
    clampMin: 41,
    clampMax: 95,
    finalConfidence,
  });

  const breakdown: ScoreBreakdown = {
    trend: Math.round(trend),
    momentum: Math.round(momentum),
    reversal: Math.round(reversal),
    structure: Math.round(structureScore),
    volume: Math.round(volume),
    volatility: Math.round(volatility),
    finalConfidence,
    decisionRef: Math.round(supreme.confidence),
  };

  console.log(
    `[Lux:ScoreBreakdown] ${symbol} trend=${breakdown.trend} momentum=${breakdown.momentum} ` +
      `reversal=${breakdown.reversal} structure=${breakdown.structure} volume=${breakdown.volume} ` +
      `volatility=${breakdown.volatility} finalConfidence=${breakdown.finalConfidence}`
  );

  validateDiversity(symbol, breakdown.finalConfidence);
  return breakdown;
}

export function confidenceLabelFromScore(
  confidence: number
): 'FRACA' | 'MODERADA' | 'FORTE' | 'ELITE' {
  if (confidence >= 85) return 'ELITE';
  if (confidence >= 72) return 'FORTE';
  if (confidence >= 58) return 'MODERADA';
  return 'FRACA';
}

/** Aplica confidence ao sinal — score espelha confidence (legado). */
export function attachConfidenceToSignal<T extends { score: number; confidence?: number }>(
  signal: T,
  confidence: number
): T & { confidence: number; score: number } {
  return {
    ...signal,
    confidence,
    score: confidence,
  };
}
