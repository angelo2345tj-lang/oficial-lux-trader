import { OrderBookSnapshot } from '../../types/execution';
import { Candle } from '../../services/indicators';

export interface MicrostructureScore {
  score: number;
  imbalance: number;
  spreadBps: number;
  notes: string[];
}

export function analyzeMicrostructure(
  book: OrderBookSnapshot | null,
  candles: Candle[],
  livePrice: number
): MicrostructureScore {
  const notes: string[] = [];
  let score = 50;

  if (book && book.bids.length && book.asks.length) {
    const bidVol = book.bids.reduce((s, l) => s + l.size, 0);
    const askVol = book.asks.reduce((s, l) => s + l.size, 0);
    const total = bidVol + askVol || 1;
    const imbalance = (bidVol - askVol) / total;
    const mid = book.midPrice || livePrice;
    const spreadBps = mid > 0 ? (book.spread / mid) * 10000 : 0;

    if (imbalance > 0.12) {
      score += 12;
      notes.push('Pressão compradora no book');
    } else if (imbalance < -0.12) {
      score += 12;
      notes.push('Pressão vendedora no book');
    }

    if (spreadBps < 3) score += 8;
    else if (spreadBps > 15) score -= 10;

    return {
      score: Math.min(100, Math.max(0, score)),
      imbalance,
      spreadBps,
      notes,
    };
  }

  if (candles.length >= 3) {
    const last = candles[candles.length - 1];
    const body = Math.abs(last.close - last.open);
    const range = last.high - last.low || 0.00001;
    if (body / range > 0.65) {
      score += 10;
      notes.push('Impulso intra-barra');
    }
  }

  return { score, imbalance: 0, spreadBps: 0, notes };
}
