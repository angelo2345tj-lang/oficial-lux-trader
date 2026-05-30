import { Candle } from '../services/indicators';

export interface StructurePoint {
  type: 'HH' | 'HL' | 'LH' | 'LL';
  price: number;
  index: number;
}

export interface StructureAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'RANGE';
  bos: boolean;
  choch: boolean;
  lastBreak: 'BOS' | 'CHOCH' | null;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  swingHighs: number[];
  swingLows: number[];
  score: number;
  notes: string[];
}

function findSwings(candles: Candle[], lookback = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) highs.push(c.high);
    if (isLow) lows.push(c.low);
  }
  return { highs, lows };
}

export class MarketStructureEngine {
  static analyze(candles: Candle[]): StructureAnalysis {
    const notes: string[] = [];
    if (candles.length < 30) {
      return {
        trend: 'RANGE',
        bos: false,
        choch: false,
        lastBreak: null,
        direction: 'NEUTRAL',
        swingHighs: [],
        swingLows: [],
        score: 40,
        notes: ['Dados insuficientes para estrutura'],
      };
    }

    const { highs, lows } = findSwings(candles);
    const recent = candles.slice(-20);
    const price = recent[recent.length - 1].close;

    let trend: StructureAnalysis['trend'] = 'RANGE';
    let direction: StructureAnalysis['direction'] = 'NEUTRAL';
    let score = 50;

    if (highs.length >= 2 && lows.length >= 2) {
      const hh = highs[highs.length - 1] > highs[highs.length - 2];
      const hl = lows[lows.length - 1] > lows[lows.length - 2];
      const lh = highs[highs.length - 1] < highs[highs.length - 2];
      const ll = lows[lows.length - 1] < lows[lows.length - 2];

      if (hh && hl) {
        trend = 'BULLISH';
        direction = 'BUY';
        score += 18;
        notes.push('Estrutura bullish: HH + HL');
      } else if (lh && ll) {
        trend = 'BEARISH';
        direction = 'SELL';
        score += 18;
        notes.push('Estrutura bearish: LH + LL');
      }
    }

    const lastHigh = Math.max(...recent.map((c) => c.high));
    const lastLow = Math.min(...recent.map((c) => c.low));
    const prevHigh = Math.max(...candles.slice(-40, -20).map((c) => c.high));
    const prevLow = Math.min(...candles.slice(-40, -20).map((c) => c.low));

    let bos = false;
    let choch = false;
    let lastBreak: StructureAnalysis['lastBreak'] = null;

    if (price > prevHigh && trend === 'BULLISH') {
      bos = true;
      lastBreak = 'BOS';
      score += 12;
      notes.push('BOS bullish — rompimento de topo');
    } else if (price < prevLow && trend === 'BEARISH') {
      bos = true;
      lastBreak = 'BOS';
      score += 12;
      notes.push('BOS bearish — rompimento de fundo');
    } else if (price > prevHigh && trend === 'BEARISH') {
      choch = true;
      lastBreak = 'CHOCH';
      direction = 'BUY';
      score += 10;
      notes.push('CHOCH — possível reversão para alta');
    } else if (price < prevLow && trend === 'BULLISH') {
      choch = true;
      lastBreak = 'CHOCH';
      direction = 'SELL';
      score += 10;
      notes.push('CHOCH — possível reversão para baixa');
    }

    if (price > lastHigh * 0.999) notes.push('Preço testando topo recente');
    if (price < lastLow * 1.001) notes.push('Preço testando fundo recente');

    return {
      trend,
      bos,
      choch,
      lastBreak,
      direction,
      swingHighs: highs.slice(-5),
      swingLows: lows.slice(-5),
      score: Math.min(100, score),
      notes,
    };
  }
}
