import { Candle } from '../services/indicators';

export type CandlePattern =
  | 'REVERSAL_BULL'
  | 'REVERSAL_BEAR'
  | 'CONTINUATION_BULL'
  | 'CONTINUATION_BEAR'
  | 'FAKEOUT_BULL'
  | 'FAKEOUT_BEAR'
  | 'MANIPULATION'
  | 'IMPULSE'
  | 'NONE';

export interface CandleAnalysis {
  pattern: CandlePattern;
  reversal: boolean;
  continuation: boolean;
  fakeout: boolean;
  manipulation: boolean;
  impulse: boolean;
  volatility: number;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number;
  notes: string[];
}

export class CandleAnalyzer {
  static analyze(candles: Candle[]): CandleAnalysis {
    const notes: string[] = [];
    if (candles.length < 10) {
      return {
        pattern: 'NONE',
        reversal: false,
        continuation: false,
        fakeout: false,
        manipulation: false,
        impulse: false,
        volatility: 0,
        direction: 'NEUTRAL',
        score: 40,
        notes: ['Poucos candles'],
      };
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const slice = candles.slice(-14);

    const ranges = slice.map((c) => c.high - c.low);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const volatility = avgRange > 0 ? ((last.high - last.low) / avgRange) * 100 : 50;

    const body = Math.abs(last.close - last.open);
    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const range = last.high - last.low || 0.00001;

    let pattern: CandlePattern = 'NONE';
    let reversal = false;
    let continuation = false;
    let fakeout = false;
    let manipulation = false;
    let impulse = false;
    let direction: CandleAnalysis['direction'] = 'NEUTRAL';
    let score = 50;

    const bullishEngulf = last.close > last.open && prev.close < prev.open && last.close > prev.open && last.open < prev.close;
    const bearishEngulf = last.close < last.open && prev.close > prev.open && last.close < prev.open && last.open > prev.close;

    if (lowerWick / range > 0.55 && last.close > last.open) {
      pattern = 'REVERSAL_BULL';
      reversal = true;
      direction = 'BUY';
      score += 18;
      notes.push('Pin bar bullish / rejeição de fundo');
    } else if (upperWick / range > 0.55 && last.close < last.open) {
      pattern = 'REVERSAL_BEAR';
      reversal = true;
      direction = 'SELL';
      score += 18;
      notes.push('Pin bar bearish / rejeição de topo');
    }

    if (bullishEngulf) {
      pattern = 'REVERSAL_BULL';
      reversal = true;
      direction = 'BUY';
      score += 22;
      notes.push('Engolfo bullish');
    } else if (bearishEngulf) {
      pattern = 'REVERSAL_BEAR';
      reversal = true;
      direction = 'SELL';
      score += 22;
      notes.push('Engolfo bearish');
    }

    const trendUp = slice.slice(-5).filter((c) => c.close > c.open).length >= 4;
    const trendDown = slice.slice(-5).filter((c) => c.close < c.open).length >= 4;

    if (trendUp && last.close > last.open && body > avgRange * 0.6) {
      continuation = true;
      if (pattern === 'NONE') pattern = 'CONTINUATION_BULL';
      direction = 'BUY';
      score += 14;
      notes.push('Continuação bullish');
    }
    if (trendDown && last.close < last.open && body > avgRange * 0.6) {
      continuation = true;
      if (pattern === 'NONE') pattern = 'CONTINUATION_BEAR';
      direction = 'SELL';
      score += 14;
      notes.push('Continuação bearish');
    }

    if (last.high > prev.high && last.close < prev.close && upperWick > body) {
      fakeout = true;
      pattern = 'FAKEOUT_BEAR';
      direction = 'SELL';
      score += 16;
      notes.push('Fakeout bullish — armadilha de compradores');
    }
    if (last.low < prev.low && last.close > prev.close && lowerWick > body) {
      fakeout = true;
      pattern = 'FAKEOUT_BULL';
      direction = 'BUY';
      score += 16;
      notes.push('Fakeout bearish — armadilha de vendedores');
    }

    if (volatility > 180 && upperWick > body * 2 && lowerWick > body * 2) {
      manipulation = true;
      score -= 10;
      notes.push('Alta volatilidade com pavios — possível manipulação');
    }

    if (body > avgRange * 1.5 && body / range > 0.7) {
      impulse = true;
      score += 12;
      notes.push('Candle de impulso forte');
      if (pattern === 'NONE') pattern = 'IMPULSE';
    }

    return {
      pattern,
      reversal,
      continuation,
      fakeout,
      manipulation,
      impulse,
      volatility: Math.round(volatility),
      direction,
      score: Math.min(100, Math.max(0, score)),
      notes,
    };
  }
}
