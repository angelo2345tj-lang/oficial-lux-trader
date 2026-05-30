/**
 * Fachada única — TODO tráfego WS passa pelo InstitutionalRealtimeOrchestrator.
 */
import { realtimeOrchestrator } from '../realtime/InstitutionalRealtimeOrchestrator';
import type { StreamStatus } from './BinanceStreamEngine';

export type { StreamStatus };

export const candleStreamService = {
  onCandle: (cb: Parameters<typeof realtimeOrchestrator.onCandle>[0]) =>
    realtimeOrchestrator.onCandle(cb),
  onPrice: (cb: Parameters<typeof realtimeOrchestrator.onPrice>[0]) =>
    realtimeOrchestrator.onPrice(cb),
  onStatus: (cb: Parameters<typeof realtimeOrchestrator.onStatus>[0]) =>
    realtimeOrchestrator.onStatus(cb),
  onSignalRefresh: (cb: (reason: string) => void) => realtimeOrchestrator.onSignalRefresh(cb),
  connect: (symbol: string, timeframe: string) => realtimeOrchestrator.connect(symbol, timeframe),
  retain: () => realtimeOrchestrator.retain(),
  release: () => realtimeOrchestrator.release(),
  disconnect: () => {
    /* use release() no lifecycle React */
  },
  getLastPrice: () => realtimeOrchestrator.getLastPrice(),
  getStatus: () => realtimeOrchestrator.getStatus(),
  isSignalAllowed: () => realtimeOrchestrator.isSignalAllowed(),
  forceRecovery: (reason: string) => realtimeOrchestrator.forceRecovery(reason),
};

export const wsService = {
  onPrice: (cb: Parameters<typeof realtimeOrchestrator.onPrice>[0]) =>
    realtimeOrchestrator.onPrice(cb),
  onStatus: (cb: (s: 'connected' | 'disconnected' | 'fallback') => void) =>
    realtimeOrchestrator.onStatus((s) =>
      cb(s === 'reconnecting' || s === 'stale' ? 'disconnected' : s)
    ),
  connect: (symbol: string) => realtimeOrchestrator.connect(symbol, '60'),
  connectWithTimeframe: (symbol: string, tf: string) => realtimeOrchestrator.connect(symbol, tf),
  disconnect: () => undefined,
  getLastPrice: () => realtimeOrchestrator.getLastPrice(),
  getStatus: () => {
    const s = realtimeOrchestrator.getStatus();
    return s === 'reconnecting' || s === 'stale' ? 'disconnected' : s;
  },
};
