import { TradingMode } from '../types/execution';

export interface ModeConfig {
  label: string;
  minScore: number;
  scanIntervalMs: number;
  useLimitOrders: boolean;
  trailingPercent: number;
  breakEvenAtR: number;
  maxHoldMinutes: number;
  description: string;
}

export const TRADING_MODES: Record<TradingMode, ModeConfig> = {
  SCALPER: {
    label: 'SCALPER',
    minScore: 68,
    scanIntervalMs: 5000,
    useLimitOrders: false,
    trailingPercent: 0.25,
    breakEvenAtR: 0.8,
    maxHoldMinutes: 30,
    description: 'Entradas rápidas, TF baixo, alta frequência controlada',
  },
  SWING: {
    label: 'SWING',
    minScore: 72,
    scanIntervalMs: 60000,
    useLimitOrders: true,
    trailingPercent: 1.0,
    breakEvenAtR: 1.5,
    maxHoldMinutes: 4320,
    description: 'Operações de médio prazo com confirmação forte',
  },
  SNIPER: {
    label: 'SNIPER',
    minScore: 85,
    scanIntervalMs: 30000,
    useLimitOrders: true,
    trailingPercent: 0.4,
    breakEvenAtR: 1.0,
    maxHoldMinutes: 240,
    description: 'Apenas setups elite — precisão máxima',
  },
  HFT: {
    label: 'HIGH FREQUENCY',
    minScore: 65,
    scanIntervalMs: 2000,
    useLimitOrders: false,
    trailingPercent: 0.15,
    breakEvenAtR: 0.5,
    maxHoldMinutes: 5,
    description: 'Alta frequência — requer broker de baixa latência',
  },
  SMART_MONEY: {
    label: 'SMART MONEY',
    minScore: 70,
    scanIntervalMs: 15000,
    useLimitOrders: false,
    trailingPercent: 0.5,
    breakEvenAtR: 1.0,
    maxHoldMinutes: 480,
    description: 'SMC, liquidez, estrutura institucional',
  },
};

export function getTradingModeConfig(mode: TradingMode): ModeConfig {
  return TRADING_MODES[mode];
}
