import type { Candle } from '../indicators';

export type SignalRefreshPayload = {
  symbol: string;
  timeframe: string;
  reason: string;
  candle?: Candle;
};

type RefreshHandler = (payload: SignalRefreshPayload) => void;

const refreshHandlers = new Set<RefreshHandler>();

export const realtimeEventBus = {
  onSignalRefresh(handler: RefreshHandler): () => void {
    refreshHandlers.add(handler);
    return () => {
      refreshHandlers.delete(handler);
    };
  },

  emitSignalRefresh(payload: SignalRefreshPayload): void {
    refreshHandlers.forEach((h) => {
      try {
        h(payload);
      } catch {
        /* */
      }
    });
  },
};
