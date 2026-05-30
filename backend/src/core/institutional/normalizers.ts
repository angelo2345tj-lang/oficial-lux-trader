import type { Candle } from '../../lib/services/indicators';

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function percentileRank(values: number[], current: number): number {
  if (values.length < 3) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v <= current) below++;
  }
  return clamp((below / sorted.length) * 100);
}

/** Evita momentum fixo em 100 — usa percentil de velocidade recente. */
export function normalizeMomentum(candles: Candle[], rawVelocity: number): number {
  if (candles.length < 12) return clamp(rawVelocity, 35, 75);

  const velocities: number[] = [];
  for (let i = Math.max(5, candles.length - 20); i < candles.length; i++) {
    const slice = candles.slice(i - 5, i);
    if (slice.length < 5) continue;
    const move = Math.abs(slice[slice.length - 1].close - slice[0].close);
    const avgRange =
      slice.reduce((s, c) => s + (c.high - c.low), 0) / slice.length || 1e-9;
    velocities.push((move / avgRange) * 50);
  }

  const rank = percentileRank(velocities, rawVelocity);
  const rsiSlope = candles.length >= 14 ? candles[candles.length - 1].close - candles[candles.length - 14].close : 0;
  const slopeBoost = clamp(50 + rsiSlope * 800, 40, 60) - 50;

  return clamp(rank * 0.75 + rawVelocity * 0.15 + slopeBoost, 38, 88);
}

function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** Evita volatility 0 — ATR percentil + range expansion. */
export function normalizeVolatility(candles: Candle[], rawVolScore: number): number {
  if (candles.length < 20) return clamp(rawVolScore || 50, 42, 72);

  const atrs: number[] = [];
  for (let i = 20; i <= candles.length; i++) {
    const slice = candles.slice(0, i);
    atrs.push(calcATR(slice));
  }
  const currentAtr = atrs[atrs.length - 1] || 0;
  const atrPct = percentileRank(atrs.filter((v) => v > 0), currentAtr);

  const last = candles[candles.length - 1];
  const rangePct = ((last.high - last.low) / (last.close || 1)) * 10000;

  const blended = atrPct * 0.6 + clamp(rangePct * 8, 0, 100) * 0.25 + (rawVolScore || 50) * 0.15;
  return clamp(blended, 42, 92);
}

export function structureStrength(structure: { bos: boolean; choch: boolean; trend: string }): number {
  let s = 50;
  if (structure.bos) s += 12;
  if (structure.choch) s += 10;
  if (structure.trend === 'UP' || structure.trend === 'DOWN') s += 8;
  if (structure.trend === 'RANGE') s -= 6;
  return clamp(s);
}

export function reversalStrength(bull: number, bear: number, direction: 'BUY' | 'SELL'): number {
  const margin = bull - bear;
  return clamp(direction === 'BUY' ? 50 + margin * 0.45 : 50 - margin * 0.45, 35, 88);
}
