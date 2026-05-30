import type { Candle } from '../../lib/services/indicators';
import type { StructureAnalysis } from '../../lib/engines/MarketStructureEngine';
import type { CandleAnalysis } from '../../lib/engines/CandleAnalyzer';
import type { MarketRegime } from './types';

export interface RegimeResult {
  regime: MarketRegime;
  phase: string;
  modifier: number;
}

export function classifyMarketRegime(
  candles: Candle[],
  structure: StructureAnalysis,
  candleAnalysis: CandleAnalysis
): RegimeResult {
  const vol = candleAnalysis.volatility;
  const range = structure.trend === 'RANGE';

  let regime: MarketRegime = 'TRENDING';
  let modifier = 0;

  if (structure.choch && (candleAnalysis.reversal || candleAnalysis.fakeout)) {
    regime = 'REVERSAL';
    modifier = -4;
  } else if (range && vol < 45) {
    regime = 'RANGING';
    modifier = -8;
  } else if (vol > 72 && structure.bos) {
    regime = 'EXPANSION';
    modifier = 4;
  } else if (range && vol >= 45 && vol <= 65) {
    const last = candles.slice(-8);
    const upVol = last.filter((c) => c.close >= c.open).reduce((s, c) => s + c.volume, 0);
    const downVol = last.filter((c) => c.close < c.open).reduce((s, c) => s + c.volume, 0);
    regime = upVol > downVol * 1.15 ? 'ACCUMULATION' : downVol > upVol * 1.15 ? 'DISTRIBUTION' : 'RANGING';
    modifier = regime === 'RANGING' ? -6 : 0;
  }

  const phase =
    regime === 'TRENDING'
      ? structure.trend
      : regime === 'REVERSAL'
        ? 'REVERSAL_SETUP'
        : regime;

  console.log(`[Lux:Regime] ${regime} vol=${vol} modifier=${modifier}`);
  return { regime, phase, modifier };
}
