import type { Candle } from '../../lib/services/indicators';
import type { MtfConsensusResult } from './MultiTimeframeConsensus';
import type { MarketRegime } from './types';

export interface ValidationInput {
  candles: Candle[];
  direction: 'BUY' | 'SELL';
  mtf: MtfConsensusResult;
  regime: MarketRegime;
  atr: number;
  structureNeutral: boolean;
  liquidityScore: number;
  volatilityScore: number;
}

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
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

export function validateInstitutionalSignal(input: ValidationInput): ValidationResult {
  const reasons: string[] = [];
  const { candles, direction, mtf, regime, structureNeutral, liquidityScore, volatilityScore } =
    input;

  if (candles.length < 20) {
    return { valid: false, reasons: ['Candles insuficientes'] };
  }

  const atr = input.atr || calcATR(candles);
  const price = candles[candles.length - 1]?.close ?? 0;
  const atrPct = price > 0 ? (atr / price) * 10000 : 0;

  if (volatilityScore < 42) reasons.push('Volatilidade degenerada');
  if (liquidityScore < 35) reasons.push('Liquidez baixa');
  if (structureNeutral) reasons.push('Estrutura neutra');
  if (atrPct < 0.8 && regime === 'RANGING') reasons.push('ATR comprimido');

  const mtfConflict =
    mtf.direction !== 'NEUTRAL' &&
    mtf.direction !== direction &&
    Math.abs(mtf.score) > 0.12;
  if (mtfConflict) reasons.push('Conflito multi-timeframe');

  if (mtf.agreement < 40) reasons.push('Consenso MTF fraco');

  const valid = reasons.length === 0;
  console.log(`[Lux:Validation] ${valid ? 'PASS' : 'BLOCK'} ${reasons.join(' · ') || 'ok'}`);
  return { valid, reasons };
}
