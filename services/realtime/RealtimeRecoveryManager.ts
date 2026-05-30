import { Candle } from '../indicators';
import { candleCache } from '../candleCache';
import { fetchCandles, getProviderForSymbol } from '../marketData';
import { supportsBinanceWs } from '../marketData/marketRouter';
import { logger } from '../logger';
import { binanceStreamEngine } from '../websocket/BinanceStreamEngine';
import { isValidCandle, isDelayedCandle } from './CandleValidator';
import { realtimeState } from './realtimeState';
import { RECOVERY_COOLDOWN_MS } from './realtimeConfig';

const MAX_RECOVERY_ATTEMPTS = 3;

export class RealtimeRecoveryManager {
  private running = false;
  private lastRecoveryAt = 0;
  private attemptCount = 0;

  async runRecovery(
    symbol: string,
    timeframe: string,
    onRecovered: (last: Candle) => void
  ): Promise<boolean> {
    if (this.running || !symbol) return false;

    if (this.attemptCount >= MAX_RECOVERY_ATTEMPTS) {
      logger.warn('[Lux:Recovery] max attempts reached', 'Recovery');
      return false;
    }

    const now = Date.now();
    if (now - this.lastRecoveryAt < RECOVERY_COOLDOWN_MS) {
      return false;
    }

    const snap = realtimeState.snapshot();
    if (snap.wsConnected && !realtimeState.isRealTickStale()) {
      return false;
    }

    this.running = true;
    this.lastRecoveryAt = now;
    this.attemptCount += 1;
    realtimeState.setStale('recovery');
    logger.warn(`[Lux:Recovery] started (${this.attemptCount}/${MAX_RECOVERY_ATTEMPTS})`, 'Recovery');

    try {
      const last = await this.syncRest(symbol, timeframe, 120);
      if (last) {
        realtimeState.markRealTick();
        realtimeState.markCandleUpdate(timeframe, last.timestamp, true);
        realtimeState.markRestAlive();
        onRecovered(last);
        this.attemptCount = 0;
      }

      if (!snap.wsConnected && supportsBinanceWs(symbol)) {
        binanceStreamEngine.connect(symbol, timeframe);
      }

      realtimeState.clearStale();
      logger.info('[Lux:Recovery] success', 'Recovery');
      return true;
    } catch (e) {
      logger.error('Recovery failed', 'Recovery', e);
      return false;
    } finally {
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  resetAttempts(): void {
    this.attemptCount = 0;
  }

  private async syncRest(symbol: string, timeframe: string, limit: number): Promise<Candle | null> {
    const provider = getProviderForSymbol(symbol) ?? 'auto';
    logger.info(`[Lux:Recovery] fetchCandles ${symbol} via ${provider}`, 'Recovery');

    const candles = await fetchCandles(symbol, timeframe, limit, false);
    if (!candles.length) throw new Error('empty');

    candleCache.set(symbol, timeframe, candles, `recovery-${provider}`);

    const last = candles[candles.length - 1];
    if (!last || !isValidCandle(last)) throw new Error('invalid');
    if (isDelayedCandle(last, timeframe)) throw new Error('delayed');
    return last;
  }
}
