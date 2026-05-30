/**
 * Camada mobile institucional — singleton sobre BinanceStreamEngine.
 * Garante: 1 socket, reconnect sem reset de estado, throttle Android.
 */
import { binanceStreamEngine, type StreamStatus } from './BinanceStreamEngine';
import { Candle } from '../indicators';
import { mobileLog } from '../mobile/mobileLogger';
import { offlineCache } from '../mobile/OfflineCache';
import { notificationEngine } from '../mobile/NotificationEngine';

const MOBILE_THROTTLE_MS = 350;
const RECONNECT_NOTIFY_COOLDOWN_MS = 120_000;

type CandleCb = (candle: Candle, symbol: string, closed: boolean) => void;
type PriceCb = (price: number, symbol: string) => void;
type StatusCb = (status: StreamStatus) => void;

export class MobileInstitutionalSocket {
  private static instance: MobileInstitutionalSocket | null = null;

  static getInstance(): MobileInstitutionalSocket {
    if (!MobileInstitutionalSocket.instance) {
      MobileInstitutionalSocket.instance = new MobileInstitutionalSocket();
    }
    return MobileInstitutionalSocket.instance;
  }

  private retainCount = 0;
  private symbol = '';
  private timeframe = '60';
  private lastPriceEmit = 0;
  private lastStatus: StreamStatus = 'disconnected';
  private lastDisconnectNotify = 0;
  private backgroundMode = false;
  private listenersBound = false;

  private candleHandlers = new Set<CandleCb>();
  private priceHandlers = new Set<PriceCb>();
  private statusHandlers = new Set<StatusCb>();

  private unsubEngine: Array<() => void> = [];

  retain(): void {
    this.retainCount += 1;
    binanceStreamEngine.retain();
    this.ensureEngineListeners();
    mobileLog.debug(`retain count=${this.retainCount}`, 'Socket');
  }

  release(): void {
    this.retainCount = Math.max(0, this.retainCount - 1);
    if (this.retainCount === 0 && !this.backgroundMode) {
      binanceStreamEngine.release();
    }
  }

  connect(symbol: string, timeframe: string): void {
    if (this.symbol === symbol && this.timeframe === timeframe) {
      const status = binanceStreamEngine.getStatus();
      if (status === 'connected' || status === 'fallback' || status === 'reconnecting') {
        return;
      }
    }
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.ensureEngineListeners();
    binanceStreamEngine.connect(symbol, timeframe);
    mobileLog.info(`connect ${symbol}@${timeframe}`, 'Socket');
  }

  onCandle(cb: CandleCb): () => void {
    this.candleHandlers.add(cb);
    return () => this.candleHandlers.delete(cb);
  }

  onPrice(cb: PriceCb): () => void {
    this.priceHandlers.add(cb);
    return () => this.priceHandlers.delete(cb);
  }

  onStatus(cb: StatusCb): () => void {
    this.statusHandlers.add(cb);
    cb(this.lastStatus);
    return () => this.statusHandlers.delete(cb);
  }

  getLastPrice(): number {
    return binanceStreamEngine.getLastPrice();
  }

  getStatus(): StreamStatus {
    return binanceStreamEngine.getStatus();
  }

  /** App em background — não liberar socket. */
  enterBackground(): void {
    this.backgroundMode = true;
    mobileLog.info('background — socket retained', 'Background');
  }

  /** App em foreground — reconectar se necessário sem reset. */
  async enterForeground(): Promise<void> {
    this.backgroundMode = false;
    mobileLog.info('foreground — ensure connection', 'Background');
    if (this.symbol) {
      this.connect(this.symbol, this.timeframe);
    }
    const status = binanceStreamEngine.getStatus();
    if (status === 'disconnected') {
      mobileLog.warn('foreground reconnect', 'Reconnect');
    }
  }

  private ensureEngineListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;

    const u1 = binanceStreamEngine.onCandle((candle, sym, closed) => {
      for (const h of this.candleHandlers) h(candle, sym, closed);
      if (closed && this.symbol) {
        void offlineCache.saveDashboard({
          symbol: this.symbol,
          timeframe: this.timeframe,
          price: candle.close,
          status: this.lastStatus,
        });
      }
    });

    const u2 = binanceStreamEngine.onPrice((price, sym) => {
      const now = Date.now();
      if (now - this.lastPriceEmit < MOBILE_THROTTLE_MS) return;
      this.lastPriceEmit = now;
      for (const h of this.priceHandlers) h(price, sym);
    });

    const u3 = binanceStreamEngine.onStatus((status) => {
      const prev = this.lastStatus;
      this.lastStatus = status;
      for (const h of this.statusHandlers) h(status);

      if (status === 'disconnected' && prev !== 'disconnected') {
        const now = Date.now();
        if (now - this.lastDisconnectNotify > RECONNECT_NOTIFY_COOLDOWN_MS) {
          this.lastDisconnectNotify = now;
          void notificationEngine.notifyWebsocketDisconnected();
        }
      }
      if (status === 'connected' && (prev === 'disconnected' || prev === 'reconnecting')) {
        void notificationEngine.notifyReconnectSuccess();
      }
      if (status === 'reconnecting') {
        mobileLog.info('reconnecting…', 'Reconnect');
      }
    });

    this.unsubEngine = [u1, u2, u3];
  }

  dispose(): void {
    this.unsubEngine.forEach((u) => u());
    this.unsubEngine = [];
    this.listenersBound = false;
    MobileInstitutionalSocket.instance = null;
  }
}

export const mobileInstitutionalSocket = MobileInstitutionalSocket.getInstance();

/** Fachada compatível com candleStreamService para imports mobile. */
export const mobileCandleStream = {
  onCandle: (cb: CandleCb) => mobileInstitutionalSocket.onCandle(cb),
  onPrice: (cb: PriceCb) => mobileInstitutionalSocket.onPrice(cb),
  onStatus: (cb: StatusCb) => mobileInstitutionalSocket.onStatus(cb),
  connect: (s: string, tf: string) => mobileInstitutionalSocket.connect(s, tf),
  retain: () => mobileInstitutionalSocket.retain(),
  release: () => mobileInstitutionalSocket.release(),
  getLastPrice: () => mobileInstitutionalSocket.getLastPrice(),
  getStatus: () => mobileInstitutionalSocket.getStatus(),
};
