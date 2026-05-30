/**
 * Estado global do pipeline realtime.
 */
export const CONFIDENCE_TTL_MS = 30_000;
export const STALE_THRESHOLD_MS = 20_000;
export const BOOT_GRACE_MS = 45_000;

export interface RealtimeSnapshot {
  symbol: string;
  timeframe: string;
  streamStale: boolean;
  signalBlocked: boolean;
  lastCandleAt: number;
  lastM1At: number;
  lastM5At: number;
  lastMessageAt: number;
  lastRestAt: number;
  confidenceExpired: boolean;
  reconnectCount: number;
  restAlive: boolean;
  wsConnected: boolean;
  bootstrapped: boolean;
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
  bootAt: 0,
  streamStale: false,
  signalBlocked: false,
  reconnectCount: 0,
  openWithoutData: false,
  restAlive: false,
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

  markMessage(): void {
    state.lastMessageAt = Date.now();
    state.openWithoutData = false;
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
    state.lastRestAt = now;
    state.lastConfidenceAt = now;
    state.streamStale = false;
    state.signalBlocked = false;
  },

  markCandleUpdate(timeframe: string, _candleTs: number): void {
    const now = Date.now();
    state.lastCandleAt = now;
    state.lastConfidenceAt = now;
    state.streamStale = false;
    state.signalBlocked = false;
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

  isDataStale(): boolean {
    const now = Date.now();
    if (state.lastCandleAt > 0 && now - state.lastCandleAt > STALE_THRESHOLD_MS) return true;
    if (state.lastM1At > 0 && now - state.lastM1At > STALE_THRESHOLD_MS) return true;
    if (
      state.wsConnected &&
      state.lastMessageAt > 0 &&
      now - state.lastMessageAt > STALE_THRESHOLD_MS
    ) {
      return true;
    }
    return false;
  },

  isStale(): boolean {
    if (state.streamStale && state.signalBlocked) return true;
    if (this.isInBootGrace()) return false;
    return this.isDataStale();
  },

  isMarketLive(): boolean {
    if (this.isInBootGrace()) return true;
    if (state.restAlive && Date.now() - state.lastRestAt < 60_000) return true;
    if (state.wsConnected) return true;
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
      lastCandleAt: state.lastCandleAt,
      lastM1At: state.lastM1At,
      lastM5At: state.lastM5At,
      lastMessageAt: state.lastMessageAt,
      lastRestAt: state.lastRestAt,
      confidenceExpired: this.isConfidenceExpired(),
      reconnectCount: state.reconnectCount,
      restAlive: state.restAlive,
      wsConnected: state.wsConnected,
      bootstrapped: state.bootstrapped,
    };
  },
};
