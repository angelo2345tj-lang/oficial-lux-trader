/**
 * Orquestrador institucional — único ponto de entrada WS + REST + signal-refresh.
 */
import { Candle } from '../indicators';
import { candleCache } from '../candleCache';
import {
  BINANCE_SYMBOL_MAP,
  binanceKlineInterval,
} from '../marketData/providers/binanceProvider';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { logger } from '../logger';
import { binanceStreamEngine, type StreamStatus } from '../websocket/BinanceStreamEngine';
import { BinanceHealthMonitor } from './BinanceHealthMonitor';
import {
  isValidCandle,
  isDelayedCandle,
  mergeCandlesUnique,
} from './CandleValidator';
import { realtimeState } from './realtimeState';
import { realtimeEventBus } from './realtimeEventBus';

const BINANCE_REST = 'https://api.binance.com/api/v3';
const HEALTH_TICK_MS = 5_000;
const M1M5_POLL_MS = 8_000;
const REST_RETRY_MS = 2_000;
const MAX_REST_RETRIES = 3;

export type RealtimeEvent =
  | { type: 'candle'; candle: Candle; symbol: string; timeframe: string; closed: boolean }
  | { type: 'price'; price: number; symbol: string }
  | { type: 'status'; status: StreamStatus }
  | { type: 'signal-refresh'; symbol: string; timeframe: string; reason: string }
  | { type: 'stale'; reason: string }
  | { type: 'recovered' };

type EventHandler = (ev: RealtimeEvent) => void;

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
        volume: parseFloat(String(k[5] ?? 0)),
        timestamp: Number(k[0]),
      };
      return isValidCandle(candle) ? candle : null;
    })
    .filter((c): c is Candle => c != null);
}

export class InstitutionalRealtimeOrchestrator {
  private static instance: InstitutionalRealtimeOrchestrator | null = null;

  static getInstance(): InstitutionalRealtimeOrchestrator {
    if (!InstitutionalRealtimeOrchestrator.instance) {
      InstitutionalRealtimeOrchestrator.instance = new InstitutionalRealtimeOrchestrator();
    }
    return InstitutionalRealtimeOrchestrator.instance;
  }

  private readonly health = new BinanceHealthMonitor();
  private initialized = false;
  private retainCount = 0;
  private symbol = '';
  private timeframe = '60';
  private engineBound = false;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private m1m5Timer: ReturnType<typeof setInterval> | null = null;
  private recoveryRunning = false;
  private lastRestAt = 0;
  private refreshDebounce: ReturnType<typeof setTimeout> | null = null;

  private handlers = new Set<EventHandler>();

  private constructor() {
    /* bind on initialize */
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    realtimeState.markBoot();
    console.log('[Lux:Realtime] Orchestrator boot');
    logger.info('Orchestrator boot', 'Realtime');
    this.bindEngineOnce();
  }

  /** Alias explícito para start. */
  start(symbol: string, timeframe: string): void {
    void this.initialize();
    this.connect(symbol, timeframe);
  }

  isSignalAllowed(): boolean {
    return realtimeState.canGenerateSignals();
  }

  isMarketLive(): boolean {
    return realtimeState.isMarketLive();
  }

  isRestAlive(): boolean {
    const snap = realtimeState.snapshot();
    return snap.restAlive && Date.now() - snap.lastRestAt < 60_000;
  }

  getHealth() {
    return this.health.evaluate();
  }

  getSnapshot() {
    return realtimeState.snapshot();
  }

  markRestAlive(): void {
    realtimeState.markRestAlive();
    logger.info('REST candles alive', 'Realtime');
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private emit(ev: RealtimeEvent): void {
    this.handlers.forEach((h) => {
      try {
        h(ev);
      } catch {
        /* */
      }
    });
  }

  retain(): void {
    this.retainCount += 1;
    binanceStreamEngine.retain();
  }

  release(): void {
    this.retainCount = Math.max(0, this.retainCount - 1);
    binanceStreamEngine.release();
    if (this.retainCount === 0) {
      this.stopLoops();
    }
  }

  connect(symbol: string, timeframe: string): void {
    void this.initialize();
    const sym = String(symbol ?? '').trim().toUpperCase();
    if (!sym) return;

    this.symbol = sym;
    this.timeframe = timeframe;
    realtimeState.reset(sym, timeframe);
    this.startLoops();

    logger.info(`Orchestrator connect ${sym}@${timeframe}`, 'Realtime');
    binanceStreamEngine.connect(sym, timeframe);

    void this.syncRestWithRetry(timeframe, 60).then(() => {
      this.markRestAlive();
      this.dispatchSignalRefresh('boot-rest', 300);
    }).catch(() => undefined);
  }

  onCandle(cb: (candle: Candle, symbol: string, closed: boolean) => void): () => void {
    return this.onEvent((ev) => {
      if (ev.type === 'candle') cb(ev.candle, ev.symbol, ev.closed);
    });
  }

  onPrice(cb: (price: number, symbol: string) => void): () => void {
    return this.onEvent((ev) => {
      if (ev.type === 'price') cb(ev.price, ev.symbol);
    });
  }

  onStatus(cb: (status: StreamStatus) => void): () => void {
    return this.onEvent((ev) => {
      if (ev.type === 'status') cb(ev.status);
    });
  }

  onSignalRefresh(cb: (reason: string) => void): () => void {
    return this.onEvent((ev) => {
      if (ev.type === 'signal-refresh') cb(ev.reason);
    });
  }

  getLastPrice(): number {
    return binanceStreamEngine.getLastPrice();
  }

  getStatus(): StreamStatus {
    const engine = binanceStreamEngine.getStatus();
    if (engine === 'connected' || engine === 'fallback') return engine;
    if (realtimeState.isMarketLive() && this.isRestAlive()) return 'fallback';
    if (realtimeState.isStale()) return 'stale';
    return engine;
  }

  async forceRecovery(reason: string): Promise<void> {
    await this.runRecovery(reason);
  }

  enterForeground(): void {
    if (!this.symbol) return;
    logger.info('foreground recovery', 'Realtime');
    void this.runRecovery('foreground');
    binanceStreamEngine.connect(this.symbol, this.timeframe);
  }

  enterBackground(): void {
    logger.info('background — socket retained', 'Realtime');
  }

  private bindEngineOnce(): void {
    if (this.engineBound) return;
    this.engineBound = true;

    binanceStreamEngine.onCandle((candle, sym, closed) => {
      this.dispatchCandle(candle, sym, this.timeframe || '60', closed);
    });

    binanceStreamEngine.onPrice((price, sym) => {
      this.health.recordMessage();
      this.emit({ type: 'price', price, symbol: sym });
    });

    binanceStreamEngine.onStatus((status) => {
      if (status === 'reconnecting') {
        this.health.recordReconnect();
        realtimeState.markWsDisconnected();
        logger.info('[Lux:Reconnect] attempt', 'Reconnect');
      }
      if (status === 'connected') {
        realtimeState.markWsConnected();
        realtimeState.clearStale();
        console.log('[Lux:Realtime] Connected');
        logger.info('Connected', 'Realtime');
      }
      if (status === 'fallback') {
        realtimeState.markRestAlive();
      }
      if (status === 'stale') {
        realtimeState.setStale('engine-stale');
      }
      this.emit({ type: 'status', status });
    });
  }

  private dispatchCandle(
    candle: Candle,
    symbol: string,
    timeframe: string,
    closed: boolean
  ): void {
    if (!isValidCandle(candle)) return;

    if (isDelayedCandle(candle, timeframe)) {
      logger.warn(`Candle atrasado ${symbol}@${timeframe}`, 'Stale');
      void this.runRecovery('delayed-candle');
      return;
    }

    this.health.recordMessage();
    realtimeState.markCandleUpdate(timeframe, candle.timestamp);
    candleCache.mergeLatest(symbol, timeframe, candle, 'orchestrator-ws');

    this.emit({ type: 'candle', candle, symbol, timeframe, closed });

    if (closed) {
      console.log('[Lux:Realtime] Candle closed', symbol);
      this.dispatchSignalRefresh('candle-close', 400);
    } else {
      console.log('[Lux:Realtime] Tick vivo', symbol, candle.close);
      this.dispatchSignalRefresh('candle-tick', 2000);
    }
  }

  private dispatchSignalRefresh(reason: string, debounceMs = 0): void {
    if (this.refreshDebounce) clearTimeout(this.refreshDebounce);
    this.refreshDebounce = setTimeout(() => {
      this.refreshDebounce = null;
      const payload = {
        symbol: this.symbol,
        timeframe: this.timeframe,
        reason,
      };
      this.emit({ type: 'signal-refresh', ...payload });
      realtimeEventBus.emitSignalRefresh(payload);
      console.log('[Lux:Signal] refresh dispatch', reason);
      logger.info(`signal refresh: ${reason}`, 'Signal');
    }, debounceMs);
  }

  private startLoops(): void {
    if (this.healthTimer) return;

    this.healthTimer = setInterval(() => {
      this.health.ping();
      const metrics = this.health.evaluate();
      const snap = realtimeState.snapshot();

      if (metrics.stale && !snap.streamStale && !realtimeState.isInBootGrace()) {
        realtimeState.setStale('health-stale');
        this.emit({ type: 'stale', reason: 'health-stale' });
        logger.warn('[Lux:Stale] detected', 'Stale');
        void this.runRecovery('health-stale');
      } else if (!metrics.stale && snap.streamStale) {
        realtimeState.clearStale();
        this.emit({ type: 'recovered' });
        logger.info('[Lux:Health] healthy', 'Health');
      }

      if (metrics.status === 'degraded' || metrics.status === 'reconnecting') {
        this.health.logStatus();
      }
    }, HEALTH_TICK_MS);

    this.m1m5Timer = setInterval(() => {
      if (!this.symbol) return;
      void this.pollTfHealth('1');
      void this.pollTfHealth('5');
    }, M1M5_POLL_MS);
  }

  private stopLoops(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.m1m5Timer) {
      clearInterval(this.m1m5Timer);
      this.m1m5Timer = null;
    }
  }

  private async pollTfHealth(tf: '1' | '5'): Promise<void> {
    const binanceSym = BINANCE_SYMBOL_MAP[this.symbol];
    if (!binanceSym) return;

    const now = Date.now();
    if (now - this.lastRestAt < 1200) return;
    this.lastRestAt = now;

    const interval = binanceKlineInterval(tf);
    const url = `${BINANCE_REST}/klines?symbol=${binanceSym}&interval=${interval}&limit=3`;

    try {
      const res = await fetchWithTimeout(url, undefined, 10_000);
      if (!res.ok) return;
      const candles = parseRestKlines(await res.json());
      const last = candles[candles.length - 1];
      if (!last || !isValidCandle(last)) return;
      if (isDelayedCandle(last, tf)) return;

      realtimeState.markTfHealth(tf, last.timestamp);
      candleCache.mergeLatest(this.symbol, tf, last, 'orchestrator-m1m5');
    } catch {
      /* */
    }
  }

  private async runRecovery(reason: string): Promise<void> {
    if (this.recoveryRunning || !this.symbol) return;
    this.recoveryRunning = true;
    logger.warn(`[Lux:Recovery] syncing candles (${reason})`, 'Recovery');

    try {
      await this.syncRestWithRetry(this.timeframe, 120);
      await this.pollTfHealth('1');
      await this.pollTfHealth('5');

      this.teardownAndReconnect();

      realtimeState.clearStale();
      this.markRestAlive();
      this.emit({ type: 'recovered' });
      this.dispatchSignalRefresh('recovery', 500);
      logger.info(`[Lux:Reconnect] success`, 'Reconnect');
    } catch (e) {
      logger.error('Recovery falhou', 'Recovery', e);
    } finally {
      this.recoveryRunning = false;
    }
  }

  private teardownAndReconnect(): void {
    binanceStreamEngine.connect(this.symbol, this.timeframe);
  }

  private async syncRestWithRetry(timeframe: string, limit: number): Promise<void> {
    const binanceSym = BINANCE_SYMBOL_MAP[this.symbol];
    if (!binanceSym) throw new Error('symbol not mapped');

    const interval = binanceKlineInterval(timeframe);
    const url = `${BINANCE_REST}/klines?symbol=${binanceSym}&interval=${interval}&limit=${limit}`;

    let lastErr: unknown;
    for (let i = 0; i < MAX_REST_RETRIES; i++) {
      try {
        const res = await fetchWithTimeout(url, undefined, 12_000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const candles = parseRestKlines(await res.json());
        if (candles.length === 0) throw new Error('empty klines');

        const existing = candleCache.get(this.symbol, timeframe) ?? [];
        const merged = mergeCandlesUnique(existing, candles);
        candleCache.set(this.symbol, timeframe, merged, 'orchestrator-recovery');

        const last = merged[merged.length - 1];
        realtimeState.markCandleUpdate(timeframe, last.timestamp);
        this.emit({
          type: 'candle',
          candle: last,
          symbol: this.symbol,
          timeframe,
          closed: true,
        });
        this.emit({ type: 'price', price: last.close, symbol: this.symbol });
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, REST_RETRY_MS * (i + 1)));
      }
    }
    throw lastErr;
  }
}

export const realtimeOrchestrator = InstitutionalRealtimeOrchestrator.getInstance();
