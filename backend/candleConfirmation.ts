import { Candle } from '../../services/indicators';
import { getConfirmedCandles, isBarClosed, TIMEFRAME_MS } from './antiRepaint';
import type { SignalTimingMode } from '../../types';

export interface ConfirmationResult {
  confirmed: boolean;
  reason: string;
  candles: Candle[];
}

export class CandleConfirmationSystem {
  static validate(
    candles: Candle[],
    timeframe: string,
    timingMode: SignalTimingMode = 'CONFIRMED'
  ): ConfirmationResult {
    if (candles.length < 20) {
      return { confirmed: false, reason: 'Histórico insuficiente', candles };
    }

    if (timingMode === 'INSTANT') {
      return {
        confirmed: true,
        reason: 'Modo instantâneo — intra-candle',
        candles: candles.map((c) => {
          const { confirmed: _c, barIndex: _b, ...rest } = c as Candle & {
            confirmed?: boolean;
            barIndex?: number;
          };
          return rest as Candle;
        }),
      };
    }

    const tfMs = TIMEFRAME_MS[timeframe] ?? 60_000;
    const last = candles[candles.length - 1];
    const closed = isBarClosed(last.timestamp, tfMs);

    if (!closed) {
      return {
        confirmed: false,
        reason: 'Aguardando fechamento do candle (modo confirmado)',
        candles: getConfirmedCandles(candles).map(({ confirmed: _c, barIndex: _b, ...rest }) => rest),
      };
    }

    const confirmed = getConfirmedCandles(candles, false);
    const last3 = confirmed.slice(-3);
    const bullish = last3.filter((c) => c.close > c.open).length;
    const bearish = last3.filter((c) => c.close < c.open).length;

    if (bullish === 3) {
      return {
        confirmed: true,
        reason: '3 candles bullish confirmados',
        candles: confirmed.map(({ confirmed: _c, barIndex: _b, ...rest }) => rest),
      };
    }
    if (bearish === 3) {
      return {
        confirmed: true,
        reason: '3 candles bearish confirmados',
        candles: confirmed.map(({ confirmed: _c, barIndex: _b, ...rest }) => rest),
      };
    }

    return {
      confirmed: true,
      reason: 'Candle fechado — confirmação neutra',
      candles: confirmed.map(({ confirmed: _c, barIndex: _b, ...rest }) => rest),
    };
  }
}
