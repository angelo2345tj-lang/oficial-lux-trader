import { Candle, ema, getRSIValue } from '../services/indicators';
import { ConfluenceResult } from '../services/confluenceEngine';
import { StructureAnalysis } from './MarketStructureEngine';
import { LiquidityAnalysis } from './LiquidityEngine';
import { SmartMoneyAnalysis } from './SmartMoneyEngine';
import { CandleAnalysis } from './CandleAnalyzer';
import { InstitutionalContext } from '../services/ai/InstitutionalAI';
import { MarketPhaseEngine, type MarketPhase, type MTFExtendedPack } from './MarketPhaseEngine';
import {
  InstitutionalDecisionEngine,
  computeLocalStructureBias,
} from './InstitutionalDecisionEngine';
import { logger } from '../services/logger';

export type { MTFExtendedPack } from './MarketPhaseEngine';

export interface SupremeInput {
  candles: Candle[];
  mtfPack: MTFExtendedPack | null;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  smc: SmartMoneyAnalysis;
  candleAnalysis: CandleAnalysis;
  confluence: ConfluenceResult;
  institutional: InstitutionalContext;
  mtfAligned: boolean;
}

export interface InstitutionalScores {
  trendScore: number;
  momentumScore: number;
  liquidityScore: number;
  structureScore: number;
  volumeScore: number;
  reversalScore: number;
  continuationScore: number;
}

export interface SupremeAnalysis {
  direction: 'BUY' | 'SELL';
  confidence: number;
  dominantTrend: 'BULLISH' | 'BEARISH' | 'RANGE';
  momentum: number;
  buyerPressure: number;
  sellerPressure: number;
  institutionalPressure: number;
  directionalProbability: number;
  mtfAlignmentScore: number;
  trendAcceleration: number;
  macroStrength: number;
  macroDirection: 'BUY' | 'SELL';
  primaryReason: string;
  marketPhase: MarketPhase;
  reversalBull: number;
  reversalBear: number;
  scores: InstitutionalScores;
  confluences: string[];
  advisories: string[];
  fakeBreakout: boolean;
  exhaustion: boolean;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function emaSlope(candles: Candle[], period: number): number {
  if (candles.length < period + 5) return 0;
  const closes = candles.map((c) => c.close);
  const series = ema(closes, period);
  const tail = series.slice(-6);
  if (tail.length < 2) return 0;
  const first = tail[0];
  const last = tail[tail.length - 1];
  return first !== 0 ? ((last - first) / first) * 10_000 : 0;
}

function emaValue(candles: Candle[], period: number): number {
  const closes = candles.map((c) => c.close);
  const series = ema(closes, period);
  return series[series.length - 1] ?? closes[closes.length - 1];
}

function vwapPrice(candles: Candle[]): number {
  let pv = 0;
  let vol = 0;
  for (const c of candles.slice(-40)) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = Math.max(c.volume, 1);
    pv += tp * v;
    vol += v;
  }
  return vol > 0 ? pv / vol : candles[candles.length - 1].close;
}

function candleVelocity(candles: Candle[]): number {
  if (candles.length < 8) return 50;
  const recent = candles.slice(-8);
  const moves = recent.map((c, i) => (i === 0 ? 0 : Math.abs(c.close - recent[i - 1].close)));
  const avg = moves.reduce((a, b) => a + b, 0) / moves.length;
  const last = moves[moves.length - 1];
  return avg > 0 ? clamp((last / avg) * 50) : 50;
}

interface TfSnap {
  direction: 'BUY' | 'SELL';
  bull: number;
  bear: number;
  rsi: number;
  priceAboveVwap: boolean;
  ema20Above50: boolean;
}

function analyzeTf(candles: Candle[]): TfSnap {
  let bull = 0;
  let bear = 0;
  const s50 = emaSlope(candles, 50);
  const s20 = emaSlope(candles, 20);
  const e20 = emaValue(candles, 20);
  const e50 = emaValue(candles, 50);
  const price = candles[candles.length - 1].close;
  const vwap = vwapPrice(candles);
  const rsi = getRSIValue(candles);
  const priceAboveVwap = price > vwap;
  const ema20Above50 = e20 > e50;

  if (s20 > 0) bull += 2;
  else bear += 2;
  if (s50 > 0) bull += 2;
  else bear += 2;
  if (priceAboveVwap) bull += 2;
  else bear += 2;
  if (ema20Above50) bull += 2;
  else bear += 2;
  if (rsi > 52) bull += 2;
  else if (rsi < 48) bear += 2;

  return {
    direction: bull >= bear ? 'BUY' : 'SELL',
    bull,
    bear,
    rsi,
    priceAboveVwap,
    ema20Above50,
  };
}

function resolveMacro(
  mtfPack: MTFExtendedPack | null,
  chart: Candle[]
): { direction: 'BUY' | 'SELL'; strength: number; h4: TfSnap; h1: TfSnap } {
  const h4 = analyzeTf(mtfPack?.h4?.length ? mtfPack.h4 : chart);
  const h1 = analyzeTf(mtfPack?.h1?.length ? mtfPack.h1 : chart);
  let bull = h4.bull * 3 + h1.bull * 2;
  let bear = h4.bear * 3 + h1.bear * 2;
  if (h4.direction === h1.direction) {
    if (h4.direction === 'BUY') bull += 8;
    else bear += 8;
  }
  const total = bull + bear || 1;
  return {
    direction: bull >= bear ? 'BUY' : 'SELL',
    strength: clamp((Math.abs(bull - bear) / total) * 100, 30, 92),
    h4,
    h1,
  };
}

interface ReversalSignals {
  bull: number;
  bear: number;
  tags: string[];
}

function detectReversal(input: {
  candles: Candle[];
  mtfPack: MTFExtendedPack | null;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  candleAnalysis: CandleAnalysis;
  institutional: InstitutionalContext;
}): ReversalSignals {
  const { candles, mtfPack, structure, liquidity, candleAnalysis, institutional } = input;
  let bull = 0;
  let bear = 0;
  const tags: string[] = [];

  const chart = analyzeTf(candles);
  const m15 = mtfPack?.m15?.length ? analyzeTf(mtfPack.m15) : chart;
  const m5 = mtfPack?.m5?.length ? analyzeTf(mtfPack.m5) : chart;
  const price = candles[candles.length - 1].close;
  const vwap = vwapPrice(candles);
  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];
  const rsi = chart.rsi;
  const rsiPrev = getRSIValue(candles.slice(0, -1));

  const bosBull = structure.bos && (structure.direction === 'BUY' || structure.trend === 'BULLISH');
  const chochBull = structure.choch && (structure.direction === 'BUY' || structure.trend === 'BULLISH');
  const bosBear = structure.bos && (structure.direction === 'SELL' || structure.trend === 'BEARISH');
  const chochBear = structure.choch && (structure.direction === 'SELL' || structure.trend === 'BEARISH');

  if (bosBull) { bull += 14; tags.push('BOS bullish'); }
  if (chochBull) { bull += 12; tags.push('CHOCH bullish'); }
  if (bosBear) { bear += 14; tags.push('BOS bearish'); }
  if (chochBear) { bear += 12; tags.push('CHOCH bearish'); }

  if (chart.ema20Above50 && !analyzeTf(candles.slice(0, -5)).ema20Above50) {
    bull += 10;
    tags.push('EMA20 cruzou EMA50');
  }
  if (!chart.ema20Above50 && analyzeTf(candles.slice(0, -5)).ema20Above50) {
    bear += 10;
    tags.push('EMA20 perdeu EMA50');
  }

  if (price > vwap && prev.close <= vwapPrice(candles.slice(0, -1))) {
    bull += 12;
    tags.push('Recuperação VWAP');
  }
  if (price < vwap && prev.close >= vwapPrice(candles.slice(0, -1))) {
    bear += 12;
    tags.push('Perda VWAP');
  }

  if (rsi > 50 && rsiPrev < 48) { bull += 8; tags.push('RSI recovery'); }
  if (rsi < 50 && rsiPrev > 52) { bear += 8; tags.push('RSI breakdown'); }

  if (candleAnalysis.pattern === 'REVERSAL_BULL' || (last.close > last.open && last.close > prev.high)) {
    bull += 10;
    tags.push('Engulfing/displacement bullish');
  }
  if (candleAnalysis.pattern === 'REVERSAL_BEAR' || (last.close < last.open && last.close < prev.low)) {
    bear += 10;
    tags.push('Engulfing/displacement bearish');
  }

  const vel = candleVelocity(candles);
  const accel = emaSlope(candles, 20) - emaSlope(candles.slice(0, -3), 20);
  if (vel > 62 && last.close > prev.close) { bull += 8; tags.push('Momentum acceleration ↑'); }
  if (vel > 62 && last.close < prev.close) { bear += 8; tags.push('Momentum acceleration ↓'); }

  if (liquidity.sweepDetected && liquidity.sweepDirection === 'BUY') {
    bull += 11;
    tags.push('Sweep reversal bullish');
  }
  if (liquidity.sweepDetected && liquidity.sweepDirection === 'SELL') {
    bear += 11;
    tags.push('Sweep reversal bearish');
  }

  if (institutional.absorption && last.close >= last.open) {
    bull += 7;
    tags.push('Absorção bullish');
  }
  if (institutional.absorption && last.close < last.open) {
    bear += 7;
    tags.push('Absorção bearish');
  }

  if (m15.direction === 'BUY' && m5.direction === 'BUY') {
    bull += 14;
    tags.push('M15+M5 bullish');
  }
  if (m15.direction === 'SELL' && m5.direction === 'SELL') {
    bear += 14;
    tags.push('M15+M5 bearish');
  }

  if (chart.priceAboveVwap && m15.priceAboveVwap && m5.priceAboveVwap) {
    bull += 8;
    tags.push('Structure reclaim bullish');
  }
  if (!chart.priceAboveVwap && !m15.priceAboveVwap && !m5.priceAboveVwap) {
    bear += 8;
    tags.push('Structure reclaim bearish');
  }

  const avgVol = candles.slice(-10, -1).reduce((a, c) => a + c.volume, 0) / 9;
  if (last.volume > avgVol * 1.3) {
    if (last.close >= last.open) bull += 6;
    else bear += 6;
    tags.push('Volume spike direcional');
  }

  logger.info(`Reversão bull ${bull} · bear ${bear} · ${tags.slice(0, 4).join(', ')}`, 'Reversal');

  return { bull: clamp(bull), bear: clamp(bear), tags };
}

export class InstitutionalSupremeEngine {
  static analyze(input: SupremeInput): SupremeAnalysis {
    const {
      candles,
      mtfPack,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      institutional,
    } = input;

    const confluences: string[] = [];
    const advisories: string[] = [];

    const macro = resolveMacro(mtfPack, candles);
    const reversal = detectReversal({
      candles,
      mtfPack,
      structure,
      liquidity,
      candleAnalysis,
      institutional,
    });

    const reversalBull = reversal.bull;
    const reversalBear = reversal.bear;
    reversal.tags.forEach((t) => confluences.push(t));

    const phase = MarketPhaseEngine.detect({
      candles,
      mtfPack,
      structure,
      liquidity,
      candleAnalysis,
      macroDirection: macro.direction,
      reversalBull,
      reversalBear,
      momentum: candleVelocity(candles),
    });

    logger.info(`Macro ${macro.direction} ${macro.strength}%`, 'Trend');

    const m15Candles = mtfPack?.m15?.length ? mtfPack.m15 : candles;
    const m5Candles = mtfPack?.m5?.length ? mtfPack.m5 : candles;
    const m15Snap = analyzeTf(m15Candles);
    const m5Snap = analyzeTf(m5Candles);
    const chart = analyzeTf(candles);

    const localStructure = computeLocalStructureBias(
      candles,
      m15Candles,
      m5Candles,
      structure,
      candleAnalysis
    );

    const velocity = candleVelocity(candles);
    const momentumBullish = velocity > 52 && chart.rsi > 50;
    const momentumBearish = velocity > 52 && chart.rsi < 50;

    if (localStructure.displacementBullish) confluences.push('Displacement bullish');
    if (localStructure.recoveryBullish) confluences.push('Recovery VWAP bullish');
    if (m15Snap.direction === 'BUY') confluences.push('M15 bullish');
    if (m5Snap.direction === 'BUY') confluences.push('M5 bullish');

    const rsi = chart.rsi;
    const exhaustion =
      institutional.exhaustion || (rsi > 78) || (rsi < 22);
    const fakeBreakout = candleAnalysis.fakeout && !structure.bos;

    const decision = InstitutionalDecisionEngine.resolve({
      phase: phase.phase,
      macroDirection: macro.direction,
      macroStrength: macro.strength,
      h4Bearish: macro.h4.direction === 'SELL',
      h1Bearish: macro.h1.direction === 'SELL',
      h4Bullish: macro.h4.direction === 'BUY',
      h1Bullish: macro.h1.direction === 'BUY',
      reversalBull,
      reversalBear,
      momentumBullish,
      momentumBearish,
      m15Bullish: m15Snap.direction === 'BUY',
      m5Bullish: m5Snap.direction === 'BUY',
      m15Bearish: m15Snap.direction === 'SELL',
      m5Bearish: m5Snap.direction === 'SELL',
      localStructure,
      exhaustion,
    });

    const direction = decision.direction;
    const confidence = decision.confidence;
    const alignedMacro = direction === macro.direction;

    const scores: InstitutionalScores = {
      trendScore: clamp(macro.strength),
      momentumScore: clamp(velocity),
      liquidityScore: clamp(liquidity.score),
      structureScore: clamp(localStructure.bullish),
      volumeScore: clamp(
        candles[candles.length - 1].volume >
          candles.slice(-8, -1).reduce((a, c) => a + c.volume, 0) / 7
          ? 68
          : 42
      ),
      reversalScore: clamp(Math.max(reversalBull, reversalBear)),
      continuationScore: candleAnalysis.continuation ? 72 : 45,
    };

    const buyerPressure = clamp(
      (decision.compositeBull / (decision.compositeBull + decision.compositeBear || 1)) * 100
    );
    const sellerPressure = clamp(
      (decision.compositeBear / (decision.compositeBull + decision.compositeBear || 1)) * 100
    );
    const mtfAlignmentScore =
      mtfPack && macro.h4.direction === macro.h1.direction
        ? macro.h4.direction === direction
          ? 0.82
          : 0.42
        : 0.5;

    let dominantTrend: SupremeAnalysis['dominantTrend'] = 'RANGE';
    if (phase.phase === 'REVERSAL' || localStructure.bias === direction) {
      dominantTrend = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
    } else if (macro.h4.direction === 'BUY' && macro.h1.direction === 'BUY') {
      dominantTrend = 'BULLISH';
    } else if (macro.h4.direction === 'SELL' && macro.h1.direction === 'SELL') {
      dominantTrend = 'BEARISH';
    }

    const primaryReason = decision.primaryReason;

    logger.info(
      `Score trend ${scores.trendScore} mom ${scores.momentumScore} rev ${scores.reversalScore} struct ${scores.structureScore}`,
      'Score'
    );
    logger.info(`${direction} ${confidence}% · ${primaryReason}`, 'Institutional');

    return {
      direction,
      confidence,
      dominantTrend,
      momentum: scores.momentumScore,
      buyerPressure,
      sellerPressure,
      institutionalPressure: clamp((institutional.score + liquidity.score + smc.score) / 3),
      directionalProbability: clamp(
        direction === 'BUY' ? buyerPressure * 0.55 + confidence * 0.45 : sellerPressure * 0.55 + confidence * 0.45,
        52,
        92
      ),
      mtfAlignmentScore,
      trendAcceleration: emaSlope(candles, 20) - emaSlope(candles.slice(0, -3), 20),
      macroStrength: macro.strength,
      macroDirection: macro.direction,
      primaryReason,
      marketPhase: phase.phase,
      reversalBull,
      reversalBear,
      scores,
      confluences: [...new Set(confluences)].slice(0, 24),
      advisories,
      fakeBreakout,
      exhaustion,
    };
  }
}
