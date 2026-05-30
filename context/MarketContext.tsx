import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Asset } from '../types';
import { candleStreamService, StreamStatus } from '../services/websocket/candleStreamService';
import { realtimeOrchestrator } from '../services/realtime/bootstrapRealtime';
import { Candle } from '../services/indicators';
import { fetchCandles, getProviderForSymbol, MarketDataError } from '../services/marketData';
import { logger } from '../services/logger';
import { isValidCandle } from '../services/realtime/CandleValidator';

interface MarketContextValue {
  symbol: string;
  timeframe: string;
  asset: Asset | null;
  price: number;
  status: StreamStatus;
  candles: Candle[];
  provider: string | null;
  dataError: string | null;
  marketLive: boolean;
  setAsset: (asset: Asset) => void;
  setTimeframe: (tf: string) => void;
  refreshCandles: () => Promise<void>;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({
  children,
  initialAsset,
  initialTimeframe = '60',
}: {
  children: React.ReactNode;
  initialAsset: Asset;
  initialTimeframe?: string;
}) {
  const [asset, setAssetState] = useState<Asset>(initialAsset);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState<StreamStatus>('disconnected');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const provider = useMemo(() => getProviderForSymbol(asset.symbol), [asset.symbol]);

  const marketLive = useMemo(() => {
    const prov = provider?.toLowerCase() ?? '';
    const restOk = prov.includes('binance') || realtimeOrchestrator.isRestAlive();
    const wsOk =
      status === 'connected' || status === 'fallback' || realtimeOrchestrator.isMarketLive();
    return restOk || wsOk;
  }, [provider, status]);

  const refreshCandles = useCallback(async () => {
    try {
      setDataError(null);
      const data = await fetchCandles(asset.symbol, timeframe, 120);
      const valid = data.filter((c) => isValidCandle(c));
      if (mountedRef.current) {
        setCandles(valid);
        if (valid.length) setPrice(valid[valid.length - 1].close);
      }
      realtimeOrchestrator.markRestAlive();
    } catch (e) {
      const msg = e instanceof MarketDataError ? e.message : 'Erro ao carregar candles';
      if (mountedRef.current) setDataError(msg);
      logger.error(msg, 'MarketContext', e);
    }
  }, [asset.symbol, timeframe]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshCandles();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshCandles]);

  useEffect(() => {
    realtimeOrchestrator.start(asset.symbol, timeframe);

    let lastPriceTick = 0;
    const unsubPrice = candleStreamService.onPrice((p) => {
      const now = Date.now();
      if (now - lastPriceTick < 300) return;
      lastPriceTick = now;
      if (mountedRef.current) setPrice(p);
    });

    const unsubStatus = candleStreamService.onStatus((s) => {
      if (mountedRef.current) setStatus(s);
    });

    let lastRefreshAt = 0;
    const unsubCandle = candleStreamService.onCandle((candle, _sym, closed) => {
      if (!isValidCandle(candle) || !mountedRef.current) return;
      setPrice(candle.close);
      setCandles((prev) => {
        if (prev.length === 0) return [candle];
        const last = prev[prev.length - 1];
        if (last.timestamp === candle.timestamp) {
          return [...prev.slice(0, -1), candle];
        }
        if (candle.timestamp > last.timestamp) {
          return [...prev.slice(-199), candle];
        }
        return prev;
      });
      if (closed) {
        const now = Date.now();
        if (now - lastRefreshAt > 5000) {
          lastRefreshAt = now;
          void refreshCandles();
        }
      }
    });

    candleStreamService.retain();

    return () => {
      unsubPrice();
      unsubStatus();
      unsubCandle();
      candleStreamService.release();
    };
  }, [asset.symbol, timeframe, refreshCandles]);

  const setAsset = useCallback((a: Asset) => {
    setAssetState(a);
    setDataError(null);
  }, []);

  const value = useMemo(
    () => ({
      symbol: asset.symbol,
      timeframe,
      asset,
      price,
      status,
      candles,
      provider,
      dataError,
      marketLive,
      setAsset,
      setTimeframe,
      refreshCandles,
    }),
    [asset, timeframe, price, status, candles, provider, dataError, marketLive, setAsset, refreshCandles]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}
