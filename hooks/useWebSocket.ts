import { useEffect, useState, useCallback, useRef } from 'react';
import { candleStreamService, type StreamStatus } from '../services/websocket/candleStreamService';
import { realtimeOrchestrator } from '../services/realtime/bootstrapRealtime';

export function useWebSocket(symbol: string, timeframe = '60') {
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState<StreamStatus>('disconnected');
  const lastTickRef = useRef(0);

  useEffect(() => {
    const sym = String(symbol ?? '').trim().toUpperCase();
    if (!sym || sym.length < 3) return;

    candleStreamService.retain();
    realtimeOrchestrator.start(sym, timeframe);
    if (typeof window !== 'undefined') {
      window.__luxRealtimeInitialized = true;
      window.__luxRealtimeRunning = true;
    }

    const unsubPrice = candleStreamService.onPrice((p) => {
      const now = Date.now();
      if (now - lastTickRef.current < 300) return;
      lastTickRef.current = now;
      setPrice(p);
    });

    const unsubStatus = candleStreamService.onStatus((s) => {
      setStatus(s);
    });

    return () => {
      unsubPrice();
      unsubStatus();
      candleStreamService.release();
      if (typeof window !== 'undefined') {
        window.__luxRealtimeRunning = false;
      }
    };
  }, [symbol, timeframe]);

  const reconnect = useCallback(() => {
    realtimeOrchestrator.start(symbol, timeframe);
    void realtimeOrchestrator.forceRecovery('manual-reconnect');
  }, [symbol, timeframe]);

  const snap = realtimeOrchestrator.getSnapshot();
  const marketLive =
    snap.streamLive ||
    snap.apiOnline ||
    status === 'connected' ||
    status === 'fallback' ||
    realtimeOrchestrator.isMarketLive();

  return { price, status, reconnect, marketLive, apiOnline: snap.apiOnline };
}
