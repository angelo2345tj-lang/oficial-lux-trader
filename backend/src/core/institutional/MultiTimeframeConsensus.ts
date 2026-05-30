import type { Candle } from '../../lib/services/indicators';

export interface MtfConsensusResult {
  score: number;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  agreement: number;
  breakdown: { h4: number; h1: number; m15: number; m5: number };
}

function emaTrend(candles: Candle[]): number {
  if (candles.length < 22) return 0;
  const closes = candles.map((c) => c.close);
  const k = 2 / 22;
  let ema = closes[0];
  for (const c of closes) ema = c * k + ema * (1 - k);
  const price = closes[closes.length - 1];
  const dist = (price - ema) / (ema || 1);
  return Math.max(-1, Math.min(1, dist * 120));
}

/**
 * Consenso institucional: H4 40%, H1 30%, M15 20%, M5 10%. M1 não entra no viés.
 */
export function computeMultiTimeframeConsensus(mtf: {
  m5: Candle[];
  m15: Candle[];
  h1: Candle[];
  h4: Candle[];
}): MtfConsensusResult {
  const h4 = emaTrend(mtf.h4);
  const h1 = emaTrend(mtf.h1);
  const m15 = emaTrend(mtf.m15);
  const m5 = emaTrend(mtf.m5);

  const score = h4 * 0.4 + h1 * 0.3 + m15 * 0.2 + m5 * 0.1;
  const agreement = Math.round(
    (Math.sign(h4) === Math.sign(h1) ? 25 : 0) +
      (Math.sign(h1) === Math.sign(m15) ? 25 : 0) +
      (Math.sign(m15) === Math.sign(m5) ? 25 : 0) +
      (Math.abs(score) > 0.15 ? 25 : 0)
  );

  let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (score > 0.08) direction = 'BUY';
  else if (score < -0.08) direction = 'SELL';

  console.log(
    `[Lux:Consensus] h4=${h4.toFixed(2)} h1=${h1.toFixed(2)} m15=${m15.toFixed(2)} m5=${m5.toFixed(2)} → ${direction} ${Math.round(score * 100)}%`
  );

  return {
    score,
    direction,
    agreement,
    breakdown: { h4, h1, m15, m5 },
  };
}
