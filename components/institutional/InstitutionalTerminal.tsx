import React, { memo, useEffect, useState, useMemo, useCallback } from 'react';
import { Asset, TradeSignal, SignalType } from '../../types';
import { OrderBookSnapshot, AggressionTick, AssetStrength, TradingMode } from '../../types/execution';
import { fetchOrderBook, fetchAggressionTrades } from '../../services/marketData/orderBook';
import { Candle } from '../../services/indicators';
import { ASSETS } from '../../constants';
import OrderBookDOM from './OrderBookDOM';
import LiquidityHeatmap from './LiquidityHeatmap';
import AggressionFlow from './AggressionFlow';
import StrengthMeter from './StrengthMeter';
import CorrelationMatrix from './CorrelationMatrix';
import ExecutionPanel from './ExecutionPanel';
import MarketTape from '../MarketTape';
import AnalysisLog from '../AnalysisLog';
import { LogEntry } from '../../services/logger';

interface Props {
  asset: Asset;
  timeframe: string;
  price: number;
  wsStatus: string;
  provider: string | null;
  candles: Candle[];
  logs: LogEntry[];
  signal: TradeSignal | null;
  mode: TradingMode;
  onModeChange: (m: TradingMode) => void;
  autoExecute: boolean;
  onAutoExecuteChange: (v: boolean) => void;
  killSwitch: boolean;
  onKillSwitch: () => void;
  dailyPnl: number;
  openPositions: number;
  children?: React.ReactNode;
}

const InstitutionalTerminal: React.FC<Props> = memo(
  ({
    asset,
    price,
    wsStatus,
    provider,
    candles,
    logs,
    mode,
    onModeChange,
    autoExecute,
    onAutoExecuteChange,
    killSwitch,
    onKillSwitch,
    dailyPnl,
    openPositions,
    children,
  }) => {
    const [book, setBook] = useState<OrderBookSnapshot | null>(null);
    const [aggression, setAggression] = useState<AggressionTick[]>([]);

    const refreshMarketMicro = useCallback(async () => {
      const [b, agg] = await Promise.all([
        fetchOrderBook(asset.symbol),
        fetchAggressionTrades(asset.symbol),
      ]);
      setBook(b);
      setAggression(agg);
    }, [asset.symbol]);

    useEffect(() => {
      refreshMarketMicro();
      const id = setInterval(refreshMarketMicro, 3000);
      return () => clearInterval(id);
    }, [refreshMarketMicro]);

    const strength = useMemo((): AssetStrength[] => {
      return ASSETS.slice(0, 8).map((a, i) => ({
        symbol: a.symbol,
        strength: Math.min(95, 40 + Math.round((price * (i + 1)) % 55)),
        change24h: ((i % 3) - 1) * 0.5,
        direction: i % 2 === 0 ? SignalType.BUY : SignalType.SELL,
      }));
    }, [price]);

    const { symbols, matrix } = useMemo(() => {
      const syms = ['BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD'];
      const m = syms.map((_, i) =>
        syms.map((_, j) => (i === j ? 1 : 0.3 + Math.random() * 0.5))
      );
      return { symbols: syms, matrix: m };
    }, [asset.symbol]);

    return (
      <div className="institutional-terminal space-y-4 animate-view-entry">
        <div className="grid grid-cols-12 gap-3 min-h-[320px]">
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-3">
            <ExecutionPanel
              mode={mode}
              onModeChange={onModeChange}
              autoExecute={autoExecute}
              onAutoExecuteChange={onAutoExecuteChange}
              killSwitch={killSwitch}
              onKillSwitch={onKillSwitch}
              dailyPnl={dailyPnl}
              openPositions={openPositions}
            />
            <StrengthMeter assets={strength} />
          </div>

          <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
            {children}
            <div className="grid grid-cols-2 gap-3 h-[200px]">
              <LiquidityHeatmap candles={candles} />
              <AggressionFlow ticks={aggression} />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-3 flex flex-col gap-3">
            <div className="h-[280px]">
              <OrderBookDOM book={book} />
            </div>
            <MarketTape symbol={asset.symbol} price={price} status={wsStatus} provider={provider} />
            <AnalysisLog logs={logs} maxHeight={120} />
          </div>
        </div>

        <CorrelationMatrix symbols={symbols} matrix={matrix} />
      </div>
    );
  }
);

InstitutionalTerminal.displayName = 'InstitutionalTerminal';
export default InstitutionalTerminal;
