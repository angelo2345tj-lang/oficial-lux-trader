import { StructureAnalysis } from './MarketStructureEngine';
import { LiquidityAnalysis } from './LiquidityEngine';
import { SmartMoneyAnalysis } from './SmartMoneyEngine';
import { CandleAnalysis } from './CandleAnalyzer';
import { ConfluenceResult } from '../services/confluenceEngine';

export interface ConfidenceResult {
  score: number;
  winProbability: number;
  classification: 'ELITE' | 'STRONG' | 'MODERATE' | 'WEAK';
  approved: boolean;
  factors: string[];
  blockers: string[];
}

export class SignalConfidenceEngine {
  static compute(
    confluence: ConfluenceResult,
    structure: StructureAnalysis,
    liquidity: LiquidityAnalysis,
    smc: SmartMoneyAnalysis,
    candles: CandleAnalysis,
    mtfAligned: boolean
  ): ConfidenceResult {
    const factors: string[] = [];
    const blockers: string[] = [];

    let score =
      confluence.score * 0.35 +
      structure.score * 0.2 +
      liquidity.score * 0.15 +
      smc.score * 0.15 +
      candles.score * 0.15;

    if (mtfAligned) {
      score += 8;
      factors.push('MTF alinhado (+8)');
    } else {
      score -= 5;
      blockers.push('MTF parcial');
    }

    if (structure.bos) factors.push('BOS confirmado');
    if (structure.choch) factors.push('CHOCH detectado');
    if (liquidity.sweepDetected) factors.push(`Liquidity sweep ${liquidity.sweepDirection}`);
    if (smc.orderBlocks.some((o) => !o.mitigated)) factors.push('Order Block ativo');
    if (candles.impulse) factors.push('Impulso forte');
    if (candles.fakeout) blockers.push('Fakeout recente — cautela');
    if (candles.manipulation) {
      score -= 12;
      blockers.push('Possível manipulação');
    }

    if (confluence.blocked) {
      blockers.push(confluence.blockReason || 'Bloqueado pela confluência');
      score = Math.min(score, 45);
    }

    score = Math.round(Math.min(100, Math.max(0, score)));
    const winProbability = Math.round(Math.min(95, score * 0.92 + (mtfAligned ? 5 : 0)));

    let classification: ConfidenceResult['classification'] = 'WEAK';
    if (score >= 85) classification = 'ELITE';
    else if (score >= 72) classification = 'STRONG';
    else if (score >= 62) classification = 'MODERATE';

    const approved =
      !confluence.blocked &&
      score >= 62 &&
      winProbability >= 60 &&
      !candles.manipulation;

    return { score, winProbability, classification, approved, factors, blockers };
  }
}
