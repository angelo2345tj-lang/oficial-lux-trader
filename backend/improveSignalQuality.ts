import {
  TradeSignal,
  IndicatorCalculations,
  InstitutionalAnalysis,
  InstitutionalAnalysisBlock,
  AnalysisBlockStatus,
} from '../types';
import { ConfluenceResult } from '../services/confluenceEngine';
import { StructureAnalysis } from './MarketStructureEngine';
import { LiquidityAnalysis } from './LiquidityEngine';
import { SmartMoneyAnalysis } from './SmartMoneyEngine';
import { CandleAnalysis } from './CandleAnalyzer';
import { AIValidation } from '../services/ai/AIEngine';
import { MicrostructureScore } from './operational/microstructure';
import { Candle, IndicatorResult, getRSIValue } from '../services/indicators';

export interface SignalQualityInput {
  signal: TradeSignal;
  direction: 'BUY' | 'SELL';
  confluence: ConfluenceResult;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  smc: SmartMoneyAnalysis;
  candleAnalysis: CandleAnalysis;
  ai: AIValidation;
  candles: Candle[];
  mtfAligned: boolean;
  micro?: MicrostructureScore | null;
}

function calcVwap(candles: Candle[]): number {
  const slice = candles.slice(-20);
  let pv = 0;
  let vol = 0;
  for (const c of slice) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = c.volume || 1;
    pv += tp * v;
    vol += v;
  }
  return vol > 0 ? pv / vol : candles[candles.length - 1]?.close ?? 0;
}

function indicatorMap(indicators: IndicatorResult[]): Record<string, IndicatorResult> {
  const map: Record<string, IndicatorResult> = {};
  indicators.forEach((i) => {
    map[i.name] = i;
  });
  return map;
}

function confidenceFromScore(score: number): TradeSignal['confidenceLabel'] {
  if (score >= 85) return 'ELITE';
  if (score >= 72) return 'FORTE';
  if (score >= 58) return 'MODERADA';
  return 'FRACA';
}

function statusFor(
  ok: boolean,
  warn: boolean,
  direction: 'BUY' | 'SELL'
): AnalysisBlockStatus {
  if (warn) return 'warning';
  if (ok) return direction === 'BUY' ? 'bullish' : 'bearish';
  return 'neutral';
}

function marketConditionLabel(
  structure: StructureAnalysis,
  candleAnalysis: CandleAnalysis,
  map: Record<string, IndicatorResult>
): string {
  const adx = map['ADX'];
  if (structure.trend === 'RANGE' && !structure.bos) return 'Consolidação / Range';
  if (structure.bos) return `Tendência com BOS ${structure.lastBreak ?? ''}`.trim();
  if (structure.choch) return 'Possível reversão (CHOCH)';
  if ((adx?.strength ?? 0) >= 25) return 'Tendência forte';
  if (candleAnalysis.volatility > 75) return 'Alta volatilidade';
  if (candleAnalysis.volatility < 35) return 'Baixa volatilidade';
  return structure.trend === 'BULLISH'
    ? 'Mercado bullish'
    : structure.trend === 'BEARISH'
      ? 'Mercado bearish'
      : 'Mercado neutro';
}

function buildInstitutionalAnalysis(
  input: SignalQualityInput,
  map: Record<string, IndicatorResult>,
  vwap: number,
  price: number,
  rsiVal: number,
  adjusted: number,
  positives: string[],
  negatives: string[],
  confluences: string[],
  risks: string[]
): InstitutionalAnalysis {
  const { direction, structure, liquidity, smc, candleAnalysis, ai, micro, mtfAligned } =
    input;
  const rsi = map['RSI'];
  const macd = map['MACD'];
  const ema = map['EMA'];
  const vol = map['Volume'];
  const vwapOk = direction === 'BUY' ? price >= vwap * 0.9995 : price <= vwap * 1.0005;

  const avgVol =
    input.candles.slice(-20).reduce((s, c) => s + (c.volume || 0), 0) /
    Math.max(1, Math.min(20, input.candles.length));
  const lastVol = input.candles[input.candles.length - 1]?.volume ?? 0;
  const volAboveAvg = lastVol >= avgVol * 0.95;

  const blocks: InstitutionalAnalysisBlock[] = [
    {
      id: 'rsi',
      label: 'RSI',
      value: rsiVal.toFixed(1),
      interpretation: rsi
        ? `${rsi.signal} · ${rsi.trend ?? 'momentum'} · força ${rsi.strength ?? rsi.score}`
        : 'RSI em zona neutra',
      status: statusFor(
        rsi?.signal === direction,
        rsiVal > 70 && direction === 'BUY',
        direction
      ),
    },
    {
      id: 'macd',
      label: 'MACD',
      value: macd?.signal ?? 'NEUTRAL',
      interpretation: macd
        ? `Cruzamento ${macd.signal} · tendência ${macd.trend ?? '—'}`
        : 'Sem cruzamento definido',
      status: statusFor(macd?.signal === direction, false, direction),
    },
    {
      id: 'ema',
      label: 'EMA',
      value: ema?.signal ?? 'NEUTRAL',
      interpretation: ema
        ? `Alinhamento ${ema.trend ?? ema.signal} com preço`
        : 'EMA sem alinhamento claro',
      status: statusFor(
        ema?.signal === direction || ema?.trend === (direction === 'BUY' ? 'ALTA' : 'BAIXA'),
        false,
        direction
      ),
    },
    {
      id: 'vwap',
      label: 'VWAP',
      value: vwap.toFixed(5),
      interpretation: vwapOk
        ? `Preço ${direction === 'BUY' ? 'acima' : 'abaixo'} da VWAP — favorável`
        : 'Preço desalinhado da VWAP institucional',
      status: statusFor(vwapOk, !vwapOk, direction),
    },
    {
      id: 'liquidity',
      label: 'Liquidez',
      value: `${liquidity.score}%`,
      interpretation: liquidity.sweepDetected
        ? 'Sweep detectado · possível caça de stops'
        : liquidity.score >= 55
          ? 'Liquidez institucional presente'
          : 'Liquidez fraca — risco de slippage',
      status: statusFor(
        liquidity.score >= 55 || liquidity.sweepDetected,
        liquidity.score < 40,
        direction
      ),
    },
    {
      id: 'smc',
      label: 'SMC',
      value: `${structure.bos ? 'BOS' : '—'} / ${structure.choch ? 'CHOCH' : '—'}`,
      interpretation: [
        structure.bos ? `BOS ${structure.lastBreak ?? ''} confirmado` : null,
        structure.choch ? 'CHOCH — mudança de caráter' : null,
        smc.orderBlocks.length
          ? `Order block ${smc.orderBlocks[0]?.type}${smc.orderBlocks[0]?.mitigated ? ' mitigado' : ''}`
          : null,
        `Bias ${smc.smcBias}`,
      ]
        .filter(Boolean)
        .join(' · '),
      status: statusFor(
        (structure.bos && structure.direction === direction) ||
          (smc.smcBias.includes('COMPRA') && direction === 'BUY') ||
          (smc.smcBias.includes('DISTRIBUI') && direction === 'SELL'),
        structure.choch && structure.direction !== direction,
        direction
      ),
    },
    {
      id: 'volume',
      label: 'Volume',
      value: volAboveAvg ? 'Acima da média' : 'Abaixo da média',
      interpretation: vol
        ? `${vol.signal} · força ${vol.strength ?? vol.score}`
        : `Volatilidade ${candleAnalysis.volatility}%`,
      status: statusFor(
        vol?.signal === direction || volAboveAvg,
        !volAboveAvg && (vol?.strength ?? 0) < 15,
        direction
      ),
    },
    {
      id: 'orderflow',
      label: 'Order Flow',
      value: micro
        ? `${(micro.imbalance * 100).toFixed(1)}% imb.`
        : 'Book N/D',
      interpretation:
        micro?.notes.join(' · ') ||
        (direction === 'BUY' ? 'Fluxo comprador' : 'Fluxo vendedor'),
      status: statusFor((micro?.score ?? 50) >= 52, (micro?.score ?? 50) < 42, direction),
    },
    {
      id: 'delta',
      label: 'Delta / Agressão',
      value: micro
        ? micro.imbalance > 0.08
          ? 'Compradora'
          : micro.imbalance < -0.08
            ? 'Vendedora'
            : 'Equilibrada'
        : 'Neutro',
      interpretation: micro
        ? `Spread ${micro.spreadBps.toFixed(1)} bps · score ${micro.score}`
        : 'Sem dados DOM — uso de candles',
      status: statusFor(
        (direction === 'BUY' && (micro?.imbalance ?? 0) > 0.05) ||
          (direction === 'SELL' && (micro?.imbalance ?? 0) < -0.05),
        false,
        direction
      ),
    },
    {
      id: 'mtf',
      label: 'MTF',
      value: mtfAligned ? 'Alinhado' : 'Divergente',
      interpretation: mtfAligned
        ? 'H1/H4 na mesma direção do setup'
        : 'Timeframes maiores não confirmam totalmente',
      status: statusFor(mtfAligned, !mtfAligned, direction),
    },
  ];

  const decisionReason = [
    `Score final ${adjusted}% (${confidenceFromScore(adjusted)}).`,
    `IA ${ai.source}: win ${ai.winProbability}%.`,
    positives.length ? `Drivers: ${positives.slice(0, 3).join('; ')}.` : '',
    negatives.length ? `Filtros: ${negatives.slice(0, 2).join('; ')}.` : '',
    `Modo ${input.signal.timingMode ?? 'INSTANT'} — ${direction} validado por engines institucionais.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    blocks,
    summary: marketConditionLabel(structure, candleAnalysis, map),
    decisionReason,
    confluences,
    risks,
  };
}

export function improveSignalQuality(input: SignalQualityInput): TradeSignal {
  const {
    signal,
    direction,
    confluence,
    structure,
    liquidity,
    smc,
    candleAnalysis,
    ai,
    candles,
    mtfAligned,
    micro,
  } = input;

  const map = indicatorMap(confluence.indicators);
  const rsi = map['RSI'];
  const macd = map['MACD'];
  const ema = map['EMA'];
  const vol = map['Volume'];
  const vwap = calcVwap(candles);
  const price = candles[candles.length - 1]?.close ?? signal.entry;
  const rsiVal = getRSIValue(candles);

  let adjusted = signal.score;
  const positives: string[] = [];
  const negatives: string[] = [];
  const confluences: string[] = [...(confluence.confluences ?? [])];

  const aligned = (ind?: IndicatorResult) =>
    ind?.signal === direction || ind?.trend === (direction === 'BUY' ? 'ALTA' : 'BAIXA');

  if (aligned(rsi)) {
    adjusted += 4;
    positives.push('RSI alinhado');
    if (!confluences.includes('RSI')) confluences.push('RSI');
  } else if (rsi?.signal && rsi.signal !== 'NEUTRAL' && rsi.signal !== direction) {
    adjusted -= 6;
    negatives.push('RSI contra');
  }

  if (aligned(macd)) {
    adjusted += 5;
    positives.push('MACD momentum');
    if (!confluences.includes('MACD')) confluences.push('MACD');
  } else if (macd?.signal === (direction === 'BUY' ? 'SELL' : 'BUY')) {
    adjusted -= 5;
    negatives.push('MACD divergente');
  }

  if (aligned(ema)) {
    adjusted += 4;
    positives.push('EMA alinhada');
    if (!confluences.includes('EMA')) confluences.push('EMA');
  }

  const vwapOk = direction === 'BUY' ? price >= vwap * 0.9995 : price <= vwap * 1.0005;
  if (vwapOk) {
    adjusted += 3;
    positives.push('VWAP favorável');
    if (!confluences.includes('VWAP')) confluences.push('VWAP');
  } else {
    adjusted -= 3;
    negatives.push('VWAP desalinhada');
  }

  if (liquidity.score >= 55 || liquidity.sweepDetected) {
    adjusted += 3;
    positives.push(liquidity.sweepDetected ? 'Sweep liquidez' : 'Liquidez OK');
    if (!confluences.includes('Liquidez')) confluences.push('Liquidez');
  } else if (liquidity.score < 40) {
    adjusted -= 4;
    negatives.push('Liquidez fraca');
  }

  if (structure.bos && structure.direction === direction) {
    adjusted += 6;
    positives.push('BOS confirmado');
    if (!confluences.includes('BOS')) confluences.push('BOS');
  } else if (
    structure.trend === 'RANGE' &&
    !structure.bos &&
    signal.timingMode !== 'INSTANT'
  ) {
    adjusted -= 4;
    negatives.push('Range — gestão reduzida');
  }

  if (structure.choch) {
    if (structure.direction === direction) {
      adjusted += 4;
      positives.push('CHOCH a favor');
      if (!confluences.includes('CHOCH')) confluences.push('CHOCH');
    } else {
      adjusted -= 4;
      negatives.push('CHOCH contra');
    }
  }

  const lowVolume =
    (vol?.strength ?? 0) < 15 &&
    vol?.signal !== direction &&
    candleAnalysis.volatility < 40;
  if (lowVolume) {
    adjusted -= 8;
    negatives.push('Volume baixo');
  } else if (vol?.signal === direction || (vol?.strength ?? 0) >= 22) {
    adjusted += 4;
    positives.push('Volume confirma');
    if (!confluences.includes('Volume')) confluences.push('Volume');
  }

  if (micro && micro.score >= 55) {
    adjusted += 4;
    positives.push('Tape/DOM favorável');
    micro.notes.forEach((n) => {
      if (!confluences.includes(n)) confluences.push(n);
    });
  } else if (micro && micro.score < 42) {
    adjusted -= 6;
    negatives.push('DOM fraco');
  }

  if (mtfAligned) {
    adjusted += 5;
    positives.push('MTF alinhado');
    if (!confluences.includes('MTF')) confluences.push('MTF');
  } else {
    adjusted -= 3;
    negatives.push('MTF parcial');
  }

  if (candleAnalysis.fakeout) {
    adjusted -= 6;
    negatives.push('Fakeout');
  }

  const risks: string[] = [];
  if (candleAnalysis.fakeout) risks.push('Fakeout — aguarde confirmação');
  if (candleAnalysis.volatility > 85) risks.push('Volatilidade extrema');
  if (structure.trend === 'RANGE') risks.push('Range — reduzir tamanho');
  if (!mtfAligned) risks.push('MTF divergente');
  if (ai.winProbability < 62) risks.push(`Win prob IA ${ai.winProbability}%`);
  if (micro && micro.spreadBps > 12) risks.push(`Spread ${micro.spreadBps.toFixed(0)} bps`);
  if (lowVolume) risks.push('Volume abaixo da média');

  const riskLevel: TradeSignal['riskLevel'] =
    negatives.length >= 4 || adjusted < 55
      ? 'HIGH'
      : negatives.length >= 2
        ? 'MEDIUM'
        : 'LOW';

  if (riskLevel === 'HIGH') adjusted -= 4;

  adjusted = Math.min(97, Math.max(40, Math.round(adjusted)));

  const adx = map['ADX'];
  const bb = map['Bollinger'] ?? map['BB'];
  const bullPatterns = ['REVERSAL_BULL', 'CONTINUATION_BULL', 'IMPULSE'] as const;
  const bearPatterns = ['REVERSAL_BEAR', 'CONTINUATION_BEAR', 'IMPULSE'] as const;
  const candleOk =
    direction === 'BUY'
      ? bullPatterns.includes(candleAnalysis.pattern as (typeof bullPatterns)[number])
      : bearPatterns.includes(candleAnalysis.pattern as (typeof bearPatterns)[number]);

  const indicatorCalculations: IndicatorCalculations = {
    rsi: `RSI ${rsiVal.toFixed(1)} — ${rsi?.signal ?? 'NEUTRAL'}`,
    macd: macd ? `MACD ${macd.signal} · ${macd.trend ?? ''}` : 'MACD neutro',
    ema: ema
      ? `EMA 8/21/50 · ${ema.signal} · ${ema.trend ?? ''}`
      : 'EMA 8/21/50 neutra',
    bollinger: bb
      ? `BB ${bb.signal} · ${bb.trend ?? 'bandas'}`
      : `Volatilidade ${candleAnalysis.volatility}%`,
    adx: adx
      ? `ADX ${adx.strength ?? adx.score} · ${adx.trend ?? ''}`
      : structure.trend === 'RANGE'
        ? 'ADX lateral'
        : 'ADX tendência',
    momentum: macd
      ? `MACD ${macd.signal} · força ${macd.strength ?? macd.score}`
      : `Momentum ${candleAnalysis.volatility}%`,
    macroTrend: `${structure.trend} · MTF ${mtfAligned ? 'alinhado' : 'parcial'} · ${signal.trend}`,
    candleConfirm: candleOk
      ? 'Candle de confirmação presente'
      : candleAnalysis.fakeout
        ? 'Fakeout — aguardar fechamento'
        : 'Aguardar confirmação',
    volume: vol
      ? `Volume ${vol.signal} · ${vol.strength ?? vol.score}`
      : `Vol ${candleAnalysis.volatility}%`,
    liquidity: `Liq ${liquidity.score}%${liquidity.sweepDetected ? ' sweep' : ''}`,
    structure: `${structure.trend} BOS:${structure.bos} CHOCH:${structure.choch}`,
    vwap: `VWAP ${vwap.toFixed(5)} · ${vwapOk ? 'OK' : 'alerta'}`,
  };

  const institutionalAnalysis = buildInstitutionalAnalysis(
    input,
    map,
    vwap,
    price,
    rsiVal,
    adjusted,
    positives,
    negatives,
    [...new Set(confluences)].slice(0, 14),
    [...new Set(risks)].slice(0, 8)
  );

  const aiExplanation = [
    institutionalAnalysis.decisionReason,
    `Condição: ${institutionalAnalysis.summary}.`,
    risks.length ? `Riscos: ${risks.join('; ')}.` : '',
  ].join(' ');

  return {
    ...signal,
    score: adjusted,
    signalQuality: adjusted,
    winProbability: ai.winProbability,
    confirmationStatus:
      signal.timingMode === 'CONFIRMED'
        ? candleOk
          ? 'Candle confirmado'
          : 'Aguardando fechamento'
        : 'Modo instantâneo — entrada ativa',
    confidenceLabel: confidenceFromScore(adjusted),
    confluences: institutionalAnalysis.confluences,
    risks: institutionalAnalysis.risks,
    marketCondition: institutionalAnalysis.summary,
    indicatorCalculations,
    institutionalAnalysis,
    scoreBreakdown: { positives, negatives },
    aiExplanation,
    riskLevel,
    orderFlow: micro?.notes.join(' · ') || undefined,
    institutionalBias: smc.smcBias,
    volumeDelta: micro?.imbalance,
    spread: micro?.spreadBps,
    fullRationale: aiExplanation,
    mainReason: `${confidenceFromScore(adjusted)} · ${ai.winProbability}%`,
    verdict: `${confidenceFromScore(adjusted)} ${adjusted}%`,
  };
}
