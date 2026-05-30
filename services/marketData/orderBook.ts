import { OrderBookSnapshot, BookLevel } from '../../types/execution';
import { BINANCE_SYMBOL_MAP } from './providers/binanceProvider';

export async function fetchOrderBook(symbol: string, limit = 20): Promise<OrderBookSnapshot | null> {
  const binanceSym = BINANCE_SYMBOL_MAP[symbol];
  if (!binanceSym) return null;

  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${binanceSym}&limit=${limit}`);
    if (!res.ok) return null;
    const json = await res.json();

    let bidTotal = 0;
    let askTotal = 0;

    const bids: BookLevel[] = (json.bids as string[][]).map(([p, s]) => {
      const size = parseFloat(s);
      bidTotal += size;
      return { price: parseFloat(p), size, total: bidTotal };
    });

    const asks: BookLevel[] = (json.asks as string[][]).map(([p, s]) => {
      const size = parseFloat(s);
      askTotal += size;
      return { price: parseFloat(p), size, total: askTotal };
    });

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const mid = (bestBid + bestAsk) / 2;

    return {
      symbol,
      bids,
      asks,
      spread: bestAsk - bestBid,
      midPrice: mid,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function fetchAggressionTrades(symbol: string, limit = 50) {
  const binanceSym = BINANCE_SYMBOL_MAP[symbol];
  if (!binanceSym) return [];

  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/aggTrades?symbol=${binanceSym}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Array<{ p: string; q: string; m: boolean; T: number }>).map((t) => ({
      price: parseFloat(t.p),
      size: parseFloat(t.q),
      side: t.m ? ('SELL' as const) : ('BUY' as const),
      timestamp: t.T,
    }));
  } catch {
    return [];
  }
}
