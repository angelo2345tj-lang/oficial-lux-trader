import { TradeSignal, SignalType } from '../../types';
import { Candle } from '../../services/indicators';

export interface InvalidationResult {
  valid: boolean;
  reason: string;
}

export class SignalInvalidationEngine {
  static check(signal: TradeSignal, candles: Candle[], livePrice: number): InvalidationResult {
    if (candles.length < 5) return { valid: true, reason: 'OK' };

    const last = candles[candles.length - 1];

    if (signal.type === SignalType.BUY) {
      if (livePrice < signal.sl) {
        return { valid: false, reason: 'Stop loss atingido — sinal invalidado' };
      }
      if (livePrice > signal.tp3) {
        return { valid: false, reason: 'TP3 atingido — sinal concluído' };
      }
      if (last.close < signal.entry * 0.998 && livePrice < signal.entry) {
        return { valid: false, reason: 'Preço rompeu entrada — invalidação estrutural' };
      }
    } else if (signal.type === SignalType.SELL) {
      if (livePrice > signal.sl) {
        return { valid: false, reason: 'Stop loss atingido — sinal invalidado' };
      }
      if (livePrice < signal.tp3) {
        return { valid: false, reason: 'TP3 atingido — sinal concluído' };
      }
      if (last.close > signal.entry * 1.002 && livePrice > signal.entry) {
        return { valid: false, reason: 'Preço rompeu entrada — invalidação estrutural' };
      }
    }

    return { valid: true, reason: 'Sinal válido' };
  }
}
