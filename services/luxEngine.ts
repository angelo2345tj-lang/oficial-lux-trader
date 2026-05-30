import { TradeSignal, SignalTimingMode } from '../types';
import { analyzeSignal, type AnalyzePayload } from './api/signalsApi';
import type { SignalResult } from './strategy/RealSignalEngine';

export type { SignalResult };

/** Facade — delega exclusivamente à API institucional. */
export class LuxEngine {
  private static payload(
    assetSymbol: string,
    banca: number,
    riskPercent: number,
    timeframe: string,
    livePrice?: number,
    timingMode: SignalTimingMode = 'INSTANT',
    analyzeOrigin = 'LUX_ENGINE'
  ): AnalyzePayload {
    return {
      symbol: assetSymbol,
      asset: assetSymbol,
      balance: banca,
      riskPercent,
      timeframe,
      livePrice,
      timingMode,
      analyzeOrigin,
    };
  }

  static async generateSignal(
    assetSymbol: string,
    currentPrice: number,
    banca: number,
    riskPercent: number,
    timeframe = '60'
  ): Promise<TradeSignal | null> {
    const result = await analyzeSignal(
      LuxEngine.payload(assetSymbol, banca, riskPercent, timeframe, currentPrice)
    );
    return result.signal;
  }

  static analyze(
    assetSymbol: string,
    banca: number,
    riskPercent: number,
    timeframe = '60',
    livePrice?: number,
    timingMode: SignalTimingMode = 'INSTANT'
  ): Promise<SignalResult> {
    return analyzeSignal(
      LuxEngine.payload(assetSymbol, banca, riskPercent, timeframe, livePrice, timingMode)
    );
  }
}
