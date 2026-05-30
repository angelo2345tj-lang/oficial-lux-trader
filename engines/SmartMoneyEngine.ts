import { Candle } from '../services/indicators';

export interface OrderBlock {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  mitigated: boolean;
  strength: number;
}

export interface SmartMoneyAnalysis {
  orderBlocks: OrderBlock[];
  smcBias: 'ACUMULAÇÃO' | 'DISTRIBUIÇÃO' | 'NEUTRO';
  inDiscount: boolean;
  inPremium: boolean;
  score: number;
  notes: string[];
}

export class SmartMoneyEngine {
  static analyze(candles: Candle[]): SmartMoneyAnalysis {
    const notes: string[] = [];
    const orderBlocks: OrderBlock[] = [];

    if (candles.length < 30) {
      return {
        orderBlocks,
        smcBias: 'NEUTRO',
        inDiscount: false,
        inPremium: false,
        score: 40,
        notes: ['Dados insuficientes SMC'],
      };
    }

    const range = candles.slice(-40);
    const rangeHigh = Math.max(...range.map((c) => c.high));
    const rangeLow = Math.min(...range.map((c) => c.low));
    const mid = (rangeHigh + rangeLow) / 2;
    const price = candles[candles.length - 1].close;

    const inDiscount = price < mid;
    const inPremium = price > mid;

    for (let i = range.length - 4; i >= 2; i--) {
      const c = range[i];
      const next = range[i + 1];
      const body = Math.abs(c.close - c.open);
      const avgBody =
        range.slice(Math.max(0, i - 5), i).reduce((a, x) => a + Math.abs(x.close - x.open), 0) / 5;

      if (c.close < c.open && body > avgBody * 1.3 && next.close > next.open) {
        orderBlocks.push({
          type: 'BULLISH',
          high: c.high,
          low: c.low,
          mitigated: price < c.low,
          strength: Math.round((body / avgBody) * 30),
        });
        notes.push('Order Block bullish detectado');
      }

      if (c.close > c.open && body > avgBody * 1.3 && next.close < next.open) {
        orderBlocks.push({
          type: 'BEARISH',
          high: c.high,
          low: c.low,
          mitigated: price > c.high,
          strength: Math.round((body / avgBody) * 30),
        });
        notes.push('Order Block bearish detectado');
      }
    }

    let smcBias: SmartMoneyAnalysis['smcBias'] = 'NEUTRO';
    let score = 50;

    const bullishOB = orderBlocks.filter((o) => o.type === 'BULLISH' && !o.mitigated);
    const bearishOB = orderBlocks.filter((o) => o.type === 'BEARISH' && !o.mitigated);

    if (inDiscount && bullishOB.length > 0) {
      smcBias = 'ACUMULAÇÃO';
      score += 22;
      notes.push('Preço em discount + OB bullish — setup SMC compra');
    } else if (inPremium && bearishOB.length > 0) {
      smcBias = 'DISTRIBUIÇÃO';
      score += 22;
      notes.push('Preço em premium + OB bearish — setup SMC venda');
    }

    const impulseUp = candles.slice(-5).filter((c) => c.close > c.open).length >= 4;
    const impulseDown = candles.slice(-5).filter((c) => c.close < c.open).length >= 4;
    if (impulseUp) {
      score += 8;
      notes.push('Impulso forte de alta');
    }
    if (impulseDown) {
      score += 8;
      notes.push('Impulso forte de baixa');
    }

    return {
      orderBlocks: orderBlocks.slice(-4),
      smcBias,
      inDiscount,
      inPremium,
      score: Math.min(100, score),
      notes,
    };
  }
}
