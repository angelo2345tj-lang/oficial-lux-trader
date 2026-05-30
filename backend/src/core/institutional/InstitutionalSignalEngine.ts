import {
  SignalType,
  SignalStrength,
  type MTFStatus,
  type SignalTimingMode,
  type TradeSignal,
} from '../../lib/types';
import { computeConfluence } from '../../lib/services/confluenceEngine';
import { MarketStructureEngine } from '../../lib/engines/MarketStructureEngine';
import { LiquidityEngine } from '../../lib/engines/LiquidityEngine';
import { SmartMoneyEngine } from '../../lib/engines/SmartMoneyEngine';
import { CandleAnalyzer } from '../../lib/engines/CandleAnalyzer';
import { EnsembleAnalysis } from '../../lib/engines/operational/ensembleAnalysis';
import { InstitutionalAI } from '../../lib/services/ai/InstitutionalAI';
import { InstitutionalSupremeEngine } from '../../lib/engines/InstitutionalSupremeEngine';
import { evaluateInstitutionalSetup } from '../../lib/services/ai/institutionalGate';
import { validateWithAI } from '../../lib/services/ai/AIEngine';
import { getRSIValue } from '../../lib/services/indicators';
import { SignalConfidenceEngine } from '../../lib/engines/SignalConfidenceEngine';
import { confidenceLabelFromScore } from '../../lib/services/institutional/institutionalScoreEngine';
import { MarketDataError } from '../../lib/services/marketData';
import { MarketSnapshotService } from './MarketSnapshotService';
import { computeMultiTimeframeConsensus } from './MultiTimeframeConsensus';
import { classifyMarketRegime } from './MarketRegimeEngine';
import { validateInstitutionalSignal } from './SignalValidationEngine';
import { computeInstitutionalConfidence } from './ConfidenceEngine';
import { applyAntiFlip } from './AntiFlipSystem';
import { getCachedSignal, setCachedSignal, invalidateSymbolCache } from './InstitutionalSignalCache';
import { broadcastInstitutionalSignal, markAnalyzedSnapshot } from './InstitutionalStreamHub';
import {
  checkProviderAvailability,
  clearMarketDataForSymbol,
  blockReasonFromMarketError,
} from './providerGate';
import { checkRetailMarketClosed } from './marketHours';
import { BLOCK_REASON, blockReasonForContext, normalizeBlockReason } from './blockReasons';
import { buildAuditEntry, logInstitutionalAuditReport } from './institutionalAudit';
import type { AnalyzeInstitutionalInput, InstitutionalSignalPayload } from './types';
import type { MarketSnapshot } from './types';

function calcATR(candles: import('../../lib/services/indicators').Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function buildLevels(
  entry: number,
  direction: 'BUY' | 'SELL',
  symbol: string,
  atr: number
) {
  const isForex = symbol.length === 6 && !symbol.includes('BTC');
  const multiplier =
    atr > 0 ? atr : isForex ? entry * 0.0012 : symbol.includes('BTC') ? entry * 0.0025 : entry * 0.004;
  const isBullish = direction === 'BUY';
  return {
    tp1: isBullish ? entry + multiplier : entry - multiplier,
    tp2: isBullish ? entry + multiplier * 2.1 : entry - multiplier * 2.1,
    tp3: isBullish ? entry + multiplier * 3.8 : entry - multiplier * 3.8,
    sl: isBullish ? entry - multiplier * 0.9 : entry + multiplier * 0.9,
    slPips: parseFloat((multiplier * (isForex ? 10000 : 100)).toFixed(1)),
  };
}

function trendLabel(candles: import('../../lib/services/indicators').Candle[]): string {
  if (candles.length < 10) return 'Neutral';
  const closes = candles.map((c) => c.close);
  const k = 2 / 14;
  let ema = closes[0];
  for (const c of closes) ema = c * k + ema * (1 - k);
  const price = closes[closes.length - 1];
  if (price > ema * 1.0003) return 'Bullish';
  if (price < ema * 0.9997) return 'Bearish';
  return 'Neutral';
}

function emaTrendDir(candles: import('../../lib/services/indicators').Candle[]): 'BUY' | 'SELL' {
  if (candles.length < 30) return 'BUY';
  const closes = candles.map((c) => c.close);
  const k = 2 / 21;
  let e21 = closes[0];
  for (const c of closes) e21 = c * k + e21 * (1 - k);
  return closes[closes.length - 1] >= e21 ? 'BUY' : 'SELL';
}

function mtfAlignedFromPack(
  mtf: { h1: import('../../lib/services/indicators').Candle[]; h4: import('../../lib/services/indicators').Candle[] },
  direction: 'BUY' | 'SELL'
): boolean {
  if (!mtf.h1?.length || !mtf.h4?.length) return false;
  return emaTrendDir(mtf.h4) === direction && emaTrendDir(mtf.h1) === direction;
}

/**
 * Motor institucional central — única fonte de verdade para todos os dispositivos.
 */
export class InstitutionalSignalEngine {
  static async analyze(input: AnalyzeInstitutionalInput): Promise<InstitutionalSignalPayload> {
    const symbol = input.symbol.toUpperCase();
    const timeframe = input.timeframe || '60';
    const timingMode = (input.timingMode || 'INSTANT') as SignalTimingMode;
    const balance = input.balance;
    const riskPercent = input.riskPercent;

    const analyzeOrigin = input.analyzeOrigin ?? 'UNKNOWN';
    console.log(
      `[Lux:AnalyzeStart] ${symbol} TF${timeframe} mode=${timingMode} streamLive=${input.streamLive !== false} origin=${analyzeOrigin}`
    );
    console.log(
      `[Lux:AnalyzeInput] symbol=${symbol} requestedTimeframe=${timeframe} origin=${analyzeOrigin}`
    );

    const marketClosed = checkRetailMarketClosed(symbol);
    if (marketClosed.closed) {
      invalidateSymbolCache(symbol);
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        marketClosed.blockReason,
        undefined,
        null
      );
      logInstitutionalAuditReport(
        buildAuditEntry(payload, {
          providerId: null,
          candleCount: 0,
          cacheAgeMs: null,
          noDataReason: BLOCK_REASON.MARKET_CLOSED,
        })
      );
      return payload;
    }

    const providerCheck = checkProviderAvailability(symbol);
    if (!providerCheck.available) {
      clearMarketDataForSymbol(symbol);
      invalidateSymbolCache(symbol);
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        providerCheck.reason,
        undefined,
        null
      );
      markAnalyzedSnapshot(payload.snapshotId, symbol, timeframe);
      logInstitutionalAuditReport(
        buildAuditEntry(payload, {
          providerId: null,
          candleCount: 0,
          cacheAgeMs: null,
          noDataReason: providerCheck.reason,
        })
      );
      return payload;
    }

    if (!input.streamLive) {
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        'SIGNAL_UNAVAILABLE',
        undefined,
        providerCheck.providerId
      );
      logInstitutionalAuditReport(
        buildAuditEntry(payload, {
          providerId: providerCheck.providerId,
          candleCount: 0,
          cacheAgeMs: null,
          noDataReason: 'SIGNAL_UNAVAILABLE',
        })
      );
      return payload;
    }

    let snapshot: MarketSnapshot;
    try {
      snapshot = await MarketSnapshotService.build(symbol, timeframe);
    } catch (e) {
      const msg =
        e instanceof MarketDataError
          ? blockReasonFromMarketError(e)
          : e instanceof Error
            ? e.message
            : 'snapshot failed';
      clearMarketDataForSymbol(symbol);
      invalidateSymbolCache(symbol);
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        msg,
        undefined,
        providerCheck.providerId
      );
      markAnalyzedSnapshot(payload.snapshotId, symbol, timeframe);
      logInstitutionalAuditReport(
        buildAuditEntry(payload, {
          providerId: providerCheck.providerId,
          candleCount: 0,
          cacheAgeMs: null,
          noDataReason: msg,
        })
      );
      return payload;
    }

    if (!snapshot.providerId) {
      invalidateSymbolCache(symbol);
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        providerCheck.reason || 'NO_PROVIDER',
        snapshot,
        null
      );
      markAnalyzedSnapshot(payload.snapshotId, symbol, timeframe);
      return payload;
    }

    const cached = getCachedSignal(snapshot.snapshotId, timingMode);
    if (cached) {
      console.log(
        `[Lux:AnalyzeResult] cache-hit ${symbol} snap=${snapshot.snapshotId} age=${cached.ageMs}ms`
      );
      markAnalyzedSnapshot(snapshot.snapshotId, symbol, timeframe);
      logInstitutionalAuditReport(
        buildAuditEntry(cached.payload, {
          providerId: snapshot.providerId,
          candleCount: snapshot.primaryCandles.length,
          cacheAgeMs: cached.ageMs,
          okReason: 'cache-hit',
        })
      );
      return cached.payload;
    }

    const candles = snapshot.primaryCandles;
    console.log(
      `[Lux:AnalyzeCandles] ${symbol} requestedTF=${snapshot.requestedTimeframe} snapshotTF=${snapshot.timeframe} ` +
        `providerTF=${snapshot.providerTimeframe} primary=${candles.length} ` +
        `mtf m5=${snapshot.mtf.m5.length} h1=${snapshot.mtf.h1.length} h4=${snapshot.mtf.h4.length} ` +
        `source=${snapshot.candleSource} provider=${snapshot.providerId}`
    );

    if (!candles.length || candles.length < 20) {
      const reason = BLOCK_REASON.INSUFFICIENT_CANDLES;
      console.log(
        `[Lux:AnalyzeCandles] ${symbol} INSUFFICIENT primary=${candles.length} (min=20)`
      );
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        reason,
        snapshot,
        snapshot.providerId
      );
      markAnalyzedSnapshot(snapshot.snapshotId, symbol, timeframe);
      logInstitutionalAuditReport(
        buildAuditEntry(payload, {
          providerId: snapshot.providerId,
          candleCount: candles.length,
          cacheAgeMs: null,
          noDataReason: reason,
        })
      );
      return payload;
    }

    const mtfConsensus = computeMultiTimeframeConsensus(snapshot.mtf);
    const confluence = computeConfluence(candles, { timingMode });
    const structure = MarketStructureEngine.analyze(candles);
    const liquidity = LiquidityEngine.analyze(candles);
    const smc = SmartMoneyEngine.analyze(candles);
    const candleAnalysis = CandleAnalyzer.analyze(candles);
    const regime = classifyMarketRegime(candles, structure, candleAnalysis);

    let tradeDir: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    if (mtfConsensus.direction !== 'NEUTRAL') tradeDir = mtfConsensus.direction;
    else if (confluence.signal === SignalType.BUY) tradeDir = 'BUY';
    else if (confluence.signal === SignalType.SELL) tradeDir = 'SELL';

    if (tradeDir === 'NEUTRAL') {
      const reason = BLOCK_REASON.NO_CONSENSUS;
      console.log(
        `[Lux:AnalyzeResult] ${symbol} NO_CONSENSUS mtf=${mtfConsensus.direction} conf=${confluence.signal} candles=${candles.length}`
      );
      const payload = InstitutionalSignalEngine.noDataPayload(
        symbol,
        timeframe,
        timingMode,
        reason,
        snapshot,
        snapshot.providerId
      );
      markAnalyzedSnapshot(snapshot.snapshotId, symbol, timeframe);
      logInstitutionalAuditReport(
        buildAuditEntry(payload, {
          providerId: snapshot.providerId,
          candleCount: candles.length,
          cacheAgeMs: null,
          noDataReason: reason,
        })
      );
      return payload;
    }

    const mtfPack = {
      m1: snapshot.mtf.m5,
      m5: snapshot.mtf.m5,
      m15: snapshot.mtf.m15,
      h1: snapshot.mtf.h1,
      h4: snapshot.mtf.h4,
    };
    const mtfAligned = mtfAlignedFromPack(snapshot.mtf, tradeDir);
    const ensemble = EnsembleAnalysis.analyze(confluence, structure, liquidity, smc, candleAnalysis);
    const institutional = InstitutionalAI.analyze(
      candles,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      mtfAligned
    );
    const supreme = InstitutionalSupremeEngine.analyze({
      candles,
      mtfPack,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      confluence,
      institutional,
      mtfAligned,
    });

    if (supreme.direction === 'BUY' || supreme.direction === 'SELL') {
      if (mtfConsensus.direction === 'NEUTRAL' || mtfConsensus.direction === supreme.direction) {
        tradeDir = supreme.direction;
      }
    }

    const atr = calcATR(candles);
    const validation = validateInstitutionalSignal({
      candles,
      direction: tradeDir,
      mtf: mtfConsensus,
      regime: regime.regime,
      atr,
      structureNeutral: structure.trend === 'RANGE' && !structure.bos && !structure.choch,
      liquidityScore: liquidity.score,
      volatilityScore: candleAnalysis.volatility,
    });

    if (!validation.valid && timingMode !== 'INSTANT') {
      const blocked: InstitutionalSignalPayload = {
        symbol,
        timeframe,
        timestamp: new Date(snapshot.snapshotTimestamp).toISOString(),
        snapshotId: snapshot.snapshotId,
        snapshotTimestamp: snapshot.snapshotTimestamp,
        marketSequence: snapshot.marketSequence,
        signal: null,
        direction: 'NEUTRAL',
        confidence: 0,
        status: 'BLOCKED',
        marketPhase: regime.phase,
        marketRegime: regime.regime,
        reasoning: validation.reasons,
        indicators: {},
        liquidityState: `score=${liquidity.score}`,
        volatilityState: `norm=${candleAnalysis.volatility}`,
        institutionalBias: smc.smcBias,
        mtfConsensus: Math.round(mtfConsensus.score * 100),
        timingMode,
        blockReason: validation.reasons.join(' · '),
        dataSource: 'institutional-core',
        providerId: snapshot.providerId,
        candleCount: candles.length,
      };
      markAnalyzedSnapshot(snapshot.snapshotId, symbol, timeframe);
      logInstitutionalAuditReport(
        buildAuditEntry(blocked, {
          providerId: snapshot.providerId,
          candleCount: candles.length,
          cacheAgeMs: null,
          noDataReason: blocked.blockReason ?? 'BLOCKED',
        })
      );
      return blocked;
    }

    const confidence = computeInstitutionalConfidence({
      symbol,
      direction: tradeDir,
      candles,
      supreme,
      candleAnalysis,
      structure,
      liquidity,
      mtfAligned,
      ensembleScore: ensemble.score,
      regime,
      mtfAgreement: mtfConsensus.agreement,
    });

    const flipKey = `${symbol}:${timeframe}`;
    const anti = applyAntiFlip(flipKey, tradeDir, confidence.finalConfidence);
    tradeDir = anti.direction;
    const finalConfidence = anti.confidence;

    const entry =
      input.livePrice && input.livePrice > 0 ? input.livePrice : snapshot.lastClose;
    const rsiValue = getRSIValue(candles);
    const confidenceMeta = SignalConfidenceEngine.compute(
      confluence,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      mtfAligned
    );
    const ai = await validateWithAI({
      symbol,
      timeframe,
      direction: tradeDir,
      confluence,
      candles,
      rsiValue,
      mtfAligned,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      confidence: { ...confidenceMeta, score: finalConfidence },
    });

    const gate = evaluateInstitutionalSetup({
      timingMode,
      blendedScore: finalConfidence,
      ensemble,
      ai,
      structure,
      candleAnalysis,
      confluence,
      mtfAligned,
      rsiValue,
      direction: tradeDir,
    });

    const levels = buildLevels(entry, tradeDir, symbol, atr);
    const riskAmount = balance * (riskPercent / 100);
    const mtf: MTFStatus = {
      m5: trendLabel(snapshot.mtf.m5),
      m15: trendLabel(snapshot.mtf.m15),
      h1: trendLabel(snapshot.mtf.h1),
      h4: trendLabel(snapshot.mtf.h4),
    };

    const signal: TradeSignal = {
      id: `SIG-${snapshot.snapshotId}-${timingMode}`,
      asset: symbol,
      type: tradeDir === 'BUY' ? SignalType.BUY : SignalType.SELL,
      strength:
        finalConfidence >= 78 ? SignalStrength.GOLDEN : SignalStrength.NORMAL,
      score: finalConfidence,
      confidence: finalConfidence,
      analysisStatus: 'OK',
      entry,
      tp1: levels.tp1,
      tp2: levels.tp2,
      tp3: levels.tp3,
      sl: levels.sl,
      slPips: levels.slPips,
      expectedProfit: riskAmount * 2.1,
      timestamp: new Date(snapshot.snapshotTimestamp),
      trend: confluence.trend,
      riskReward: '1:2.05',
      recommendedLot: Math.max(0.01, parseFloat((riskAmount / (levels.slPips * 10 || 1)).toFixed(2))),
      recommendedLeverage: '1:100',
      realRisk: riskAmount,
      mainReason: `${supreme.primaryReason} · ${finalConfidence}% · ${gate.strength}`,
      confluences: [...(confluence.confluences ?? []), ...supreme.confluences.slice(0, 6)],
      risks: gate.advisory ? [gate.advisory] : [],
      verdict: `${gate.strength} ${finalConfidence}%`,
      fullRationale: ai.reason,
      invalidation: tradeDir === 'BUY' ? levels.sl : levels.sl,
      timingMode,
      liquidity: liquidity.score,
      volatility: candleAnalysis.volatility,
      sentiment: finalConfidence,
      smcStatus: smc.smcBias,
      mtf,
      livePrice: entry,
      confidenceLabel: confidenceLabelFromScore(finalConfidence),
      winProbability: finalConfidence,
    };

    const payload: InstitutionalSignalPayload = {
      symbol,
      timeframe,
      timestamp: new Date(snapshot.snapshotTimestamp).toISOString(),
      snapshotId: snapshot.snapshotId,
      snapshotTimestamp: snapshot.snapshotTimestamp,
      marketSequence: snapshot.marketSequence,
      signal,
      direction: tradeDir,
      confidence: finalConfidence,
      status: 'OK',
      marketPhase: supreme.marketPhase,
      marketRegime: regime.regime,
      reasoning: [
        supreme.primaryReason,
        `Regime ${regime.regime}`,
        `MTF ${Math.round(mtfConsensus.score * 100)}%`,
        ...gate.reasons.slice(0, 3),
      ],
      indicators: {
        trend: confidence.trend,
        momentum: confidence.momentum,
        reversal: confidence.reversal,
        structure: confidence.structure,
        volume: confidence.volume,
        volatility: confidence.volatility,
      },
      liquidityState: liquidity.sweepDetected ? 'SWEEP' : `score=${liquidity.score}`,
      volatilityState: `norm=${confidence.volatility}`,
      institutionalBias: smc.smcBias,
      mtfConsensus: Math.round(mtfConsensus.score * 100),
      timingMode,
      dataSource: 'institutional-core',
      providerId: snapshot.providerId,
      candleCount: candles.length,
    };

    console.log(
      `[Lux:AnalyzeResult] OK ${symbol} ${tradeDir} conf=${finalConfidence}% snap=${snapshot.snapshotId} ` +
        `provider=${snapshot.providerId} candles=${candles.length}`
    );

    setCachedSignal(payload);
    broadcastInstitutionalSignal(payload);
    markAnalyzedSnapshot(snapshot.snapshotId, symbol, timeframe);
    logInstitutionalAuditReport(
      buildAuditEntry(payload, {
        providerId: snapshot.providerId,
        candleCount: candles.length,
        cacheAgeMs: 0,
        okReason: `direction=${tradeDir} mtf=${mtfConsensus.direction}`,
      })
    );
    return payload;
  }

  private static logBlocked(
    symbol: string,
    timeframe: string,
    reason: string,
    candleCount: number
  ): void {
    console.log(
      `[Lux:AnalyzeBlocked] symbol=${symbol} timeframe=${timeframe} reason=${reason} candles=${candleCount}`
    );
  }

  private static noDataPayload(
    symbol: string,
    timeframe: string,
    timingMode: SignalTimingMode,
    reason: string,
    snapshot?: MarketSnapshot,
    providerId?: string | null
  ): InstitutionalSignalPayload {
    const candleCount = snapshot?.primaryCandles?.length ?? 0;
    const blockReason = blockReasonForContext(normalizeBlockReason(reason), candleCount);
    InstitutionalSignalEngine.logBlocked(symbol, timeframe, blockReason, candleCount);
    invalidateSymbolCache(symbol);
    const payload: InstitutionalSignalPayload = {
      symbol,
      timeframe,
      timestamp: new Date().toISOString(),
      snapshotId: snapshot?.snapshotId ?? `${symbol}_${timeframe}_nodata`,
      snapshotTimestamp: snapshot?.snapshotTimestamp ?? Date.now(),
      marketSequence: snapshot?.marketSequence ?? 0,
      signal: null,
      direction: 'NEUTRAL',
      confidence: 0,
      status: 'NO_DATA',
      marketPhase: 'N/A',
      marketRegime: 'RANGING',
      reasoning: [reason],
      indicators: {},
      liquidityState: 'N/A',
      volatilityState: 'N/A',
      institutionalBias: 'NEUTRAL',
      mtfConsensus: 0,
      timingMode,
      blockReason,
      dataSource: 'institutional-core',
      providerId: providerId ?? snapshot?.providerId ?? null,
      candleCount,
    };
    console.log(
      `[Lux:AnalyzeResult] NO_DATA ${symbol} reason=${payload.blockReason} candles=${candleCount} ` +
        `snap=${payload.snapshotId} provider=${payload.providerId ?? 'none'}`
    );
    return payload;
  }
}
