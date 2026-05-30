import { IndicatorResult, runAllIndicators, Candle } from './indicators';
import { SignalType } from '../types';

export interface ConfluenceResult {
  score: number;
  signal: SignalType;
  type: 'COMPRA' | 'VENDA' | 'NONE';
  confidence: number;
  classification: string;
  securityScore: number;
  winProbability?: number;
  aiReason?: string;
  indicators: IndicatorResult[];
  confluences: string[];
  blocked: boolean;
  blockReason?: string;
  trend: string;
  strength: number;
}

export const MIN_SCORE = 52;
export const MIN_SCORE_INSTANT = 48;

export interface ComputeConfluenceOptions {
  timingMode?: 'INSTANT' | 'CONFIRMED';
}

const MIN_SECURITY = 45;
const MIN_SECURITY_MODERATE = 50;

const SCORE_WEIGHTS: Record<string, number> = {
  RSI: 15,
  MACD: 25,
  EMA: 15,
  ADX: 15,
  Volume: 10,
  'Price Action': 25,
};

const CORE_INDICATORS = ['EMA', 'MACD', 'RSI'] as const;

export function classifySignal(score: number): string {
  if (score >= 92) return 'ELITE';
  if (score >= 85) return 'SINAL MUITO FORTE';
  if (score >= 75) return 'SINAL FORTE';
  if (score >= MIN_SCORE) return 'SINAL MODERADO';
  return 'OPERÁVEL';
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function mapFrom(indicators: IndicatorResult[]): Record<string, IndicatorResult> {

  const map: Record<string, IndicatorResult> = {};

  indicators.forEach(i => {
    map[i.name] = i;
  });

  return map;
}

function calcDirectionScore(
  indicators: IndicatorResult[],
  direction: 'BUY' | 'SELL'
): number {

  let earned = 0;
  let maxWeight = 0;

  for (const [name, weight] of Object.entries(SCORE_WEIGHTS)) {

    const ind = indicators.find(i => i.name === name);

    if (!ind) continue;

    maxWeight += weight;

    if (ind.signal === direction) {

      earned += weight * (Math.max(ind.score, 55) / 100);

    } else if (ind.signal === 'NEUTRAL') {

      earned += weight * 0.55 * (ind.score / 100);

    } else {

      earned += weight * 0.15;
    }
  }

  return maxWeight > 0
    ? Math.round((earned / maxWeight) * 100)
    : 0;
}

function applyQualityBonus(
  baseScore: number,
  map: Record<string, IndicatorResult>,
  direction: 'BUY' | 'SELL'
): number {

  let bonus = 0;

  const trend = map['Tendência'];
  const pullback = map['Pullback'];
  const adx = map['ADX'];
  const breakout = map['Breakout'];

  if (trend?.signal === direction) bonus += 6;

  if (pullback?.signal === direction) bonus += 5;

  if (adx?.signal === direction) bonus += 4;

  if (breakout?.signal === direction) bonus += 5;

  return Math.min(100, baseScore + bonus);
}

function countCoreAlignment(
  map: Record<string, IndicatorResult>,
  direction: 'BUY' | 'SELL'
): number {

  return CORE_INDICATORS.filter(
    name => map[name]?.signal === direction
  ).length;
}

function countCoreSupport(
  map: Record<string, IndicatorResult>,
  direction: 'BUY' | 'SELL'
): number {

  let n = countCoreAlignment(map, direction);

  CORE_INDICATORS.forEach(name => {

    if (
      map[name]?.signal === 'NEUTRAL' &&
      map[name]?.trend === (
        direction === 'BUY'
          ? 'ALTA'
          : 'BAIXA'
      )
    ) {
      n += 0.5;
    }
  });

  return n;
}

function hasStrongTrend(
  map: Record<string, IndicatorResult>
): boolean {

  const adx = map['ADX'];
  const trend = map['Tendência'];

  return (
    ((adx?.strength ?? 0) >= 22 ||
      (adx?.score ?? 0) >= 55) &&
    trend?.signal !== 'NEUTRAL'
  );
}

function hasMomentum(
  map: Record<string, IndicatorResult>,
  direction: 'BUY' | 'SELL'
): boolean {

  const macd = map['MACD'];
  const pa = map['Price Action'];
  const vol = map['Volume'];

  let points = 0;

  if (
    macd?.signal === direction ||
    macd?.trend === (
      direction === 'BUY'
        ? 'ALTA'
        : 'BAIXA'
    )
  ) points++;

  if (pa?.signal === direction) points++;

  if (
    vol?.signal === direction ||
    vol?.signal === 'NEUTRAL'
  ) points++;

  return points >= 1;
}

function isMarketLateral(
  map: Record<string, IndicatorResult>
): boolean {

  const adx = map['ADX'];
  const trend = map['Tendência'];
  const boll = map['Bollinger'];

  const lateralSignals = [

    adx?.trend === 'LATERAL' &&
    (adx?.strength ?? 0) < 15,

    trend?.trend === 'LATERAL' &&
    trend?.signal === 'NEUTRAL',

    (boll?.strength ?? 0) < 12,
  ];

  return lateralSignals.filter(Boolean).length >= 3;
}

function resolveDirection(
  buyScore: number,
  sellScore: number,
  map: Record<string, IndicatorResult>
): 'BUY' | 'SELL' | null {

  const diff = Math.abs(buyScore - sellScore);

  if (diff < 2) return null;

  const preferred =
    buyScore > sellScore
      ? 'BUY'
      : 'SELL';

  const trend = map['Tendência'];

  if (
    trend?.signal !== 'NEUTRAL' &&
    trend?.signal !== preferred
  ) {

    const pullback = map['Pullback'];
    const macd = map['MACD'];

    if (
      pullback?.signal !== preferred &&
      macd?.signal !== preferred
    ) {
      return null;
    }
  }

  return preferred;
}

function calcSecurityScore(
  candles: Candle[],
  map: Record<string, IndicatorResult>,
  direction: 'BUY' | 'SELL',
  score: number
): number {

  let sec = 78;

  const adx = map['ADX'];
  const atr = map['ATR'];
  const breakout = map['Breakout'];
  const vol = map['Volume'];

  if (isMarketLateral(map)) sec -= 18;

  if (hasStrongTrend(map)) sec += 12;

  if (
    breakout?.signal !== 'NEUTRAL' &&
    breakout?.signal !== direction &&
    (breakout?.confidence ?? 0) < 40
  ) {
    sec -= 15;
  }

  if (
    breakout?.signal === direction &&
    (breakout?.confidence ?? 0) >= 50
  ) {
    sec += 10;
  }

  if ((atr?.strength ?? 0) > 85) sec -= 10;

  if (
    (vol?.strength ?? 0) >= 25 ||
    vol?.signal === direction
  ) {
    sec += 8;
  }

  if (hasMomentum(map, direction)) sec += 10;

  if (countCoreAlignment(map, direction) >= 2) sec += 8;

  if (score >= 75) sec += 5;

  return clamp(sec, 0, 100);
}

function passesCoreGate(
  map: Record<string, IndicatorResult>,
  direction: 'BUY' | 'SELL',
  score: number
): boolean {

  const core = countCoreAlignment(map, direction);

  const support = countCoreSupport(map, direction);

  const trend = map['Tendência'];

  if (core >= 2) return true;

  if (
    direction === 'SELL' &&
    core >= 1 &&
    hasStrongTrend(map)
  ) return true;

  if (
    core >= 1 &&
    trend?.signal === direction &&
    score >= 68
  ) return true;

  if (
    support >= 2 &&
    score >= 70
  ) return true;

  if (
    hasStrongTrend(map) &&
    core >= 1 &&
    score >= 66
  ) return true;

  return false;
}

export function analyzeOperationalAI(
  candles: Candle[],
  indicators: IndicatorResult[],
  direction: 'BUY' | 'SELL',
  score: number,
  securityScore: number,
  instant = false
): { blocked: boolean; reason?: string } {
  if (instant) return { blocked: false };

  const map = mapFrom(indicators);

  if (securityScore < MIN_SECURITY - 8) {
    return {
      blocked: true,
      reason: `Proteção operacional — segurança ${securityScore}%`,
    };
  }

  if (score < 58 && securityScore < MIN_SECURITY_MODERATE - 5) {
    return {
      blocked: true,
      reason: 'Sinal moderado exige segurança maior',
    };
  }

  if (isMarketLateral(map) && score < 65 && !hasStrongTrend(map)) {
    return {
      blocked: true,
      reason: 'Mercado lateralizado',
    };
  }

  return { blocked: false };
}

function resolveDirectionInstant(
  buyScore: number,
  sellScore: number,
  map: Record<string, IndicatorResult>,
  candles: Candle[]
): 'BUY' | 'SELL' {
  if (buyScore - sellScore >= 1) return 'BUY';
  if (sellScore - buyScore >= 1) return 'SELL';

  const macd = map['MACD'];
  if (macd?.signal === 'BUY' || macd?.trend === 'ALTA') return 'BUY';
  if (macd?.signal === 'SELL' || macd?.trend === 'BAIXA') return 'SELL';

  const last3 = candles.slice(-3);
  const bulls = last3.filter((c) => c.close >= c.open).length;
  if (bulls >= 2) return 'BUY';
  if (bulls <= 1) return 'SELL';

  return buyScore >= sellScore ? 'BUY' : 'SELL';
}

export function computeConfluence(
  candles: Candle[],
  options?: ComputeConfluenceOptions
): ConfluenceResult {
  const instant = options?.timingMode === 'INSTANT';

  const indicators = runAllIndicators(candles);
  const map = mapFrom(indicators);
  const buyScore = calcDirectionScore(indicators, 'BUY');
  const sellScore = calcDirectionScore(indicators, 'SELL');

  let direction = resolveDirection(buyScore, sellScore, map);

  if (!direction && instant) {
    direction = resolveDirectionInstant(buyScore, sellScore, map, candles);
  }

  if (!direction) {
    const forced = resolveDirectionInstant(buyScore, sellScore, map, candles);
    direction = forced ?? (buyScore >= sellScore ? 'BUY' : 'SELL');
  }

  const rawScore =
    direction === 'BUY'
      ? buyScore
      : sellScore;

  const score =
    applyQualityBonus(
      rawScore,
      map,
      direction
    );

  const classification =
    classifySignal(score);

  const securityScore =
    calcSecurityScore(
      candles,
      map,
      direction,
      score
    );

  const ai = analyzeOperationalAI(
    candles,
    indicators,
    direction,
    score,
    securityScore,
    instant
  );

  const aiAdvisory = ai.blocked && ai.reason ? [ai.reason] : [];

  const weightedConf =
    Object.keys(SCORE_WEIGHTS)
      .reduce((acc, name) => {

        const ind = map[name];

        return (
          acc +
          (ind?.confidence ?? 0) *
          (SCORE_WEIGHTS[name] / 100)
        );

      }, 0);

  return {

    score,

    securityScore,

    signal:
      direction === 'BUY'
        ? SignalType.BUY
        : SignalType.SELL,

    type:
      direction === 'BUY'
        ? 'COMPRA'
        : 'VENDA',

    confidence:
      Math.round(
        Math.min(
          100,
          weightedConf * 0.7 +
          securityScore * 0.3
        )
      ),

    classification,

    indicators,

    confluences: aiAdvisory,

    blocked: false,

    trend:
      direction === 'BUY'
        ? 'ALTA'
        : 'BAIXA',

    strength:
      map['ADX']?.strength ?? 50,
  };
}
export function getLastBlockSummary(result: ConfluenceResult): string {
  return (
    result.blockReason ||
    `${result.classification} — score ${result.score}% | segurança ${result.securityScore}%`
  );
}