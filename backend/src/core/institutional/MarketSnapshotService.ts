import { fetchMTFExtended } from '../../lib/services/marketData';
import { getProviderForSymbol, MarketDataError } from '../../lib/services/marketData';
import type { Candle } from '../../lib/services/indicators';
import type { MarketSnapshot } from './types';
import {
  resolveSnapshotPrimaryCandles,
  assertValidSnapshotBar,
} from './snapshotCandles';
const SEQUENCE = new Map<string, number>();

function tfToMs(tf: string): number {
  const map: Record<string, number> = {
    '1': 60_000,
    '5': 300_000,
    '15': 900_000,
    '60': 3_600_000,
    '240': 14_400_000,
  };
  return map[tf] ?? 60_000;
}

function closedBarTimestamp(candles: Candle[], timeframe: string): number {
  if (!candles.length) return 0;
  const last = candles[candles.length - 1];
  let ts = last.timestamp;
  if (ts > 0 && ts < 1_000_000_000_000) ts *= 1000;
  const interval = tfToMs(timeframe);
  return Math.floor(ts / interval) * interval;
}

/**
 * Snapshot determinístico — mesmos candles para todos os clientes na mesma barra.
 */
export class MarketSnapshotService {
  static async build(symbol: string, timeframe: string): Promise<MarketSnapshot> {
    const sym = symbol.toUpperCase();
    const requestedTimeframe = timeframe;
    const providerId = getProviderForSymbol(sym);

    const primary = await resolveSnapshotPrimaryCandles(sym, requestedTimeframe, 120);
    const primaryCandles = primary.candles;

    let mtf: Awaited<ReturnType<typeof fetchMTFExtended>>;
    try {
      mtf = await fetchMTFExtended(sym);
    } catch {
      const m5 = await resolveSnapshotPrimaryCandles(sym, '5', 80);
      mtf = { m1: m5.candles, m5: m5.candles, m15: m5.candles, h1: m5.candles, h4: m5.candles };
    }

    const barTs = closedBarTimestamp(primaryCandles, requestedTimeframe);
    assertValidSnapshotBar(sym, requestedTimeframe, primaryCandles, barTs);

    const snapshotTimeframe = requestedTimeframe;
    const snapshotId = `${sym}_${snapshotTimeframe}_${barTs}`;
    const seqKey = sym;
    const marketSequence = (SEQUENCE.get(seqKey) ?? 0) + 1;
    SEQUENCE.set(seqKey, marketSequence);

    const snapshotTimestamp = barTs || Date.now();
    const candleSource = `${primary.source}:${providerId ?? 'none'}`;

    console.log(
      `[Lux:SnapshotBuild] symbol=${sym} requestedTimeframe=${requestedTimeframe} ` +
        `snapshotTimeframe=${snapshotTimeframe} providerTimeframe=${primary.providerTimeframe} ` +
        `candles=${primaryCandles.length} id=${snapshotId} mtf m5=${mtf.m5.length} h1=${mtf.h1.length}`
    );

    return {
      snapshotId,
      snapshotTimestamp,
      marketSequence,
      symbol: sym,
      timeframe: snapshotTimeframe,
      requestedTimeframe,
      providerTimeframe: primary.providerTimeframe,
      primaryCandles,
      mtf: {
        m5: mtf.m5,
        m15: mtf.m15,
        h1: mtf.h1,
        h4: mtf.h4,
      },
      lastClose: primaryCandles[primaryCandles.length - 1]?.close ?? 0,
      providerId,
      candleSource,
    };
  }
}
