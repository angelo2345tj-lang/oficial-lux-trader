import {
  TradeSignal,
  SignalType,
  SignalStrength,
  MTFStatus,
  SignalTimingMode,
} from '../../types';
import { fetchCandles, getCurrentPrice, fetchMTFCandles } from '../marketData';
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
import { MicrostructureScore } from '../../engines/operational/microstructure';
import { buildGuaranteedSignal } from './signalFallback';

export interface SignalResult {
  signal: TradeSignal | null;
  blockReason?: string;
  score?: number;
  classification?: string;
  winProbability?: number;
  dataSource?: string;
  timingMode?: SignalTimingMode;
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

function mtfAlignedFromPack(
  pack: { h1: Candle[]; h4: Candle[] } | null,
  direction: 'BUY' | 'SELL'
): boolean {
  if (!pack) return false;
  const toDir = (label: string): 'BUY' | 'SELL' | 'NEUTRAL' => {
    if (label === 'Bullish') return 'BUY';
    if (label === 'Bearish') return 'SELL';
    return 'NEUTRAL';
  };
  const t1 = toDir(trendLabel(pack.h1));
  const t4 = toDir(trendLabel(pack.h4));
  if (t1 === 'NEUTRAL' || t4 === 'NEUTRAL') return t1 === direction || t4 === direction;
  return t1 === direction && t4 === direction;
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
      logger.error(msg, 'RealSignalEngine');
      const stub = buildGuaranteedSignal({
        assetSymbol,
        timeframe,
        banca,
        riskPercent,
        entry: livePrice && livePrice > 0 ? livePrice : 0,
        candles: [],
        confluence: {
          score: 50,
          signal: SignalType.NEUTRAL,
          type: 'NONE',
          confidence: 50,
          classification: 'RECUPERAÇÃO',
          securityScore: 40,
          indicators: [],
          confluences: [],
          blocked: false,
          trend: 'LATERAL',
          strength: 0,
        },
        structure: {
          trend: 'RANGE',
          bos: false,
          choch: false,
          lastBreak: null,
          direction: 'NEUTRAL',
          swingHighs: [],
          swingLows: [],
          score: 50,
          notes: [],
        },
        candleAnalysis: {
          pattern: 'NONE',
          reversal: false,
          continuation: false,
          fakeout: false,
          manipulation: false,
          impulse: false,
          volatility: 50,
          direction: 'NEUTRAL',
          score: 50,
          notes: [],
        },
        blendedScore: 50,
        timingMode,
        blockNote: msg,
      });
      return {
        signal: stub.entry > 0 ? stub : null,
        blockReason: stub.entry > 0 ? undefined : msg,
        dataSource: 'error-recovery',
        timingMode,
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
    logger.info(
      `Análise ${timingMode}: ${assetSymbol} TF${timeframe}`,
      'RealSignalEngine'
    );

    const mtfFetch =
      timingMode === 'INSTANT'
        ? Promise.all([
            fetchCandles(assetSymbol, '60', 80),
            fetchCandles(assetSymbol, '240', 80),
          ])
            .then(([h1, h4]) => ({ m5: h1, m15: h1, h1, h4 }))
            .catch(() => null)
        : fetchMTFCandles(assetSymbol).catch(() => null);

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
      const earlyConfluence = computeConfluence(rawCandles, { timingMode });
      const earlyStructure = MarketStructureEngine.analyze(rawCandles);
      const earlyCandle = CandleAnalyzer.analyze(rawCandles);
      const earlyEntry =
        livePrice && livePrice > 0 ? livePrice : getCurrentPrice(rawCandles);
      const fallback = buildGuaranteedSignal({
        assetSymbol,
        timeframe,
        banca,
        riskPercent,
        entry: earlyEntry,
        candles: rawCandles,
        confluence: earlyConfluence,
        structure: earlyStructure,
        candleAnalysis: earlyCandle,
        blendedScore: earlyConfluence.score,
        timingMode,
        blockNote: confirmation.reason,
      });
      return {
        signal: fallback,
        score: fallback.score,
        timingMode,
        dataSource: 'confirmed-fallback',
      };
    }
    const candles = confirmation.candles.length >= 20 ? confirmation.candles : rawCandles;
    const entry = livePrice && livePrice > 0 ? livePrice : getCurrentPrice(candles);

    let microBoost = 0;
    let microResult: MicrostructureScore | null = null;
    let microAdvisory: string | undefined;
    if (timingMode === 'INSTANT' && bookMaybe) {
      microResult = analyzeMicrostructure(bookMaybe, candles, entry);
      microBoost = Math.round((microResult.score - 50) * 0.4);
      if (microResult.score < 38) {
        microAdvisory = 'Fluxo fraco — sinal por momentum';
        microBoost = Math.max(microBoost, -4);
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

    if (
      (confluence.blocked || confluence.type === 'NONE') &&
      timingMode !== 'INSTANT'
    ) {
      const fallback = buildGuaranteedSignal({
        assetSymbol,
        timeframe,
        banca,
        riskPercent,
        entry,
        candles,
        confluence,
        structure,
        candleAnalysis,
        blendedScore: confluence.score,
        timingMode,
        blockNote: getLastBlockSummary(confluence),
      });
      return {
        signal: fallback,
        score: fallback.score,
        timingMode,
        dataSource: 'fallback',
      };
    }

    if (direction === 'NEUTRAL' && timingMode === 'INSTANT') {
      const neutral = buildGuaranteedSignal({
        assetSymbol,
        timeframe,
        banca,
        riskPercent,
        entry,
        candles,
        confluence,
        structure,
        candleAnalysis,
        blendedScore: confluence.score,
        timingMode,
        blockNote: consolidationNote,
      });
      return {
        signal: neutral,
        score: neutral.score,
        timingMode,
        dataSource: 'instant-neutral',
      };
    }

    const tradeDir = direction as 'BUY' | 'SELL';
    const mtfAligned = mtfAlignedFromPack(mtfPack, tradeDir);
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

    if (institutional.manipulation && institutional.score < 45) {
      microAdvisory = [microAdvisory, 'Manipulação detectada — operar com lote reduzido']
        .filter(Boolean)
        .join(' · ');
    }

    const confidence = SignalConfidenceEngine.compute(
      confluence,
      structure,
      liquidity,
      smc,
      candleAnalysis,
      mtfAligned
    );
    let blendedScore = Math.round(
      (confidence.score + ensemble.score + institutional.score) / 3
    );
    blendedScore = Math.min(100, Math.max(0, blendedScore + microBoost));

    if (!mtfAligned && timingMode !== 'INSTANT') {
      blendedScore = Math.max(blendedScore - 4, 50);
    }

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
      confidence: { ...confidence, score: blendedScore },
    });

    const gate = evaluateInstitutionalSetup({
      timingMode,
      blendedScore,
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

    blendedScore = Math.min(
      97,
      Math.max(blendedScore, gate.operationalProbability - 5)
    );
    blockNote = [blockNote, ...gate.reasons.slice(0, 2)].filter(Boolean).join(' · ');

    const mtf: MTFStatus = mtfPack
      ? {
          m5: trendLabel(mtfPack.m5),
          m15: trendLabel(mtfPack.m15),
          h1: trendLabel(mtfPack.h1),
          h4: trendLabel(mtfPack.h4),
        }
      : { m5: 'Neutral', m15: 'Neutral', h1: 'Neutral', h4: 'Neutral' };

    const atr = calcATR(candles);
    const levels = buildLevels(entry, tradeDir, assetSymbol, atr);
    const riskAmount = banca * (riskPercent / 100);
    const recLot = Math.max(0.01, parseFloat((riskAmount / (levels.slPips * 10 || 1)).toFixed(2)));

    const invalidation =
      tradeDir === 'BUY'
        ? Math.min(levels.sl, entry * 0.9985)
        : Math.max(levels.sl, entry * 1.0015);
    const estimatedMinutes = estimateMinutes(timeframe, candleAnalysis.volatility);

    const baseSignal: TradeSignal = {
      id: `SIG-${Date.now().toString(36).toUpperCase()}`,
      asset: assetSymbol,
      type: confluence.signal,
      strength:
        gate.strength === 'ELITE' || gate.operationalProbability >= 78
          ? SignalStrength.GOLDEN
          : gate.strength === 'STRONG'
            ? SignalStrength.ELITE
            : SignalStrength.NORMAL,
      score: blendedScore,
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
      mainReason: `${gate.strength} · ${gate.operationalProbability}% · ${ai.source} · ${timingMode}`,
      confluences: confluence.confluences ?? [],
      risks: [],
      verdict: `${confidence.classification} ${blendedScore}%`,
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

    if (blockNote) {
      signal = {
        ...signal,
        risks: [...(signal.risks ?? []), blockNote].slice(0, 6),
        aiExplanation: `${signal.aiExplanation ?? ''} ${blockNote}`.trim(),
      };
    }

    logger.info(`Sinal real gerado: ${assetSymbol} ${tradeDir} ${signal.score}%`, 'RealSignalEngine');

    return {
      signal: {
        ...signal,
        winProbability: gate.operationalProbability,
        mainReason: signal.mainReason,
      },
      score: signal.score,
      classification: gate.strength,
      winProbability: gate.operationalProbability,
      dataSource: 'real',
      timingMode,
    };
  }
}
