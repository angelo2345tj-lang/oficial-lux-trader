import React, { memo, useEffect } from 'react';
import { Asset } from '../../types';
import { Candle } from '../../services/indicators';
import { LogEntry } from '../../services/logger';
import { useExecution } from '../../context/ExecutionContext';
import { getTradingModeConfig } from '../../config/tradingModes';
import InstitutionalTerminal from './InstitutionalTerminal';

interface Props {
  asset: Asset;
  timeframe: string;
  price: number;
  wsStatus: string;
  provider: string | null;
  candles: Candle[];
  logs: LogEntry[];
  chartSlot: React.ReactNode;
  analyzerSlot: React.ReactNode;
  onSignalForExecution?: (signal: import('../../types').TradeSignal) => void;
}

const DashboardInstitutional: React.FC<Props> = memo(
  ({ asset, timeframe, price, wsStatus, provider, candles, logs, chartSlot, analyzerSlot }) => {
    const {
      mode,
      setMode,
      autoExecute,
      setAutoExecute,
      killSwitch,
      activateKillSwitch,
      executeSignal,
      dailyPnl,
      openPositions,
      engine,
    } = useExecution();

    useEffect(() => {
      const id = setInterval(() => {
        engine.tickPositions({ [asset.symbol]: price });
      }, 2000);
      return () => clearInterval(id);
    }, [engine, asset.symbol, price]);

    return (
      <InstitutionalTerminal
        asset={asset}
        timeframe={timeframe}
        price={price}
        wsStatus={wsStatus}
        provider={provider}
        candles={candles}
        logs={logs}
        signal={null}
        mode={mode}
        onModeChange={setMode}
        autoExecute={autoExecute}
        onAutoExecuteChange={setAutoExecute}
        killSwitch={killSwitch}
        onKillSwitch={activateKillSwitch}
        dailyPnl={dailyPnl}
        openPositions={openPositions}
      >
        {chartSlot}
        {analyzerSlot}
      </InstitutionalTerminal>
    );
  }
);

DashboardInstitutional.displayName = 'DashboardInstitutional';
export default DashboardInstitutional;
export { getTradingModeConfig };
