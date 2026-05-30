import {
  TradeSignal,
  SignalType,
  SignalStrength,
  MTFStatus,
  SignalTimingMode,
} from '../../types';
import { fetchCandles, getCurrentPrice, fetchMTFCandles, fetchMTFExtended } from '../marketData';
import {
  InstitutionalSupremeEngine,
  type MTFExtendedPack,
} from '../../engines/InstitutionalSupremeEngine';
import { fetchOrderBook } from '../marketData/orderBook';
import { analyzeMicrostructure } from '../../engines/operational/microstructure';
import { computeConfluence, getLastBlockSummary } from '../confluenceEngine';
import { validateWithAI } from '../ai/AIEngine';
import { evaluateInstitutionalSetup } from '../ai/institutionalGate';
import { getRSIValue } from '../indicators';
import { MarketStructureEngine } from '../../engines/MarketStructureEngine';
import { LiquidityEngine } from '../../engines/LiquidityEngine';
import { SmartMoneyEngine } from '../../engines/SmartMoneyEngine';
import { CandleAnalyzer } from '../../engines/CandleAnalyzer';
import { SignalConfidenceEngine } from '../../engines/SignalConfidenceEngine';
import { CandleConfirmationSystem } from '../../engines/operational/candleConfirmation';
import { EnsembleAnalysis } from '../../engines/operational/ensembleAnalysis';
import { InstitutionalAI } from '../ai/InstitutionalAI';
import { isConsolidatingMarket } from '../operational/consolidationFilter';
import { logger } from '../logger';
import { Candle } from '../indicators';
import { improveSignalQuality } from '../../engines/improveSignalQuality';
import { LocalInstitutionalBrain } from '../../engines/LocalInstitutionalBrain';
import { MicrostructureScore } from '../../engines/operational/microstructure';
import { realtimeOrchestrator } from '../realtime/InstitutionalRealtimeOrchestrator';
import { resetInstitutionalAnalysisState } from '../institutional/institutionalReset';
import {
  computeOrganicConfidence,
  confidenceLabelFromScore,
} from '../institutional/institutionalScoreEngine';
import { emitSignalResult } from '../signal/signalPipeline';
import { INSTITUTIONAL_SIGNALS_ONLY } from '../institutional/institutionalMode';
import { buildCanonicalSnapshotId } from '../institutional/buildSnapshotId';

export interface SignalResult {
  signal: TradeSignal | null;
  blockReason?: string;
  score?: number;
  confidence?: number;
  classification?: string;
  winProbability?: number;
  dataSource?: string;
  timingMode?: SignalTimingMode;
  status?: 'OK' | 'NO_DATA' | 'BLOCKED';
  snapshotId?: string;
  snapshotTimestamp?: number;
  marketSequence?: number;
}

function trendLabel(candles: Candle[]): string {
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

function emaTrendDir(candles: Candle[]): 'BUY' | 'SELL' {
  if (candles.length < 30) return 'BUY';
  const closes = candles.map((c) => c.close);
  const k = 2 / 21;
  let e21 = closes[0];
  for (const c of closes) e21 = c * k + e21 * (1 - k);
  const price = closes[closes.length - 1];
  return price >= e21 ? 'BUY' : 'SELL';
}

/** Alinhamento macro: H4 e H1 devem concordar com a direção (M1 ignorado). */
function mtfAlignedFromPack(
  pack: { h1: Candle[]; h4: Candle[] } | null,
  direction: 'BUY' | 'SELL'
): boolean {
  if (!pack?.h1?.length || !pack?.h4?.length) return false;
  const t4 = emaTrendDir(pack.h4);
  const t1 = emaTrendDir(pack.h1);
  return t4 === direction && t1 === direction;
}

function buildLevels(entry: number, direction: 'BUY' | 'SELL', symbol: string, atr: number) {
  const isForex = symbol.length === 6 && !symbol.includes('BTC');
  const multiplier = atr > 0 ? atr : isForex ? entry * 0.0012 : symbol.includes('BTC') ? entry * 0.0025 : entry * 0.004;

  const isBullish = direction === 'BUY';
  return {
    tp1: isBullish ? entry + multiplier : entry - multiplier,
    tp2: isBullish ? entry + multiplier * 2.1 : entry - multiplier * 2.1,
    tp3: isBullish ? entry + multiplier * 3.8 : entry - multiplier * 3.8,
    sl: isBullish ? entry - multiplier * 0.9 : entry + multiplier * 0.9,
    slPips: parseFloat((multiplier * (isForex ? 10000 : 100)).toFixed(1)),
  };
}

function estimateMinutes(timeframe: string, volatility: number): number {
  const tfMap: Record<string, number> = {
    '1': 8,
    '5': 15,
    '15': 25,
    '30': 35,
    '60': 45,
    '120': 90,
    '240': 180,
  };
  const base = tfMap[timeframe] ?? 30;
  const volFactor = volatility > 80 ? 0.75 : volatility < 40 ? 1.25 : 1;
  return Math.round(base * volFactor);
}

function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export class RealSignalEngine {
  static async analyze(
    assetSymbol: string,
    banca: number,
    riskPercent: number,
    timeframe = '60',
    livePrice?: number,
    timingMode: SignalTimingMode = 'INSTANT'
  ): Promise<SignalResult> {
    try {
      return await RealSignalEngine.runAnalyze(
        assetSymbol,
        banca,
        riskPercent,
        timeframe,
        livePrice,
        timingMode
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro interno na análise';
      logger.error(`[Lux:Signal] ${msg}`, 'RealSignalEngine');
      return {
        signal: null,
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
        blockReason: 'NO_MARKET_DATA',
        timingMode,
        dataSource: 'error',
      };
    }
  }

  private static async runAnalyze(
    assetSymbol: string,
    banca: number,
    riskPercent: number,
    timeframe = '60',
    livePrice?: number,
    timingMode: SignalTimingMode = 'INSTANT'
  ): Promise<SignalResult> {
    if (INSTITUTIONAL_SIGNALS_ONLY) {
      return {
        signal: null,
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
        blockReason: 'LOCAL_ENGINE_DISABLED — use institutional API',
        timingMode,
        dataSource: 'local-disabled',
      };
    }

    resetInstitutionalAnalysisState();

    if (!realtimeOrchestrator.isSignalAllowed()) {
      if (!realtimeOrchestrator.isMarketLive() && !realtimeOrchestrator.isRestAlive()) {
      logger.warn('SIGNAL_UNAVAILABLE — mercado não sincronizado', 'RealSignalEngine');
        return {
          signal: null,
          blockReason: 'SIGNAL_UNAVAILABLE — sincronizando mercado',
          timingMode,
        };
      }
    }

    logger.info(
      `Análise ${timingMode}: ${assetSymbol} TF${timeframe}`,
      'RealSignalEngine'
    );

    const mtfFetch: Promise<MTFExtendedPack | null> =
      timingMode === 'INSTANT'
        ? fetchMTFExtended(assetSymbol).catch(() => null)
        : fetchMTFExtended(assetSymbol).catch(() =>
            fetchMTFCandles(assetSymbol).then((p) => ({
              m1: p.m5,
              m5: p.m5,
              m15: p.m15,
              h1: p.h1,
              h4: p.h4,
            }))
          );

    const [rawCandles, bookMaybe, mtfPack] = await Promise.all([
      fetchCandles(assetSymbol, timeframe, 120),
      timingMode === 'INSTANT'
        ? fetchOrderBook(assetSymbol, 20).catch(() => null)
        : Promise.resolve(null),
      mtfFetch,
    ]);

    const confirmation = CandleConfirmationSystem.validate(
      rawCandles,
      timeframe,
      timingMode
    );
    if (!confirmation.confirmed && timingMode === 'CONFIRMED') {
      return {
        signal: null,
        blockReason: confirmation.reason,
        timingMode,
        dataSource: 'confirmed-wait',
      };
    }
    const candles = confirmation.candles.length >= 20 ? confirmation.candles : rawCandles;

    if (!candles.length || candles.length < 20) {
      logger.warn(`NO_DATA ${assetSymbol} len=${candles.length}`, 'RealSignalEngine');
      return {
        signal: null,
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
        blockReason: 'NO_DATA — dados de mercado insuficientes',
        timingMode,
        dataSource: 'no-data',
      };
    }

    const entry = livePrice && livePrice > 0 ? livePrice : getCurrentPrice(candles);

    let microResult: MicrostructureScore | null = null;
    let microAdvisory: string | undefined;
    if (timingMode === 'INSTANT' && bookMaybe) {
      microResult = analyzeMicrostructure(bookMaybe, candles, entry);
      if (microResult.score < 38) {
        microAdvisory = 'Fluxo fraco — sinal por momentum';
      }
    }

    const confluence = computeConfluence(candles, { timingMode });
    const structure = MarketStructureEngine.analyze(candles);
    const liquidity = LiquidityEngine.analyze(candles);
    const smc = SmartMoneyEngine.analyze(candles);
    const candleAnalysis = CandleAnalyzer.analyze(candles);

    const consolidation = isConsolidatingMarket(
      candles,
      structure,
      candleAnalysis,
      timingMode
    );
    const consolidationNote = consolidation.advisory ?? consolidation.reason;

    let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    if (confluence.signal === SignalType.BUY) direction = 'BUY';
    else if (confluence.signal === SignalType.SELL) direction = 'SELL';

    if (direction === 'NEUTRAL' && timingMode === 'INSTANT') {
      const last = candles.slice(-4);
      const bulls = last.filter((c) => c.close >= c.open).length;
      direction = bulls >= 3 ? 'BUY' : bulls <= 1 ? 'SELL' : 'NEUTRAL';
    }

    if (direction === 'NEUTRAL') {
      return {
        signal: null,
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
        blockReason: 'NO_DATA — direção indefinida',
        timingMode,
        dataSource: 'no-data',
      };
    }

    if (
      (confluence.blocked || confluence.type === 'NONE') &&
      timingMode !== 'INSTANT'
    ) {
      return {
        signal: null,
        status: 'BLOCKED',
        blockReason: getLastBlockSummary(confluence),
        timingMode,
        dataSource: 'blocked',
      };
    }

    const macroProbe =
      mtfPack && mtfPack.h4.length && mtfPack.h1.length
        ? emaTrendDir(mtfPack.h4) === emaTrendDir(mtfPack.h1)
          ? emaTrendDir(mtfPack.h4)
          : emaTrendDir(mtfPack.h4)
        : (direction as 'BUY' | 'SELL');
    const mtfAligned = mtfAlignedFromPack(mtfPack, macroProbe);
    const rsiValue = getRSIValue(candles);

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

    direction = supreme.direction;
    const tradeDir = direction as 'BUY' | 'SELL';

    if (institutional.manipulation && institutional.score < 45) {
      microAdvisory = [microAdvisory, 'Manipulação detectada — operar com lote reduzido']
        .filter(Boolean)
        .join(' · ');
    }

    const scoreBreakdown = computeOrganicConfidence({
      symbol: assetSymbol,
      direction: tradeDir,
      supreme,
      candleAnalysis,
      structure,
      liquidity,
      mtfAligned,
      ensembleScore: ensemble.score,
    });

    const brain = LocalInstitutionalBrain.evaluate({
      symbol: assetSymbol,
      direction: tradeDir,
      candles,
      mtfPack,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      supreme,
      mtfAligned,
      baseConfidence: scoreBreakdown.finalConfidence,
    });

    const finalConfidence = brain.aiScore;

    const confidenceMeta = SignalConfidenceEngine.compute(
      confluence,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      mtfAligned
    );

    const ai = await validateWithAI({
      symbol: assetSymbol,
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

    let blockNote: string | undefined = consolidationNote ?? microAdvisory;
    if (gate.advisory) {
      blockNote = [blockNote, gate.advisory].filter(Boolean).join(' · ');
    }
    blockNote = [blockNote, ...gate.reasons.slice(0, 2)].filter(Boolean).join(' · ');

    const mtf: MTFStatus = mtfPack
      ? {
          m5: trendLabel(mtfPack.m5),
          m15: trendLabel(mtfPack.m15),
          h1: trendLabel(mtfPack.h1),
          h4: trendLabel(mtfPack.h4),
        }
      : { m5: 'Neutral', m15: 'Neutral', h1: 'Neutral', h4: 'Neutral' };

    const supremeNote = [
      supreme.primaryReason,
      `Fase ${supreme.marketPhase}`,
      `Rev ${supreme.reversalBull}/${supreme.reversalBear}`,
      `Macro ${supreme.macroDirection} ${supreme.macroStrength}%`,
      ...supreme.confluences.slice(0, 4),
    ].join(' · ');

    const atr = calcATR(candles);
    const levels = buildLevels(entry, tradeDir, assetSymbol, atr);
    const riskAmount = banca * (riskPercent / 100);
    const recLot = Math.max(0.01, parseFloat((riskAmount / (levels.slPips * 10 || 1)).toFixed(2)));

    const invalidation =
      tradeDir === 'BUY'
        ? Math.min(levels.sl, entry * 0.9985)
        : Math.max(levels.sl, entry * 1.0015);
    const estimatedMinutes = estimateMinutes(timeframe, candleAnalysis.volatility);
    const snapshotId =
      buildCanonicalSnapshotId(assetSymbol, timeframe, candles) ??
      `${assetSymbol.toUpperCase()}_${timeframe}_${Date.now()}`;

    // Use UUID for absolute uniqueness to prevent ID collisions
    const uniquePart =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const signalId = `SIG-${snapshotId}-${uniquePart}`;
    console.log(
      '[AUDIT-ID]',
      {
        signalId,
        timestamp: Date.now(),
        snapshotId,
        uniquePart,
        createdAt: new Date().toISOString()
      }
    );

    const baseSignal: TradeSignal = {
      id: signalId,
      asset: assetSymbol,
      type: tradeDir === 'BUY' ? SignalType.BUY : SignalType.SELL,
      strength:
        gate.strength === 'ELITE' || finalConfidence >= 78
          ? SignalStrength.GOLDEN
          : gate.strength === 'STRONG'
            ? SignalStrength.ELITE
            : SignalStrength.NORMAL,
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
      timestamp: new Date(),
      trend: confluence.trend,
      riskReward: '1:2.05',
      recommendedLot: recLot,
      recommendedLeverage: '1:100',
      realRisk: riskAmount,
      mainReason: `${supreme.primaryReason} · ${finalConfidence}% · ${gate.strength}`,
      confluences: [
        ...(confluence.confluences ?? []),
        ...supreme.confluences.slice(0, 8),
      ].slice(0, 20),
      risks: [],
      verdict: `${confidenceMeta.classification} ${finalConfidence}%`,
      fullRationale: ai.reason,
      invalidation,
      estimatedMinutes,
      timingMode,
      liquidity: liquidity.score,
      volatility: candleAnalysis.volatility,
      sentiment: ai.confidence,
      smcStatus: smc.smcBias,
      mtf,
      livePrice: entry,
    };

    let signal = improveSignalQuality({
      signal: baseSignal,
      direction: tradeDir,
      confluence,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      ai,
      candles,
      mtfAligned,
      micro: microResult,
    });

    signal = {
      ...signal,
      score: finalConfidence,
      confidence: finalConfidence,
      confidenceLabel:
        brain.tier === 'EXTREMAMENTE FORTE'
          ? 'EXTREMAMENTE FORTE'
          : brain.tier === 'FORTE'
            ? 'FORTE'
            : brain.tier === 'MODERADA'
              ? 'MODERADA'
              : 'FRACA',
      aiStrengthTier: brain.tier,
      localAiRegime: brain.regime,
      mtfConfirmationPct: brain.mtfConfirmationPct,
      bosActive: brain.bosDetected,
      chochActive: brain.chochDetected,
      fakeBreakoutRisk: brain.fakeBreakout,
      mainReason: brain.entryReason || signal.mainReason,
      aiExplanation: `${brain.decisionReason}. Risco: ${brain.riskExplanation}`,
      signalQuality: finalConfidence,
    };

    const mergedNote = [blockNote, supremeNote, ...supreme.advisories].filter(Boolean).join(' · ');
    if (mergedNote) {
      signal = {
        ...signal,
        risks: [...(signal.risks ?? []), mergedNote].slice(0, 6),
        aiExplanation: `${signal.aiExplanation ?? ''} ${mergedNote}`.trim(),
      };
    }

    const payload: SignalResult = {
      signal: {
        ...signal,
        winProbability: finalConfidence,
        mainReason: signal.mainReason,
      },
      score: finalConfidence,
      confidence: finalConfidence,
      classification: gate.strength,
      winProbability: finalConfidence,
      status: 'OK',
      snapshotId,
      dataSource: 'real',
      timingMode,
    };

    logger.info(
      `Sinal real gerado: ${assetSymbol} ${tradeDir} conf=${finalConfidence}% (decision=${scoreBreakdown.decisionRef}%)`,
      'Signal'
    );
    emitSignalResult(payload);

    return payload;
  }
}
