import { Candle } from '../services/indicators';

export interface LiquidityZone {
  type: 'BUY_SIDE' | 'SELL_SIDE';
  price: number;
  strength: number;
  swept: boolean;
}

export interface LiquidityAnalysis {
  zones: LiquidityZone[];
  sweepDetected: boolean;
  sweepDirection: 'BUY' | 'SELL' | null;
  score: number;
  notes: string[];
}

export class LiquidityEngine {
  static analyze(candles: Candle[]): LiquidityAnalysis {
    const notes: string[] = [];
    const zones: LiquidityZone[] = [];

    if (candles.length < 25) {
      return { zones, sweepDetected: false, sweepDirection: null, score: 40, notes: ['Poucos candles'] };
    }

    const recent = candles.slice(-50);
    const equalHighs = new Map<number, number>();
    const equalLows = new Map<number, number>();

    const round = (p: number) => Math.round(p * 10000) / 10000;

    recent.forEach((c) => {
      const rh = round(c.high);
      const rl = round(c.low);
      equalHighs.set(rh, (equalHighs.get(rh) ?? 0) + 1);
      equalLows.set(rl, (equalLows.get(rl) ?? 0) + 1);
    });

    equalHighs.forEach((count, price) => {
      if (count >= 2) {
        zones.push({ type: 'SELL_SIDE', price, strength: count * 15, swept: false });
      }
    });
    equalLows.forEach((count, price) => {
      if (count >= 2) {
        zones.push({ type: 'BUY_SIDE', price, strength: count * 15, swept: false });
      }
    });

    const last = recent[recent.length - 1];
    const prev = recent[recent.length - 2];
    let sweepDetected = false;
    let sweepDirection: LiquidityAnalysis['sweepDirection'] = null;
    let score = 50;

    const buyLiquidity = zones.filter((z) => z.type === 'BUY_SIDE').sort((a, b) => b.strength - a.strength)[0];
    const sellLiquidity = zones.filter((z) => z.type === 'SELL_SIDE').sort((a, b) => b.strength - a.strength)[0];

    if (buyLiquidity && last.low < buyLiquidity.price && last.close > buyLiquidity.price) {
      sweepDetected = true;
      sweepDirection = 'BUY';
      buyLiquidity.swept = true;
      score += 20;
      notes.push('Sweep de liquidez compradora — possível reversão bullish');
    }

    if (sellLiquidity && last.high > sellLiquidity.price && last.close < sellLiquidity.price) {
      sweepDetected = true;
      sweepDirection = 'SELL';
      sellLiquidity.swept = true;
      score += 20;
      notes.push('Sweep de liquidez vendedora — possível reversão bearish');
    }

    const avgVol = recent.slice(-10).reduce((a, c) => a + c.volume, 0) / 10;
    if (last.volume > avgVol * 1.8) {
      score += 8;
      notes.push('Volume spike — possível absorção institucional');
    }

    if (last.high > prev.high && last.close < prev.close) {
      notes.push('Pavio superior — rejeição de alta');
      score += 5;
    }
    if (last.low < prev.low && last.close > prev.close) {
      notes.push('Pavio inferior — rejeição de baixa');
      score += 5;
    }

    return {
      zones: zones.slice(0, 8),
      sweepDetected,
      sweepDirection,
      score: Math.min(100, score),
      notes,
    };
  }
}
