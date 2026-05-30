import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { TradeSignal } from '../types';
import { TradingMode, ExecutionConfig, BrokerId } from '../types/execution';
import {
  OrderExecutionEngine,
  createDefaultExecutionConfig,
} from '../services/execution/orderExecutionEngine';
import { validateEnvSafe, getEnvWarnings } from '../services/security/envValidation';
import { auditLog } from '../services/security/auditLog';
import type { AuditEntry } from '../types/execution';

interface ExecutionContextValue {
  engine: OrderExecutionEngine;
  config: ExecutionConfig;
  mode: TradingMode;
  setMode: (m: TradingMode) => void;
  setBroker: (b: BrokerId) => void;
  autoExecute: boolean;
  setAutoExecute: (v: boolean) => void;
  killSwitch: boolean;
  activateKillSwitch: () => Promise<void>;
  executeSignal: (signal: TradeSignal, balance: number) => Promise<{ success: boolean; message: string }>;
  dailyPnl: number;
  openPositions: number;
  envWarnings: string[];
  auditEntries: AuditEntry[];
}

const ExecutionContext = createContext<ExecutionContextValue | null>(null);

export function ExecutionProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ExecutionConfig>(() => {
    const base = createDefaultExecutionConfig();
    try {
      const { config: env } = validateEnvSafe();
      return { ...base, enabled: env.executionEnabled };
    } catch (error) {
      console.warn('Env validation skipped:', error);
      return base;
    }
  });
  const [engine] = useState(() => new OrderExecutionEngine(config));
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const envWarnings = useMemo(() => {
    try {
      const { config: env } = validateEnvSafe();
      return getEnvWarnings(env);
    } catch (error) {
      console.warn('Env validation skipped:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    engine.init();
    const unsub = auditLog.subscribe(setAuditEntries);
    return () => {
      unsub();
    };
  }, [engine]);

  const setMode = useCallback(
    (m: TradingMode) => {
      setConfig((c) => ({ ...c, mode: m }));
      engine.updateConfig({ mode: m });
    },
    [engine]
  );

  const setBroker = useCallback(
    (b: BrokerId) => {
      setConfig((c) => ({ ...c, broker: b }));
      engine.setBroker(b);
    },
    [engine]
  );

  const setAutoExecute = useCallback(
    (v: boolean) => {
      setConfig((c) => ({ ...c, autoExecute: v, enabled: v }));
      engine.updateConfig({ autoExecute: v, enabled: v });
    },
    [engine]
  );

  const activateKillSwitch = useCallback(async () => {
    await engine.killSwitch('Manual kill switch');
    setConfig((c) => ({ ...c, riskLimits: { ...c.riskLimits, killSwitch: true } }));
  }, [engine]);

  const executeSignal = useCallback(
    (signal: TradeSignal, balance: number) => engine.executeSignal(signal, balance),
    [engine]
  );

  const value = useMemo(
    () => ({
      engine,
      config,
      mode: config.mode,
      setMode,
      setBroker,
      autoExecute: config.autoExecute,
      setAutoExecute,
      killSwitch: engine.getRiskManager().isKillSwitchActive(),
      activateKillSwitch,
      executeSignal,
      dailyPnl: engine.getRiskManager().getDailyPnL().realizedPnl,
      openPositions: engine.getPositionManager().countOpen(),
      envWarnings,
      auditEntries,
    }),
    [engine, config, setMode, setBroker, setAutoExecute, activateKillSwitch, executeSignal, envWarnings, auditEntries]
  );

  return <ExecutionContext.Provider value={value}>{children}</ExecutionContext.Provider>;
}

export function useExecution() {
  const ctx = useContext(ExecutionContext);
  if (!ctx) throw new Error('useExecution requires ExecutionProvider');
  return ctx;
}
