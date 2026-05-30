import type { SignalTimingMode, SignalType, TradeSignal } from '../../lib/types';

export type MarketRegime =
  | 'TRENDING'
  | 'REVERSAL'
  | 'RANGING'
  | 'EXPANSION'
  | 'ACCUMULATION'
  | 'DISTRIBUTION';

export type InstitutionalDirection = 'BUY' | 'SELL' | 'NEUTRAL';

export interface MarketSnapshot {
  snapshotId: string;
  snapshotTimestamp: number;
  marketSequence: number;
  symbol: string;
  timeframe: string;
  requestedTimeframe: string;
  providerTimeframe: string;
  primaryCandles: import('../../lib/services/indicators').Candle[];
  mtf: {
    m5: import('../../lib/services/indicators').Candle[];
    m15: import('../../lib/services/indicators').Candle[];
    h1: import('../../lib/services/indicators').Candle[];
    h4: import('../../lib/services/indicators').Candle[];
  };
  lastClose: number;
  providerId: string | null;
  candleSource: string;
}

export interface InstitutionalSignalPayload {
  symbol: string;
  timeframe: string;
  timestamp: string;
  snapshotId: string;
  snapshotTimestamp: number;
  marketSequence: number;
  signal: TradeSignal | null;
  direction: InstitutionalDirection;
  confidence: number;
  status: 'OK' | 'NO_DATA' | 'BLOCKED';
  marketPhase: string;
  marketRegime: MarketRegime;
  reasoning: string[];
  indicators: Record<string, number>;
  liquidityState: string;
  volatilityState: string;
  institutionalBias: string;
  mtfConsensus: number;
  timingMode: SignalTimingMode;
  blockReason?: string;
  dataSource: 'institutional-core';
  /** Provider ativo no momento da análise (null = sem rota). */
  providerId?: string | null;
  /** Candles primários usados na análise. */
  candleCount?: number;
}

export interface AnalyzeInstitutionalInput {
  symbol: string;
  balance: number;
  riskPercent: number;
  timeframe?: string;
  livePrice?: number;
  timingMode?: SignalTimingMode;
  streamLive?: boolean;
  analyzeOrigin?: string;
}
