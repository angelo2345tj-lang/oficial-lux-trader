import { Candle, ema, getRSIValue } from '../services/indicators';
import { StructureAnalysis } from './MarketStructureEngine';
import { LiquidityAnalysis } from './LiquidityEngine';
import { CandleAnalysis } from './CandleAnalyzer';
import { logger } from '../services/logger';
export interface MTFExtendedPack {
  m1: Candle[];
  m5: Candle[];
  m15: Candle[];
  h1: Candle[];
  h4: Candle[];
}

export type MarketPhase =
  | 'TRENDING'
  | 'REVERSAL'
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'BREAKOUT'
  | 'EXHAUSTION'
  | 'RANGING';

export interface PhaseWeights {
  h4: number;
  h1: number;
  m15: number;
  m5: number;
  m1: number;
  chart: number;
}

export interface MarketPhaseResult {
  phase: MarketPhase;
  bias: 'BUY' | 'SELL';
  phaseStrength: number;
  weights: PhaseWeights;
  macroDampen: number;
  shortTermBoost: number;
  notes: string[];
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function emaValue(candles: Candle[], period: number): number {
  const closes = candles.map((c) => c.close);
  const series = ema(closes, period);
  return series[series.length - 1] ?? closes[closes.length - 1];
}

function vwapPrice(candles: Candle[]): number {
  let pv = 0;
  let vol = 0;
  for (const c of candles.slice(-30)) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = Math.max(c.volume, 1);
    pv += tp * v;
    vol += v;
  }
  return vol > 0 ? pv / vol : candles[candles.length - 1].close;
}

const WEIGHT_PRESETS: Record<MarketPhase, PhaseWeights> = {
  TRENDING: { h4: 34, h1: 26, m15: 16, m5: 14, m1: 5, chart: 5 },
  REVERSAL: { h4: 10, h1: 12, m15: 28, m5: 28, m1: 12, chart: 10 },
  ACCUMULATION: { h4: 18, h1: 16, m15: 22, m5: 22, m1: 12, chart: 10 },
  DISTRIBUTION: { h4: 18, h1: 16, m15: 22, m5: 22, m1: 12, chart: 10 },
  BREAKOUT: { h4: 16, h1: 14, m15: 22, m5: 26, m1: 12, chart: 10 },
  EXHAUSTION: { h4: 22, h1: 18, m15: 20, m5: 20, m1: 10, chart: 10 },
  RANGING: { h4: 20, h1: 18, m15: 22, m5: 22, m1: 10, chart: 8 },
};

export class MarketPhaseEngine {
  static detect(input: {
    candles: Candle[];
    mtfPack: MTFExtendedPack | null;
    structure: StructureAnalysis;
    liquidity: LiquidityAnalysis;
    candleAnalysis: CandleAnalysis;
    macroDirection: 'BUY' | 'SELL';
    reversalBull: number;
    reversalBear: number;
    momentum: number;
  }): MarketPhaseResult {
    const {
      candles,
      mtfPack,
      structure,
      liquidity,
      candleAnalysis,
      macroDirection,
      reversalBull,
      reversalBear,
      momentum,
    } = input;

    const notes: string[] = [];
    const price = candles[candles.length - 1].close;
    const vwap = vwapPrice(candles);
    const rsi = getRSIValue(candles);
    const e20 = emaValue(candles, 20);
    const e50 = emaValue(candles, 50);

    const m15 = mtfPack?.m15 ?? candles;
    const m5 = mtfPack?.m5 ?? candles;
    const m15Bull = emaValue(m15, 20) > emaValue(m15, 50) && getRSIValue(m15) > 50;
    const m5Bull = emaValue(m5, 20) > emaValue(m5, 50) && getRSIValue(m5) > 50;
    const m15Bear = emaValue(m15, 20) < emaValue(m15, 50) && getRSIValue(m15) < 50;
    const m5Bear = emaValue(m5, 20) < emaValue(m5, 50) && getRSIValue(m5) < 50;

    let phase: MarketPhase = 'TRENDING';
    let bias: 'BUY' | 'SELL' = macroDirection;
    let phaseStrength = 50;

    const strongRevBull = reversalBull >= 52;
    const strongRevBear = reversalBear >= 52;

    if (strongRevBull && macroDirection === 'SELL') {
      phase = 'REVERSAL';
      bias = 'BUY';
      phaseStrength = reversalBull;
      notes.push('Reversão bullish vs macro bearish');
    } else if (strongRevBear && macroDirection === 'BUY') {
      phase = 'REVERSAL';
      bias = 'SELL';
      phaseStrength = reversalBear;
      notes.push('Reversão bearish vs macro bullish');
    } else if (candleAnalysis.pattern === 'REVERSAL_BULL' || candleAnalysis.pattern === 'REVERSAL_BEAR') {
      phase = 'REVERSAL';
      bias = candleAnalysis.direction === 'BUY' ? 'BUY' : 'SELL';
      phaseStrength = 62;
      notes.push(`Padrão ${candleAnalysis.pattern}`);
    } else if (structure.bos && candleAnalysis.impulse) {
      phase = 'BREAKOUT';
      bias = structure.trend === 'BULLISH' || structure.direction === 'BUY' ? 'BUY' : 'SELL';
      phaseStrength = 70;
      notes.push('Breakout com impulso');
    } else if (rsi > 76 || rsi < 24) {
      phase = 'EXHAUSTION';
      bias = rsi > 76 ? 'SELL' : 'BUY';
      phaseStrength = 65;
      notes.push('Exaustão RSI');
    } else if (liquidity.score > 58 && !liquidity.sweepDetected && structure.trend === 'RANGE') {
      phase = macroDirection === 'BUY' ? 'ACCUMULATION' : 'DISTRIBUTION';
      bias = macroDirection;
      phaseStrength = 58;
      notes.push(phase === 'ACCUMULATION' ? 'Acumulação' : 'Distribuição');
    } else if (Math.abs(momentum - 50) < 12 && structure.trend === 'RANGE') {
      phase = 'RANGING';
      bias = price > vwap ? 'BUY' : 'SELL';
      phaseStrength = 48;
      notes.push('Mercado lateral');
    } else {
      phase = 'TRENDING';
      bias = macroDirection;
      phaseStrength = clamp(55 + Math.abs(momentum - 50) * 0.5);
      notes.push('Tendência em curso');
    }

    if (phase === 'TRENDING' && m15Bull && m5Bull && macroDirection === 'SELL' && reversalBull >= 40) {
      phase = 'REVERSAL';
      bias = 'BUY';
      phaseStrength = reversalBull;
      notes.push('Transição bullish M15/M5');
    }
    if (phase === 'TRENDING' && m15Bear && m5Bear && macroDirection === 'BUY' && reversalBear > 45) {
      phase = 'REVERSAL';
      bias = 'SELL';
      phaseStrength = reversalBear;
      notes.push('Transição bearish M15/M5');
    }

    const weights = { ...WEIGHT_PRESETS[phase] };
    const macroDampen =
      phase === 'REVERSAL' || phase === 'BREAKOUT'
        ? clamp(0.28 + (100 - phaseStrength) / 220)
        : 1;
    const shortTermBoost = phase === 'REVERSAL' || phase === 'BREAKOUT' ? 1.35 : 1;

    logger.info(
      `Fase ${phase} · bias ${bias} · força ${phaseStrength}% · dampen macro ${macroDampen.toFixed(2)}`,
      'Phase'
    );

    return {
      phase,
      bias,
      phaseStrength,
      weights,
      macroDampen,
      shortTermBoost,
      notes,
    };
  }
}
