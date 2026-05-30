import { Preferences } from '@capacitor/preferences';
import { Candle } from '../indicators';
import { TradeSignal } from '../../types';
import { mobileLog } from './mobileLogger';
import { isNativeApp } from './platform';

const KEYS = {
  candles: 'lux_offline_candles',
  signal: 'lux_offline_signal',
  score: 'lux_offline_score',
  dashboard: 'lux_offline_dashboard',
  updatedAt: 'lux_offline_updated_at',
} as const;

export interface OfflineDashboardSnapshot {
  symbol?: string;
  timeframe?: string;
  price?: number;
  status?: string;
}

async function setJson(key: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value);
  if (isNativeApp()) {
    await Preferences.set({ key, value: payload });
  } else {
    try {
      localStorage.setItem(key, payload);
    } catch {
      /* quota */
    }
  }
}

async function getJson<T>(key: string): Promise<T | null> {
  try {
    let raw: string | null = null;
    if (isNativeApp()) {
      const { value } = await Preferences.get({ key });
      raw = value;
    } else {
      raw = localStorage.getItem(key);
    }
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const offlineCache = {
  async saveCandles(symbol: string, timeframe: string, candles: Candle[]): Promise<void> {
    const slice = candles.slice(-120);
    await setJson(KEYS.candles, { symbol, timeframe, candles: slice, at: Date.now() });
  },

  async loadCandles(
    symbol: string,
    timeframe: string
  ): Promise<Candle[] | null> {
    const data = await getJson<{ symbol: string; timeframe: string; candles: Candle[] }>(
      KEYS.candles
    );
    if (!data || data.symbol !== symbol || data.timeframe !== timeframe) return null;
    return data.candles;
  },

  async saveSignal(signal: TradeSignal): Promise<void> {
    await setJson(KEYS.signal, signal);
    await setJson(KEYS.score, {
      score: signal.score,
      winProbability: signal.winProbability,
      at: Date.now(),
    });
    mobileLog.debug('Signal cached offline', 'PWA');
  },

  async loadSignal(): Promise<TradeSignal | null> {
    return getJson<TradeSignal>(KEYS.signal);
  },

  async clearSignal(): Promise<void> {
    if (isNativeApp()) {
      await Preferences.remove({ key: KEYS.signal });
      await Preferences.remove({ key: KEYS.score });
    } else {
      try {
        localStorage.removeItem(KEYS.signal);
        localStorage.removeItem(KEYS.score);
      } catch {
        /* */
      }
    }
  },

  async loadScore(): Promise<{ score: number; winProbability?: number; at: number } | null> {
    return getJson(KEYS.score);
  },

  async saveDashboard(snapshot: OfflineDashboardSnapshot): Promise<void> {
    await setJson(KEYS.dashboard, { ...snapshot, at: Date.now() });
    await setJson(KEYS.updatedAt, Date.now());
  },

  async loadDashboard(): Promise<OfflineDashboardSnapshot | null> {
    return getJson(KEYS.dashboard);
  },

  async hydrateOnStartup(): Promise<{
    signal: TradeSignal | null;
    candles: Candle[] | null;
    dashboard: OfflineDashboardSnapshot | null;
  }> {
    const [signal, dashboard] = await Promise.all([
      this.loadSignal(),
      this.loadDashboard(),
    ]);
    let candles: Candle[] | null = null;
    if (dashboard?.symbol && dashboard?.timeframe) {
      candles = await this.loadCandles(dashboard.symbol, dashboard.timeframe);
    }
    if (signal || candles) {
      mobileLog.info('Offline cache hydrated', 'Mobile', {
        hasSignal: Boolean(signal),
        candleCount: candles?.length ?? 0,
      });
    }
    return { signal, candles, dashboard };
  },
};
