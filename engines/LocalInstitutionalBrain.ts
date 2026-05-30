/**
 * Motor IA institucional 100% local — sem APIs externas.
 * Consolida regime, estrutura SMC, MTF e momentum em AI Score 0–100.
 */
import { Candle, ema, getRSIValue } from '../services/indicators';
import { StructureAnalysis } from './MarketStructureEngine';
import { LiquidityAnalysis } from './LiquidityEngine';
import { SmartMoneyAnalysis } from './SmartMoneyEngine';
import { CandleAnalysis } from './CandleAnalyzer';
import { SupremeAnalysis } from './InstitutionalSupremeEngine';
import type { MTFExtendedPack } from './MarketPhaseEngine';

export type AIStrengthTier = 'EXTREMAMENTE FORTE' | 'FORTE' | 'MODERADA' | 'FRACA';

export interface LocalInstitutionalInput {
  symbol: string;
  direction: 'BUY' | 'SELL';
  candles: Candle[];
  mtfPack: MTFExtendedPack | null;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  smc: SmartMoneyAnalysis;
  candleAnalysis: CandleAnalysis;
  supreme: SupremeAnalysis;
  mtfAligned: boolean;
  baseConfidence: number;
}

export interface LocalInstitutionalResult {
  aiScore: number;
  tier: AIStrengthTier;
  regime: string;
  trendClass: string;
  volatilityClass: string;
  marketPhase: string;
  mtfConfirmationPct: number;
  bosDetected: boolean;
  chochDetected: boolean;
  liquiditySweep: boolean;
  fakeBreakout: boolean;
  supplyDemand: string;
  momentumAcceleration: number;
  entryReason: string;
  riskExplanation: string;
  decisionReason: string;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function tierFromScore(score: number): AIStrengthTier {
  if (score >= 88) return 'EXTREMAMENTE FORTE';
  if (score >= 72) return 'FORTE';
  if (score >= 58) return 'MODERADA';
  return 'FRACA';
}

function emaTrend(candles: Candle[]): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (candles.length < 30) return 'NEUTRAL';
  const closes = candles.map((c) => c.close);
  const series = ema(closes, 21);
  const e = series[series.length - 1] ?? closes[closes.length - 1];
  const price = closes[closes.length - 1];
  if (price > e * 1.0002) return 'BUY';
  if (price < e * 0.9998) return 'SELL';
  return 'NEUTRAL';
}

function volatilityClass(vol: number): string {
  if (vol >= 80) return 'ALTA';
  if (vol >= 45) return 'MODERADA';
  return 'BAIXA';
}

function mtfConfirmation(
  pack: MTFExtendedPack | null,
  direction: 'BUY' | 'SELL'
): number {
  if (!pack) return 50;
  const frames = [
    { w: 5, candles: pack.m1 },
    { w: 10, candles: pack.m5 },
    { w: 15, candles: pack.m15 },
    { w: 25, candles: pack.h1 },
    { w: 45, candles: pack.h4 },
  ];
  let score = 0;
  let weight = 0;
  for (const f of frames) {
    if (!f.candles?.length) continue;
    const t = emaTrend(f.candles);
    weight += f.w;
    if (t === direction) score += f.w;
    else if (t === 'NEUTRAL') score += f.w * 0.35;
  }
  return weight > 0 ? Math.round((score / weight) * 100) : 50;
}

function supplyDemandLabel(
  structure: StructureAnalysis,
  liquidity: LiquidityAnalysis,
  smc: SmartMoneyAnalysis
): string {
  if (liquidity.sweepDetected) return 'Sweep de liquidez — zona institucional';
  if (smc.orderBlocks?.length) return `Order block ${smc.smcBias}`;
  if (structure.swingHighs.length && structure.swingLows.length) {
    return structure.trend === 'BULLISH' ? 'Demanda estrutural' : 'Oferta estrutural';
  }
  return 'Zona neutra';
}

export class LocalInstitutionalBrain {
  static evaluate(input: LocalInstitutionalInput): LocalInstitutionalResult {
    const {
      direction,
      candles,
      mtfPack,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      supreme,
      mtfAligned,
      baseConfidence,
    } = input;

    const mtfPct = mtfConfirmation(mtfPack, direction);
    const regime =
      supreme.exhaustion
        ? 'EXAUSTÃO'
        : supreme.fakeBreakout
          ? 'FAKE BREAKOUT'
          : structure.trend === 'RANGE'
            ? 'LATERAL'
            : supreme.marketPhase;

    let aiScore = baseConfidence;
    aiScore += mtfPct >= 75 ? 6 : mtfPct >= 55 ? 2 : -4;
    if (structure.bos && structure.direction === direction) aiScore += 5;
    if (structure.choch && structure.direction === direction) aiScore += 4;
    if (liquidity.sweepDetected) aiScore += 3;
    if (supreme.fakeBreakout) aiScore -= 8;
    if (supreme.exhaustion) aiScore -= 5;
    if (mtfAligned) aiScore += 4;
    if (candleAnalysis.fakeout) aiScore -= 6;
    aiScore = Math.round(clamp(aiScore, 41, 96));

    const tier = tierFromScore(aiScore);
    const trendClass =
      structure.trend === 'BULLISH'
        ? 'Tendência de alta'
        : structure.trend === 'BEARISH'
          ? 'Tendência de baixa'
          : 'Consolidação';

    const entryParts: string[] = [];
    if (structure.bos) entryParts.push(`BOS ${structure.lastBreak ?? 'confirmado'}`);
    if (structure.choch) entryParts.push('CHOCH estrutural');
    if (liquidity.sweepDetected) entryParts.push('Sweep de liquidez');
    if (mtfAligned) entryParts.push('MTF alinhado H1/H4');
    entryParts.push(supreme.primaryReason);

    const riskParts: string[] = [];
    if (supreme.fakeBreakout) riskParts.push('Risco de falso rompimento');
    if (candleAnalysis.volatility > 80) riskParts.push('Volatilidade extrema');
    if (!mtfAligned) riskParts.push('Divergência multi-timeframe');
    if (structure.trend === 'RANGE') riskParts.push('Mercado lateral — reduzir lote');
    if (riskParts.length === 0) riskParts.push('Risco controlado dentro dos parâmetros institucionais');

    return {
      aiScore,
      tier,
      regime,
      trendClass,
      volatilityClass: volatilityClass(candleAnalysis.volatility),
      marketPhase: supreme.marketPhase,
      mtfConfirmationPct: mtfPct,
      bosDetected: structure.bos,
      chochDetected: structure.choch,
      liquiditySweep: liquidity.sweepDetected,
      fakeBreakout: supreme.fakeBreakout || candleAnalysis.fakeout,
      supplyDemand: supplyDemandLabel(structure, liquidity, smc),
      momentumAcceleration: Math.round(supreme.momentum),
      entryReason: entryParts.filter(Boolean).slice(0, 4).join(' · '),
      riskExplanation: riskParts.join(' · '),
      decisionReason: `${direction} · ${tier} · AI ${aiScore}% · ${regime} · MTF ${mtfPct}%`,
    };
  }
}
