/**
 * Binance kline stream — singleton institucional.
 * wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}
 */
import { Candle } from '../indicators';
import { candleCache } from '../candleCache';
import {
  BINANCE_SYMBOL_MAP,
  binanceKlineInterval,
  binanceStreamSymbol,
} from '../marketData/providers/binanceProvider';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { logger } from '../logger';
import { isValidCandle, isDelayedCandle } from '../realtime/CandleValidator';

export type StreamStatus = 'connected' | 'disconnected' | 'fallback' | 'reconnecting' | 'stale';

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
const BINANCE_REST = 'https://api.binance.com/api/v3';

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
const MAX_RECONNECT_ROUNDS = RECONNECT_DELAYS_MS.length;
const HEARTBEAT_MS = 20_000;
const STALE_MS = 90_000;
const STABLE_RESET_MS = 60_000;
const UPDATE_THROTTLE_MS = 300;
const REST_POLL_MS = 15_000;
const REST_RECOVERY_LIMIT = 120;
const SILENT_WS_RETRY_MS = 60_000;
const RELEASE_GRACE_MS = 500;

type CandleCallback = (candle: Candle, symbol: string, closed: boolean) => void;
type PriceCallback = (price: number, symbol: string) => void;
type StatusCallback = (status: StreamStatus) => void;

function buildStreamUrl(streamSymbol: string, interval: string): string {
  return `${BINANCE_WS_BASE}/${streamSymbol}@kline_${interval}`;
}

function parseKlinePayload(raw: unknown): { candle: Candle; isFinal: boolean } | null {
  const root = raw as { e?: string; k?: Record<string, unknown> };
  const k = root?.k;
  if (!k || typeof k !== 'object') return null;

  const timestamp = Number(k.t);
  const open = parseFloat(String(k.o ?? ''));
  const high = parseFloat(String(k.h ?? ''));
  const low = parseFloat(String(k.l ?? ''));
  const close = parseFloat(String(k.c ?? ''));
  const volume = parseFloat(String(k.v ?? '0'));

  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    high < low ||
    close < 0
  ) {
    return null;
  }

  return {
    candle: { open, high, low, close, volume: Number.isFinite(volume) ? volume : 0, timestamp },
    isFinal: Boolean(k.x),
  };
}

function parseRestKlines(data: unknown): Candle[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const k = row as number[];
      const candle: Candle = {
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
        timestamp: Number(k[0]),
      };
      if (!Number.isFinite(candle.close) || !Number.isFinite(candle.timestamp)) return null;
      return candle;
    })
    .filter((c): c is Candle => c != null);
}

export class BinanceStreamEngine {
  private static instance: BinanceStreamEngine | null = null;

  static getInstance(): BinanceStreamEngine {
    if (!BinanceStreamEngine.instance) {
      BinanceStreamEngine.instance = new BinanceStreamEngine();
    }
    return BinanceStreamEngine.instance;
  }

  private ws: WebSocket | null = null;
  private symbol = '';
  private timeframe = '60';
  private streamSymbol = '';
  private activeKey = '';
  private subscribers = 0;
  private disposed = false;
  private connecting = false;
  private useFallback = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectActive = false;
  private releaseGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private silentRetryTimer: ReturnType<typeof setInterval> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMessageAt = 0;
  private connectedAt = 0;
  private lastEmitAt = 0;
  private lastClosedCandleTs = 0;
  private lastEmittedCandleTs = 0;
  private lastPrice = 0;
  private streamStale = false;
  private antiStaleRunning = false;
  private closing = false;
  private lastAntiStaleAt = 0;
  private static readonly ANTI_STALE_COOLDOWN_MS = 60_000;

  private candleCallbacks: CandleCallback[] = [];
  private priceCallbacks: PriceCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];

  onCandle(cb: CandleCallback) {
    this.candleCallbacks.push(cb);
    return () => {
      this.candleCallbacks = this.candleCallbacks.filter((c) => c !== cb);
    };
  }

  onPrice(cb: PriceCallback) {
    this.priceCallbacks.push(cb);
    return () => {
      this.priceCallbacks = this.priceCallbacks.filter((c) => c !== cb);
    };
  }

  onStatus(cb: StatusCallback) {
    this.statusCallbacks.push(cb);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((c) => c !== cb);
    };
  }

  retain() {
    this.subscribers += 1;
    if (this.releaseGraceTimer) {
      clearTimeout(this.releaseGraceTimer);
      this.releaseGraceTimer = null;
    }
  }

  release() {
    this.subscribers = Math.max(0, this.subscribers - 1);
    if (this.subscribers === 0) {
      if (this.releaseGraceTimer) clearTimeout(this.releaseGraceTimer);
      this.releaseGraceTimer = setTimeout(() => {
        this.releaseGraceTimer = null;
        if (this.subscribers === 0) this.hardDisconnect();
      }, RELEASE_GRACE_MS);
    }
  }

  connect(symbol: string, timeframe: string) {
    const sym = String(symbol ?? '').trim().toUpperCase();
    if (!sym) return;

    const key = `${sym}:${timeframe}`;
    if (this.ws?.readyState === WebSocket.OPEN && this.activeKey === key) return;
    if (this.ws?.readyState === WebSocket.CONNECTING && this.activeKey === key) return;
    if (this.useFallback && this.activeKey === key) return;

    if (this.activeKey && this.activeKey !== key) {
      this.teardownSocketOnly();
      this.reconnectAttempt = 0;
    }

    this.symbol = sym;
    this.timeframe = timeframe;
    this.activeKey = key;
    this.disposed = false;
    const stream = binanceStreamSymbol(sym);
    if (!stream) {
      logger.warn(`Binance stream indisponível para ${sym}`, 'Binance');
      this.startRestFallback();
      return;
    }

    this.streamSymbol = stream;
    this.openWebSocket();
  }

  private openWebSocket() {
    if (this.disposed || this.connecting) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.connecting = true;
    const interval = binanceKlineInterval(this.timeframe);
    const url = buildStreamUrl(this.streamSymbol, interval);
    this.lastMessageAt = Date.now();

    logger.info(`Conectando ${url}`, 'Binance');

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.disposed || this.ws !== ws) {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          return;
        }
        this.connecting = false;
        this.useFallback = false;
        this.stopRestFallback();
        this.stopSilentRetry();
        this.connectedAt = Date.now();
        this.lastMessageAt = Date.now();
        this.scheduleStableReset();
        this.emitStatus('connected');
        this.startHeartbeat();
        logger.info(`Stream ativo ${this.symbol}@${interval}`, 'WS');
      };

      ws.onmessage = (ev) => {
        if (this.ws !== ws) return;
        this.lastMessageAt = Date.now();
        this.handleMessage(ev.data);
      };

      ws.onclose = (ev) => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.connecting = false;
        this.stopHeartbeat();
        if (this.disposed) return;

        logger.warn(`WS close code=${ev.code}`, 'Reconnect');
        this.emitStatus('reconnecting');
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        logger.warn(`WS error ${this.symbol}`, 'Binance');
        if (this.ws === ws && ws.readyState !== WebSocket.CLOSED) {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }
      };
    } catch (e) {
      this.connecting = false;
      logger.error('Falha ao abrir WS', 'Binance', e);
      this.startRestFallback();
    }
  }

  private handleMessage(data: unknown) {
    let parsed: unknown;
    try {
      parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      return;
    }

    const result = parseKlinePayload(parsed);
    if (!result) return;

    const { candle, isFinal } = result;

    if (!isValidCandle(candle)) {
      logger.debug('Candle inválido ignorado', 'Binance');
      return;
    }

    if (isFinal && candle.volume <= 0) {
      return;
    }

    if (isDelayedCandle(candle, this.timeframe)) {
      logger.warn(`Candle atrasado ${this.symbol} ts=${candle.timestamp}`, 'Stale');
      void this.runAntiStaleRecovery('delayed-candle');
      return;
    }

    if (isFinal && candle.timestamp === this.lastClosedCandleTs) return;
    if (!isFinal && candle.timestamp === this.lastEmittedCandleTs && candle.close === this.lastPrice) {
      return;
    }

    this.streamStale = false;
    candleCache.mergeLatest(this.symbol, this.timeframe, candle, 'binance-ws');

    const now = Date.now();
    this.emitPrice(candle.close);

    if (!isFinal) {
      return;
    }

    this.lastClosedCandleTs = candle.timestamp;
    this.lastEmittedCandleTs = candle.timestamp;
    this.lastEmitAt = now;
    this.candleCallbacks.forEach((cb) => cb(candle, this.symbol, true));
    logger.debug(`Candle fechado ${this.symbol}@${this.timeframe}`, 'Realtime');
  }

  private async runAntiStaleRecovery(reason: string) {
    if (this.antiStaleRunning || this.disposed) return;
    const now = Date.now();
    if (now - this.lastAntiStaleAt < BinanceStreamEngine.ANTI_STALE_COOLDOWN_MS) return;
    this.lastAntiStaleAt = now;
    this.antiStaleRunning = true;
    this.streamStale = true;
    this.emitStatus('stale');
    logger.warn(`Anti-stale: ${reason}`, 'Stale');

    try {
      await this.pollRestKlines(REST_RECOVERY_LIMIT, true);
      logger.info(`Recovery REST ${this.symbol}`, 'Recovery');
    } catch (e) {
      logger.warn('Recovery REST falhou', 'Recovery', e);
    } finally {
      this.antiStaleRunning = false;
      if (this.disposed) return;
      if (this.ws?.readyState === WebSocket.OPEN && !this.streamStale) return;
      this.teardownSocketOnly();
      this.reconnectAttempt = 0;
      this.reconnectActive = false;
      this.openWebSocket();
    }
  }

  private emitPrice(price: number) {
    if (!Number.isFinite(price) || price <= 0) return;
    this.lastPrice = price;
    this.priceCallbacks.forEach((cb) => cb(price, this.symbol));
  }

  private emitStatus(status: StreamStatus) {
    this.statusCallbacks.forEach((cb) => cb(status));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed || this.closing) return;

      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (this.useFallback) return;
        return;
      }

      const stale = this.lastMessageAt > 0 && Date.now() - this.lastMessageAt > STALE_MS;
      if (stale) {
        logger.warn(`Heartbeat stale ${this.symbol}`, 'Stale');
        void this.runAntiStaleRecovery('heartbeat-stale');
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleStableReset() {
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      if (this.ws?.readyState === WebSocket.OPEN && !this.disposed) {
        this.reconnectAttempt = 0;
        logger.info('Conexão estável 60s — backoff reset', 'Reconnect');
      }
    }, STABLE_RESET_MS);
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectActive) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const delay =
      RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectActive = true;

    logger.info(`Reconnect em ${delay}ms (tentativa ${this.reconnectAttempt})`, 'Reconnect');

    if (this.reconnectAttempt >= MAX_RECONNECT_ROUNDS) {
      this.reconnectActive = false;
      this.startRestFallback();
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectActive = false;
      if (!this.disposed) this.openWebSocket();
    }, delay);
  }

  private async pollRestKlines(limit = 3, recovery = false) {
    const binanceSym = BINANCE_SYMBOL_MAP[this.symbol];
    if (!binanceSym) return;

    const interval = binanceKlineInterval(this.timeframe);
    const url = `${BINANCE_REST}/klines?symbol=${binanceSym}&interval=${interval}&limit=${limit}`;

    try {
      const res = await fetchWithTimeout(url, undefined, 12_000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const candles = parseRestKlines(data).filter((c) => isValidCandle(c, false));
      if (candles.length === 0) return;

      if (recovery) {
        candleCache.set(this.symbol, this.timeframe, candles, 'binance-recovery');
      }

      const last = candles[candles.length - 1];
      candleCache.mergeLatest(this.symbol, this.timeframe, last, 'binance-rest');
      this.emitPrice(last.close);
      this.streamStale = false;

      const emitClosed = last.timestamp !== this.lastClosedCandleTs;
      this.lastEmittedCandleTs = last.timestamp;
      this.candleCallbacks.forEach((cb) => cb(last, this.symbol, emitClosed));
      if (emitClosed) this.lastClosedCandleTs = last.timestamp;

      logger.info(
        `REST klines ${this.symbol} n=${candles.length} close=${last.close}${recovery ? ' [recovery]' : ''}`,
        recovery ? 'Recovery' : 'Binance'
      );
    } catch (e) {
      logger.warn('REST klines falhou', 'Fallback', e);
    }
  }

  private startRestFallback() {
    if (this.useFallback || this.disposed) return;
    this.useFallback = true;
    this.emitStatus('fallback');
    this.stopRestFallback();

    logger.warn(`Fallback REST ativo ${this.symbol}`, 'Fallback');
    void this.pollRestKlines();

    this.fallbackTimer = setInterval(() => {
      if (this.disposed) return;
      void this.pollRestKlines();
    }, REST_POLL_MS);

    this.startSilentRetry();
  }

  private stopRestFallback() {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private startSilentRetry() {
    this.stopSilentRetry();
    this.silentRetryTimer = setInterval(() => {
      if (this.disposed || !this.useFallback) return;
      if (this.ws?.readyState === WebSocket.OPEN) return;
      logger.info(`Tentativa silenciosa WS ${this.symbol}`, 'Reconnect');
      this.reconnectAttempt = 0;
      this.openWebSocket();
    }, SILENT_WS_RETRY_MS);
  }

  private stopSilentRetry() {
    if (this.silentRetryTimer) {
      clearInterval(this.silentRetryTimer);
      this.silentRetryTimer = null;
    }
  }

  private teardownSocketOnly() {
    this.connecting = false;
    this.closing = true;
    this.stopHeartbeat();
    this.stopRestFallback();
    this.stopSilentRetry();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.reconnectActive = false;

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close(1000, 'switch');
        } catch {
          /* ignore */
        }
      }
    }
    this.closing = false;
    this.useFallback = false;
  }

  private hardDisconnect() {
    this.disposed = true;
    this.teardownSocketOnly();
    this.activeKey = '';
    this.emitStatus('disconnected');
  }

  getLastPrice() {
    return this.lastPrice;
  }

  getStatus(): StreamStatus {
    if (this.streamStale) return 'stale';
    if (this.useFallback) return 'fallback';
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    if (this.connecting || this.reconnectActive) return 'reconnecting';
    return 'disconnected';
  }
}

export const binanceStreamEngine = BinanceStreamEngine.getInstance();
