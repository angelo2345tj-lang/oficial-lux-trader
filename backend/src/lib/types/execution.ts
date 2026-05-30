import { SignalType } from '../types';

export type BrokerId = 'binance_futures' | 'bybit' | 'mt5' | 'pocket_option';
export type TradingMode = 'SCALPER' | 'SWING' | 'SNIPER' | 'HFT' | 'SMART_MONEY';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED' | 'CLOSED';
export type PositionStatus = 'OPEN' | 'CLOSED' | 'BREAKEVEN' | 'TRAILING';

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice?: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2?: number;
  takeProfit3?: number;
  leverage?: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  broker: BrokerId;
  message: string;
  executedPrice?: number;
  executedQty?: number;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
  unrealizedPnl: number;
  status: PositionStatus;
  broker: BrokerId;
  openedAt: number;
  trailingStop?: number;
  breakEvenApplied: boolean;
  mode: TradingMode;
}

export interface RiskLimits {
  maxDailyLoss: number;
  maxDailyProfit: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  riskPercentPerTrade: number;
  killSwitch: boolean;
}

export interface DailyPnL {
  date: string;
  realizedPnl: number;
  unrealizedPnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
}

export interface ExecutionConfig {
  enabled: boolean;
  broker: BrokerId;
  mode: TradingMode;
  autoExecute: boolean;
  trailingStopPercent: number;
  breakEvenAtR: number;
  riskLimits: RiskLimits;
}

export interface AuditEntry {
  id: string;
  action: string;
  broker?: BrokerId;
  symbol?: string;
  details: string;
  timestamp: number;
  success: boolean;
}

export interface BookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: BookLevel[];
  asks: BookLevel[];
  spread: number;
  midPrice: number;
  timestamp: number;
}

export interface AggressionTick {
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  timestamp: number;
}

export interface AssetStrength {
  symbol: string;
  strength: number;
  change24h: number;
  direction: SignalType;
}
