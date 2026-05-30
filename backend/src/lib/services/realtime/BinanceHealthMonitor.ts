import { logger } from '../logger';
import { realtimeState, STALE_THRESHOLD_MS } from './realtimeState';

export interface HealthMetrics {
  latencyMs: number;
  streamDelayMs: number;
  reconnectCount: number;
  stale: boolean;
  heartbeatAgeMs: number;
  m1AgeMs: number;
  m5AgeMs: number;
  status: 'healthy' | 'degraded' | 'reconnecting' | 'stale';
}

export class BinanceHealthMonitor {
  private lastPingAt = 0;
  private lastPongAt = 0;

  recordMessage(): void {
    const now = Date.now();
    if (this.lastPingAt > 0) {
      const latency = now - this.lastPingAt;
      if (latency < 5000) {
        logger.debug(`latency ${latency}ms`, 'Health');
      }
    }
    this.lastPongAt = now;
    realtimeState.markMessage();
  }

  recordReconnect(): void {
    realtimeState.markReconnect();
    logger.warn(`reconnect #${realtimeState.snapshot().reconnectCount}`, 'Reconnect');
  }

  ping(): void {
    this.lastPingAt = Date.now();
  }

  evaluate(): HealthMetrics {
    const snap = realtimeState.snapshot();
    const now = Date.now();
    const heartbeatAgeMs = snap.lastMessageAt > 0 ? now - snap.lastMessageAt : 0;
    const m1AgeMs = snap.lastM1At > 0 ? now - snap.lastM1At : 0;
    const m5AgeMs = snap.lastM5At > 0 ? now - snap.lastM5At : 0;
    const streamDelayMs = snap.lastCandleAt > 0 ? now - snap.lastCandleAt : 0;

    const stale =
      snap.streamStale ||
      (snap.lastCandleAt > 0 && streamDelayMs > STALE_THRESHOLD_MS) ||
      (snap.lastM1At > 0 && m1AgeMs > STALE_THRESHOLD_MS);

    let status: HealthMetrics['status'] = 'healthy';
    if (stale) status = 'stale';
    else if (!snap.wsConnected && snap.restAlive) status = 'degraded';
    else if (snap.reconnectCount > 0 && !snap.wsConnected) status = 'reconnecting';
    else if (streamDelayMs > STALE_THRESHOLD_MS * 0.6 && streamDelayMs > 0) status = 'degraded';

    return {
      latencyMs: this.lastPongAt > this.lastPingAt ? this.lastPongAt - this.lastPingAt : 0,
      streamDelayMs,
      reconnectCount: snap.reconnectCount,
      stale,
      heartbeatAgeMs,
      m1AgeMs,
      m5AgeMs,
      status,
    };
  }

  logStatus(): void {
    const m = this.evaluate();
    logger.info(
      `health=${m.status} delay=${m.streamDelayMs}ms m1=${m.m1AgeMs}ms reconnects=${m.reconnectCount}`,
      'Health'
    );
  }
}
