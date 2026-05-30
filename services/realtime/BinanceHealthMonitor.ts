import { logger } from '../logger';
import { realtimeState } from './realtimeState';
import { REAL_TICK_STALE_MS, LUX_REALTIME_DEBUG } from './realtimeConfig';

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
    if (LUX_REALTIME_DEBUG && this.lastPingAt > 0) {
      const latency = now - this.lastPingAt;
      if (latency < 5000) logger.debug(`latency ${latency}ms`, 'Health');
    }
    this.lastPongAt = now;
    realtimeState.markRealTick();
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
    const realTickAge =
      snap.lastRealTickAt > 0 ? now - snap.lastRealTickAt : snap.lastTickAt > 0 ? now - snap.lastTickAt : 0;
    const heartbeatAgeMs = snap.lastMessageAt > 0 ? now - snap.lastMessageAt : 0;
    const m1AgeMs = snap.lastM1At > 0 ? now - snap.lastM1At : 0;
    const m5AgeMs = snap.lastM5At > 0 ? now - snap.lastM5At : 0;
    const streamDelayMs = realTickAge;

    const stale = snap.lastRealTickAt > 0 && realTickAge > REAL_TICK_STALE_MS;

    let status: HealthMetrics['status'] = 'healthy';
    if (stale) status = 'stale';
    else if (!snap.wsConnected && snap.restAlive) status = 'degraded';
    else if (snap.reconnectCount > 0 && !snap.wsConnected) status = 'reconnecting';

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
    const snap = realtimeState.snapshot();
    if (LUX_REALTIME_DEBUG) {
      console.log('[Lux:Health]', m.status, 'realTickAge', m.streamDelayMs);
    }
    logger.info(
      `health=${m.status} tickAge=${m.streamDelayMs}ms ws=${snap.wsConnected}`,
      'Health'
    );
  }

  isApiOnline(): boolean {
    return realtimeState.isApiOnline();
  }
}
