export type SignalTimingModeDto = 'CONFIRMED' | 'INSTANT';

export class AnalyzeSignalDto {
  symbol?: string;
  asset?: string;
  timeframe?: string;
  balance?: number;
  riskPercent?: number;
  livePrice?: number;
  timingMode?: SignalTimingModeDto;
  /** Legado */
  banca?: number;
  streamLive?: boolean;
  analyzeOrigin?: string;
}
