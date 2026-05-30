/**
 * Estado global do pipeline realtime.
 */
import { REAL_TICK_STALE_MS } from './realtimeConfig';

export const CONFIDENCE_TTL_MS = 30_000;
export const STALE_THRESHOLD_MS = 20_000;
export const BOOT_GRACE_MS = 45_000;
export const TICK_STALE_MS = 25_000;

export interface RealtimeSnapshot {
  symbol: string;
  timeframe: string;
  streamStale: boolean;
  signalBlocked: boolean;
  streamLive: boolean;
  lastCandleAt: number;
  lastTickAt: number;
  lastRealTickAt: number;
  lastClosedCandleAt: number;
  lastM1At: number;
  lastM5At: number;
  lastMessageAt: number;
  lastRestAt: number;
  confidenceExpired: boolean;
  reconnectCount: number;
  restAlive: boolean;
  restHealthy: boolean;
  wsConnected: boolean;
  bootstrapped: boolean;
  apiOnline: boolean;
}

const state = {
  symbol: '',
  timeframe: '60',
  lastCandleAt: 0,
  lastM1At: 0,
  lastM5At: 0,
  lastMessageAt: 0,
  lastRestAt: 0,
  lastConfidenceAt: 0,
  lastTickAt: 0,
  lastRealTickAt: 0,
  lastClosedCandleAt: 0,
  bootAt: 0,
  streamStale: false,
  signalBlocked: false,
  reconnectCount: 0,
  openWithoutData: false,
  restAlive: false,
  restHealthy: false,
  restFailed: false,
  wsConnected: false,
  bootstrapped: false,
};

export const realtimeState = {
  markBoot(): void {
    state.bootAt = Date.now();
    state.bootstrapped = true;
    state.streamStale = false;
    state.signalBlocked = false;
  },

  reset(symbol: string, timeframe: string): void {
    state.symbol = symbol;
    state.timeframe = timeframe;
    state.streamStale = false;
    state.signalBlocked = false;
    state.openWithoutData = false;
  },

  /** Tick real do websocket (preço ou kline) — base do stale detector. */
  markRealTick(): void {
    const now = Date.now();
    state.lastRealTickAt = now;
    state.lastMessageAt = now;
    state.lastTickAt = now;
    state.streamStale = false;
    state.signalBlocked = false;
    state.openWithoutData = false;
  },

  markMessage(): void {
    this.markRealTick();
  },

  markTick(): void {
    this.markRealTick();
  },

  markWsConnected(): void {
    state.wsConnected = true;
    state.lastMessageAt = Date.now();
    state.streamStale = false;
    state.signalBlocked = false;
  },

  markWsDisconnected(): void {
    state.wsConnected = false;
  },

  markRestAlive(): void {
    const now = Date.now();
    state.restAlive = true;
    state.restFailed = false;
    state.restHealthy = true;
    state.lastRestAt = now;
    state.lastTickAt = now;
    state.lastConfidenceAt = now;
    state.streamStale = false;
    state.signalBlocked = false;
  },

  markRestFailed(): void {
    state.restFailed = true;
    state.restHealthy = false;
  },

  markCandleUpdate(timeframe: string, candleTs: number, closed = false): void {
    const now = Date.now();
    state.lastCandleAt = now;
    state.lastConfidenceAt = now;
    if (closed && candleTs > 0) state.lastClosedCandleAt = candleTs;
    if (timeframe === '1') state.lastM1At = now;
    if (timeframe === '5') state.lastM5At = now;
  },

  markTfHealth(tf: '1' | '5', _candleTs: number): void {
    const now = Date.now();
    if (tf === '1') state.lastM1At = now;
    if (tf === '5') state.lastM5At = now;
    state.lastConfidenceAt = now;
  },

  markReconnect(): void {
    state.reconnectCount += 1;
  },

  setStale(reason: string): void {
    state.streamStale = true;
    state.signalBlocked = true;
    state.openWithoutData = reason.includes('open-no-data');
  },

  clearStale(): void {
    state.streamStale = false;
    state.signalBlocked = false;
    state.openWithoutData = false;
  },

  isInBootGrace(): boolean {
    return state.bootAt > 0 && Date.now() - state.bootAt < BOOT_GRACE_MS;
  },

  isConfidenceExpired(): boolean {
    if (state.lastConfidenceAt <= 0) return false;
    return Date.now() - state.lastConfidenceAt > CONFIDENCE_TTL_MS;
  },

  isRealTickStale(): boolean {
    if (state.lastRealTickAt <= 0) return false;
    return Date.now() - state.lastRealTickAt > REAL_TICK_STALE_MS;
  },

  isDataStale(): boolean {
    if (this.isInBootGrace()) return false;
    return this.isRealTickStale();
  },

  isStale(): boolean {
    if (this.isInBootGrace()) return false;
    if (state.streamStale && state.signalBlocked) return true;
    return this.isRealTickStale();
  },

  isStreamLive(): boolean {
    if (this.isInBootGrace()) return true;
    return this.isMarketLive() && !this.isStale();
  },

  isApiOnline(): boolean {
    if (this.isInBootGrace()) return true;
    return !this.isApiOffline();
  },

  /** OFF somente: tick >25s E WS fechado E REST falhou. */
  isApiOffline(): boolean {
    const now = Date.now();
    const tickStale =
      state.lastTickAt <= 0 || now - state.lastTickAt > TICK_STALE_MS;
    const wsDead = !state.wsConnected;
    const restFailed =
      state.restFailed ||
      !state.restAlive ||
      state.lastRestAt <= 0 ||
      now - state.lastRestAt > 60_000;
    return tickStale && wsDead && restFailed;
  },

  isMarketLive(): boolean {
    if (this.isInBootGrace()) return true;
    if (state.lastTickAt > 0 && Date.now() - state.lastTickAt < TICK_STALE_MS) return true;
    if (state.restAlive && Date.now() - state.lastRestAt < 60_000) return true;
    if (state.wsConnected && state.lastMessageAt > 0) return true;
    if (state.lastCandleAt > 0 && Date.now() - state.lastCandleAt < STALE_THRESHOLD_MS * 3) {
      return true;
    }
    return false;
  },

  canGenerateSignals(): boolean {
    if (this.isInBootGrace()) return true;
    if (!this.isMarketLive()) return false;
    if (this.isStale()) return false;
    return true;
  },

  invalidateConfidence(): void {
    state.lastConfidenceAt = 0;
  },

  snapshot(): RealtimeSnapshot {
    return {
      symbol: state.symbol,
      timeframe: state.timeframe,
      streamStale: state.streamStale,
      signalBlocked: state.signalBlocked,
      streamLive: this.isStreamLive(),
      lastCandleAt: state.lastCandleAt,
      lastTickAt: state.lastTickAt,
      lastRealTickAt: state.lastRealTickAt,
      lastClosedCandleAt: state.lastClosedCandleAt,
      lastM1At: state.lastM1At,
      lastM5At: state.lastM5At,
      lastMessageAt: state.lastMessageAt,
      lastRestAt: state.lastRestAt,
      confidenceExpired: this.isConfidenceExpired(),
      reconnectCount: state.reconnectCount,
      restAlive: state.restAlive,
      restHealthy: state.restHealthy,
      wsConnected: state.wsConnected,
      bootstrapped: state.bootstrapped,
      apiOnline: this.isApiOnline(),
    };
  },
};
