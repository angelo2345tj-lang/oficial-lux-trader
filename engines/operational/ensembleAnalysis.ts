import { SignalType } from '../../types';
import { StructureAnalysis } from '../MarketStructureEngine';
import { LiquidityAnalysis } from '../LiquidityEngine';
import { SmartMoneyAnalysis } from '../SmartMoneyEngine';
import { CandleAnalysis } from '../CandleAnalyzer';
import { ConfluenceResult } from '../../services/confluenceEngine';

export interface EnsembleResult {
  direction: SignalType;
  score: number;
  agreement: number;
  votes: { source: string; direction: SignalType; weight: number }[];
}

const toSignal = (d: 'BUY' | 'SELL' | 'NEUTRAL'): SignalType => {
  if (d === 'BUY') return SignalType.BUY;
  if (d === 'SELL') return SignalType.SELL;
  return SignalType.NEUTRAL;
};

export class EnsembleAnalysis {
  static analyze(
    confluence: ConfluenceResult,
    structure: StructureAnalysis,
    liquidity: LiquidityAnalysis,
    smc: SmartMoneyAnalysis,
    candles: CandleAnalysis
  ): EnsembleResult {
    const votes: EnsembleResult['votes'] = [
      { source: 'Confluence', direction: confluence.signal, weight: 0.35 },
      { source: 'Structure', direction: toSignal(structure.direction), weight: 0.2 },
      { source: 'Liquidity', direction: toSignal(liquidity.sweepDirection ?? 'NEUTRAL'), weight: 0.15 },
      {
        source: 'SMC',
        direction: smc.smcBias === 'ACUMULAÇÃO' ? SignalType.BUY : smc.smcBias === 'DISTRIBUIÇÃO' ? SignalType.SELL : SignalType.NEUTRAL,
        weight: 0.15,
      },
      { source: 'Candles', direction: toSignal(candles.direction), weight: 0.15 },
    ];

    let buyW = 0;
    let sellW = 0;
    let agree = 0;
    const mainDir = confluence.signal;

    for (const v of votes) {
      if (v.direction === SignalType.BUY) buyW += v.weight;
      if (v.direction === SignalType.SELL) sellW += v.weight;
      if (v.direction === mainDir && v.direction !== SignalType.NEUTRAL) agree += v.weight;
    }

    const direction = buyW > sellW ? SignalType.BUY : sellW > buyW ? SignalType.SELL : SignalType.NEUTRAL;
    const score = Math.round(
      confluence.score * 0.3 +
        structure.score * 0.2 +
        liquidity.score * 0.15 +
        smc.score * 0.15 +
        candles.score * 0.2
    );

    return {
      direction,
      score: Math.min(100, score),
      agreement: Math.round(agree * 100),
      votes,
    };
  }
}
