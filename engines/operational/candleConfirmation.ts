import { Candle } from '../../services/indicators';
import { runAllIndicators, getRSIValue } from '../../services/indicators';
import { getConfirmedCandles, isBarClosed, TIMEFRAME_MS } from './antiRepaint';
import type { SignalTimingMode } from '../../types';

export interface ConfirmationResult {
  confirmed: boolean;
  reason: string;
  candles: Candle[];
  indicatorScore?: number;
}

function mapIndicators(indicators: ReturnType<typeof runAllIndicators>) {
  const map: Record<string, (typeof indicators)[0]> = {};
  indicators.forEach((i) => {
    map[i.name] = i;
  });
  return map;
}

export class CandleConfirmationSystem {
  static validate(
    candles: Candle[],
    timeframe: string,
    timingMode: SignalTimingMode = 'CONFIRMED'
  ): ConfirmationResult {
    if (!candles?.length || candles.length < 20) {
      return { confirmed: false, reason: 'Histórico insuficiente', candles: candles ?? [] };
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
    const stripped = confirmed.map(({ confirmed: _c, barIndex: _b, ...rest }) => rest);

    const indicators = runAllIndicators(stripped);
    const map = mapIndicators(indicators);
    const rsi = getRSIValue(stripped);
    const last3 = stripped.slice(-3);
    const bullish = last3.filter((c) => c.close > c.open).length;
    const bearish = last3.filter((c) => c.close < c.open).length;
    const direction: 'BUY' | 'SELL' | null =
      bullish >= 2 ? 'BUY' : bearish >= 2 ? 'SELL' : null;

    let score = 0;
    const checks: string[] = [];

    if (direction) {
      if (map['RSI']?.signal === direction || (direction === 'BUY' ? rsi < 62 : rsi > 38)) {
        score += 20;
        checks.push('RSI');
      }
      if (map['MACD']?.signal === direction) {
        score += 20;
        checks.push('MACD');
      }
      if (map['EMA']?.signal === direction) {
        score += 15;
        checks.push('EMA');
      }
      if ((map['ADX']?.strength ?? 0) >= 18) {
        score += 10;
        checks.push('ADX');
      }
      if (map['Volume']?.signal === direction || (map['Volume']?.strength ?? 0) >= 20) {
        score += 10;
        checks.push('Volume');
      }
    }

    const minScore = 35;
    const indicatorOk = !direction || score >= minScore;

    if (!indicatorOk) {
      return {
        confirmed: false,
        reason: `Indicadores aguardando alinhamento (${score}/${minScore})`,
        candles: stripped,
        indicatorScore: score,
      };
    }

    if (bullish === 3) {
      return {
        confirmed: true,
        reason: `3 candles bullish · ${checks.join(', ') || 'estrutura'}`,
        candles: stripped,
        indicatorScore: score,
      };
    }
    if (bearish === 3) {
      return {
        confirmed: true,
        reason: `3 candles bearish · ${checks.join(', ') || 'estrutura'}`,
        candles: stripped,
        indicatorScore: score,
      };
    }

    return {
      confirmed: true,
      reason: `Candle fechado · ${checks.join(', ') || 'confirmação neutra'}`,
      candles: stripped,
      indicatorScore: score,
    };
  }
}
