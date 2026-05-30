import type { SupremeAnalysis } from '../../lib/engines/InstitutionalSupremeEngine';
import type { CandleAnalysis } from '../../lib/engines/CandleAnalyzer';
import type { StructureAnalysis } from '../../lib/engines/MarketStructureEngine';
import type { LiquidityAnalysis } from '../../lib/engines/LiquidityEngine';
import type { Candle } from '../../lib/services/indicators';
import { SCORE_WEIGHTS } from '../../lib/services/institutional/institutionalScoreEngine';
import {
  normalizeMomentum,
  normalizeVolatility,
  structureStrength,
  reversalStrength,
} from './normalizers';
import type { RegimeResult } from './MarketRegimeEngine';

export interface ConfidenceResult {
  trend: number;
  momentum: number;
  reversal: number;
  structure: number;
  volume: number;
  volatility: number;
  finalConfidence: number;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export function computeInstitutionalConfidence(input: {
  symbol: string;
  direction: 'BUY' | 'SELL';
  candles: Candle[];
  supreme: SupremeAnalysis;
  candleAnalysis: CandleAnalysis;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  mtfAligned: boolean;
  ensembleScore: number;
  regime: RegimeResult;
  mtfAgreement: number;
}): ConfidenceResult {
  const {
    symbol,
    direction,
    candles,
    supreme,
    candleAnalysis,
    structure,
    liquidity,
    mtfAligned,
    ensembleScore,
    regime,
    mtfAgreement,
  } = input;

  const s = supreme.scores;
  const trend = clamp(
    s.trendScore * 0.38 +
      supreme.mtfAlignmentScore * 100 * 0.22 +
      mtfAgreement * 0.25 +
      ensembleScore * 0.1 +
      (mtfAligned ? 8 : -6)
  );

  const momentum = normalizeMomentum(candles, supreme.momentum);
  const reversal = reversalStrength(supreme.reversalBull, supreme.reversalBear, direction);
  const structureScore = structureStrength(structure);
  const volume = clamp(s.volumeScore + (liquidity.sweepDetected ? 4 : 0));
  const volatility = normalizeVolatility(candles, 100 - Math.abs(candleAnalysis.volatility - 50) * 1.05);

  const w = SCORE_WEIGHTS;
  let raw =
    trend * w.trend +
    momentum * w.momentum +
    reversal * w.reversal +
    structureScore * w.structure +
    volume * w.volume +
    volatility * w.volatility;

  raw += regime.modifier;
  if (supreme.exhaustion) raw -= 6;
  if (supreme.fakeBreakout) raw -= 8;

  const finalConfidence = Math.round(clamp(raw, 41, 94));

  console.log(
    `[Lux:InstitutionalAI] ${symbol} trend=${Math.round(trend)} momentum=${Math.round(momentum)} ` +
      `reversal=${Math.round(reversal)} structure=${Math.round(structureScore)} vol=${Math.round(volatility)} ` +
      `final=${finalConfidence}`
  );

  return {
    trend: Math.round(trend),
    momentum: Math.round(momentum),
    reversal: Math.round(reversal),
    structure: Math.round(structureScore),
    volume: Math.round(volume),
    volatility: Math.round(volatility),
    finalConfidence,
  };
}
