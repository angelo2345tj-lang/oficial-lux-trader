import { Injectable, Logger } from '@nestjs/common';
import { InstitutionalSignalEngine } from '../core/institutional';
import { getLatestForSymbol } from '../core/institutional/InstitutionalSignalCache';
import { MarketDataError } from '../lib/services/marketData';
import type { SignalTimingMode } from '../lib/types';
import { normalizeSymbol } from '../lib/utils/analyzePayload';
import { blockReasonFromMarketError } from '../core/institutional/providerGate';
import { fetchCandles } from '../lib/services/marketData';
import { candleCache } from '../lib/services/candleCache';
import { fetchCandlesWithFallback } from '../lib/services/marketData/MarketDataManager';

export interface AnalyzeInput {
  symbol?: string;
  asset?: string;
  balance: number;
  riskPercent: number;
  timeframe?: string;
  livePrice?: number;
  timingMode?: SignalTimingMode;
  streamLive?: boolean;
  analyzeOrigin?: string;
}

@Injectable()
export class SignalAnalysisService {
  private readonly log = new Logger(SignalAnalysisService.name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async analyze(input: AnalyzeInput): Promise<any> {
    const symbol = normalizeSymbol(input);
    if (!symbol) {
      return {
        success: false,
        message: 'Ativo não informado',
        signal: null,
        blockReason: 'Ativo não informado',
        status: 'NO_DATA',
      };
    }

    const timingMode = (input.timingMode || 'INSTANT') as SignalTimingMode;
    const streamLive = input.streamLive !== false;
    const started = Date.now();

    console.log('[DEBUG] backend analyze - symbol=', symbol, ' timeframe=', input.timeframe, ' streamLive=', streamLive);

    try {
      const tf = input.timeframe || '60';
      this.log.log(
        `[Lux:InstitutionalAI] analyze ${symbol} tf=${tf} origin=${input.analyzeOrigin ?? 'UNKNOWN'}`
      );
      await this.warmCandleCache(symbol, tf);
      const cached = candleCache.get(symbol, tf);
      console.log('[DEBUG] candles no cache após warmCandleCache - symbol=', symbol, ' timeframe=', tf, ' count=', cached?.length ?? 0);

      const payload = await InstitutionalSignalEngine.analyze({
        symbol,
        balance: input.balance,
        riskPercent: input.riskPercent,
        timeframe: input.timeframe || '60',
        livePrice: input.livePrice,
        timingMode,
        streamLive,
        analyzeOrigin: input.analyzeOrigin,
      });

      console.log('[DEBUG] InstitutionalSignalEngine.analyze result - status=', payload.status, ' blockReason=', payload.blockReason, ' candleCount=', payload.candleCount, ' snapshotId=', payload.snapshotId);

      const rawSignal = payload.signal;
      const serialized = rawSignal
        ? {
            ...rawSignal,
            timestamp:
              rawSignal.timestamp instanceof Date
                ? rawSignal.timestamp.toISOString()
                : rawSignal.timestamp,
          }
        : null;

      this.log.log(
        `analyze done ${symbol} status=${payload.status} conf=${payload.confidence} ms=${Date.now() - started}`
      );

      return {
        success: payload.status === 'OK' && payload.confidence > 0 && Boolean(payload.signal),
        signal: serialized,
        score: payload.confidence,
        confidence: payload.confidence,
        status: payload.status,
        blockReason: payload.blockReason,
        snapshotId: payload.snapshotId,
        snapshotTimestamp: payload.snapshotTimestamp,
        marketSequence: payload.marketSequence,
        marketRegime: payload.marketRegime,
        marketPhase: payload.marketPhase,
        reasoning: payload.reasoning,
        indicators: payload.indicators,
        liquidityState: payload.liquidityState,
        volatilityState: payload.volatilityState,
        institutionalBias: payload.institutionalBias,
        mtfConsensus: payload.mtfConsensus,
        timingMode,
        dataSource: payload.dataSource,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`analyze failed ${symbol}: ${msg}`);

      if (err instanceof MarketDataError) {
        return {
          success: false,
          signal: null,
          status: 'NO_DATA',
          confidence: 0,
          blockReason: blockReasonFromMarketError(err),
          dataSource: 'market-error',
          timingMode,
        };
      }

      return {
        success: false,
        signal: null,
        status: 'NO_DATA',
        confidence: 0,
        blockReason: msg.length < 200 ? msg : 'Análise indisponível',
        dataSource: 'error',
        timingMode,
      };
    }
  }

  private async warmCandleCache(symbol: string, timeframe: string): Promise<void> {
    const cached = candleCache.get(symbol, timeframe);
    console.log('[DEBUG] warmCandleCache - symbol=', symbol, ' timeframe=', timeframe, ' cached=', cached?.length ?? 0);
    if (cached && cached.length >= 20) {
      console.log('[DEBUG] warmCandleCache - cache already has sufficient candles');
      return;
    }
    try {
      console.log('[DEBUG] warmCandleCache - fetching candles from provider with fallback');
      const result = await fetchCandlesWithFallback(symbol, timeframe, 120);
      candleCache.set(symbol, timeframe, result.candles, result.provider);
      const afterFetch = candleCache.get(symbol, timeframe);
      console.log(
        `[Lux:SnapshotBuild] warm-cache ${symbol} TF${timeframe} bars=${afterFetch?.length ?? 0} provider=${result.provider}`
      );
      console.log('[DEBUG] warmCandleCache - fetch complete, candles=', afterFetch?.length ?? 0, 'provider=', result.provider);
    } catch (e) {
      console.log('[DEBUG] warmCandleCache - fetch failed, error=', e instanceof Error ? e.message : String(e));
      /* engine resolves via cache-fallback */
    }
  }

  getLatest(symbol: string, timeframe = '60') {
    const hit = getLatestForSymbol(symbol.toUpperCase(), timeframe);
    if (!hit) {
      return { success: false, message: 'Nenhum sinal institucional em cache' };
    }
    const latest = hit.payload;
    const signal = latest.signal
      ? {
          ...latest.signal,
          timestamp:
            latest.signal.timestamp instanceof Date
              ? latest.signal.timestamp.toISOString()
              : latest.signal.timestamp,
        }
      : null;
    return { success: true, ...latest, signal };
  }
}
