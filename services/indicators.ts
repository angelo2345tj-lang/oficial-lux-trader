
export type IndicatorSignal = 'BUY' | 'SELL' | 'NEUTRAL';

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface IndicatorResult {
  name: string;
  signal: IndicatorSignal;
  trend: 'ALTA' | 'BAIXA' | 'LATERAL';
  strength: number;
  score: number;
  confidence: number;
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export function sma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function wilderSmooth(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  let sum = values.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothed = sum / period;
  for (let i = period; i < values.length; i++) {
    smoothed = (smoothed * (period - 1) + values[i]) / period;
  }
  return smoothed;
}

export function getRSIValue(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  const closes = candles.map(c => c.close);
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calcRSI(candles: Candle[], period = 14): IndicatorResult {
  if (candles.length < period + 1) {
    return { name: 'RSI', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const rsi = getRSIValue(candles, period);
  const signal: IndicatorSignal =
    rsi > 55 ? 'BUY' : rsi < 45 ? 'SELL' :
    rsi > 52 ? 'BUY' : rsi < 48 ? 'SELL' : 'NEUTRAL';
  const trend = rsi > 58 ? 'ALTA' : rsi < 42 ? 'BAIXA' : 'LATERAL';
  const strength = Math.abs(rsi - 50) * 2;
  const score = rsi > 50 ? clamp(50 + (rsi - 50)) : clamp(50 + (50 - rsi));
  return { name: 'RSI', signal, trend, strength, score, confidence: clamp(strength + 20) };
}

export function calcMACD(candles: Candle[]): IndicatorResult {
  const closes = candles.map(c => c.close);
  if (closes.length < 26) {
    return { name: 'MACD', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const sig = signalLine[signalLine.length - 1];
  const hist = macd - sig;
  const prevHist = macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2];
  const price = closes[closes.length - 1];
  const histNorm = Math.abs(hist / price) * 100000;
  const bullish = macd > sig && hist > prevHist;
  const bearish = macd < sig && hist < prevHist;
  const signal: IndicatorSignal = bullish ? 'BUY' : bearish ? 'SELL' : macd > sig ? 'BUY' : macd < sig ? 'SELL' : 'NEUTRAL';
  const trend = macd > 0 ? 'ALTA' : macd < 0 ? 'BAIXA' : 'LATERAL';
  const strength = clamp(histNorm * 6);
  const score = signal !== 'NEUTRAL' ? clamp(62 + strength * 0.45) : 48;
  return { name: 'MACD', signal, trend, strength, score, confidence: clamp(strength + 15) };
}

export function calcEMA(candles: Candle[], periods = [8, 21, 50]): IndicatorResult {
  const closes = candles.map(c => c.close);
  if (closes.length < 50) {
    return { name: 'EMA', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const e8 = ema(closes, periods[0]).at(-1)!;
  const e21 = ema(closes, periods[1]).at(-1)!;
  const e50 = ema(closes, periods[2]).at(-1)!;
  const fullBull = e8 > e21 && e21 > e50;
  const fullBear = e8 < e21 && e21 < e50;
  const partialBull = e8 > e21;
  const partialBear = e8 < e21;
  const signal: IndicatorSignal = fullBull ? 'BUY' : fullBear ? 'SELL' : partialBull ? 'BUY' : partialBear ? 'SELL' : 'NEUTRAL';
  const trend = partialBull ? 'ALTA' : partialBear ? 'BAIXA' : 'LATERAL';
  const spread = Math.abs(e8 - e50) / e50 * 10000;
  const strength = clamp(spread * 5 + (fullBull || fullBear ? 15 : 0));
  const score = fullBull || fullBear ? clamp(68 + strength * 0.3) : partialBull || partialBear ? clamp(60 + strength * 0.25) : 48;
  return { name: 'EMA', signal, trend, strength, score, confidence: clamp(strength + 25) };
}

export function calcADX(candles: Candle[], period = 14): IndicatorResult {
  if (candles.length < period + 2) {
    return { name: 'ADX', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const trs: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const hi = candles[i].high - candles[i - 1].high;
    const lo = candles[i - 1].low - candles[i].low;
    plusDM.push(hi > lo && hi > 0 ? hi : 0);
    minusDM.push(lo > hi && lo > 0 ? lo : 0);
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
  }
  const atrVal = sma(trs, period) || 1;
  const pdi = (sma(plusDM, period) / atrVal) * 100;
  const mdi = (sma(minusDM, period) / atrVal) * 100;
  const dx = Math.abs(pdi - mdi) / (pdi + mdi || 1) * 100;
  const adx = clamp(dx * 1.4);
  const signal: IndicatorSignal = adx > 20 ? (pdi > mdi ? 'BUY' : 'SELL') : 'NEUTRAL';
  const trend = adx < 16 ? 'LATERAL' : pdi > mdi ? 'ALTA' : 'BAIXA';
  const strength = clamp(adx * 1.8);
  const score = clamp(50 + adx * 0.9);
  return { name: 'ADX', signal, trend, strength, score, confidence: clamp(adx + 10) };
}

export function calcATR(candles: Candle[], period = 14): IndicatorResult {
  if (candles.length < period + 1) {
    return { name: 'ATR', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
  }
  const atr = sma(trs, period);
  const avgPrice = candles[candles.length - 1].close;
  const volPct = (atr / avgPrice) * 100;
  const highVol = volPct > 0.15;
  const signal: IndicatorSignal = highVol ? 'NEUTRAL' : 'NEUTRAL';
  const trend = volPct > 0.25 ? 'LATERAL' : candles[candles.length - 1].close > candles[candles.length - 5]?.close ? 'ALTA' : 'BAIXA';
  const strength = clamp(volPct * 200);
  return { name: 'ATR', signal, trend, strength, score: highVol ? 45 : 60, confidence: clamp(100 - volPct * 100) };
}

export function calcBollinger(candles: Candle[], period = 20): IndicatorResult {
  const closes = candles.map(c => c.close);
  if (closes.length < period) {
    return { name: 'Bollinger', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const mid = sma(closes, period);
  const slice = closes.slice(-period);
  const std = Math.sqrt(slice.reduce((a, v) => a + (v - mid) ** 2, 0) / period);
  const upper = mid + 2 * std, lower = mid - 2 * std;
  const price = closes[closes.length - 1];
  const signal: IndicatorSignal = price <= lower ? 'BUY' : price >= upper ? 'SELL' : 'NEUTRAL';
  const trend = price > mid ? 'ALTA' : price < mid ? 'BAIXA' : 'LATERAL';
  const bandwidth = ((upper - lower) / mid) * 100;
  const strength = clamp(bandwidth * 10);
  const score = signal !== 'NEUTRAL' ? clamp(60 + strength * 0.3) : 50;
  return { name: 'Bollinger', signal, trend, strength, score, confidence: clamp(70 - bandwidth * 5) };
}

export function calcVolume(candles: Candle[]): IndicatorResult {
  if (candles.length < 10) {
    return { name: 'Volume', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const vols = candles.map(c => c.volume);
  const avg = vols.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, vols.length);
  const last = vols[vols.length - 1];
  const ratio = avg > 0 ? last / avg : 1;
  const rising = candles[candles.length - 1].close > candles[candles.length - 2].close;
  const signal: IndicatorSignal = ratio > 1.12 ? (rising ? 'BUY' : 'SELL') : 'NEUTRAL';
  const trend = rising ? 'ALTA' : 'BAIXA';
  const strength = clamp((ratio - 1) * 45);
  const score = signal !== 'NEUTRAL' ? clamp(55 + strength) : 45;
  return { name: 'Volume', signal, trend, strength, score, confidence: clamp(ratio * 40) };
}

export function calcPriceAction(candles: Candle[]): IndicatorResult {
  if (candles.length < 5) {
    return { name: 'Price Action', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low || 0.00001;
  const bullishEngulf = last.close > last.open && prev.close < prev.open && last.close > prev.open && last.open < prev.close;
  const bearishEngulf = last.close < last.open && prev.close > prev.open && last.close < prev.open && last.open > prev.close;
  const bodyRatio = body / range;
  const signal: IndicatorSignal =
    bullishEngulf ? 'BUY' :
    bearishEngulf ? 'SELL' :
    bodyRatio >= 0.45 && last.close > last.open ? 'BUY' :
    bodyRatio >= 0.45 && last.close < last.open ? 'SELL' : 'NEUTRAL';
  const trend = last.close > candles[candles.length - 5].close ? 'ALTA' : 'BAIXA';
  const strength = clamp((body / range) * 100);
  const score = (bullishEngulf || bearishEngulf) ? clamp(70 + strength * 0.2) : clamp(50 + strength * 0.15);
  return { name: 'Price Action', signal, trend, strength, score, confidence: clamp(strength + 20) };
}

export function calcTrend(candles: Candle[]): IndicatorResult {
  if (candles.length < 20) {
    return { name: 'Tendência', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const closes = candles.map(c => c.close);
  const e21 = ema(closes, 21).at(-1)!;
  const e50 = ema(closes, 50).at(-1)!;
  const price = closes[closes.length - 1];
  const bullish = price > e21 && e21 > e50;
  const bearish = price < e21 && e21 < e50;
  const signal: IndicatorSignal = bullish ? 'BUY' : bearish ? 'SELL' : 'NEUTRAL';
  const trend = bullish ? 'ALTA' : bearish ? 'BAIXA' : 'LATERAL';
  const strength = clamp(Math.abs(price - e50) / e50 * 5000);
  const score = signal !== 'NEUTRAL' ? clamp(60 + strength * 0.3) : 45;
  return { name: 'Tendência', signal, trend, strength, score, confidence: clamp(strength + 20) };
}

export function calcPullback(candles: Candle[]): IndicatorResult {
  if (candles.length < 15) {
    return { name: 'Pullback', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const closes = candles.map(c => c.close);
  const e8 = ema(closes, 8).at(-1)!;
  const e21 = ema(closes, 21).at(-1)!;
  const price = closes[closes.length - 1];
  const uptrend = e8 > e21;
  const nearEma = Math.abs(price - e21) / e21 < 0.002;
  const pullbackBuy = uptrend && nearEma && price > e21;
  const pullbackSell = !uptrend && nearEma && price < e21;
  const signal: IndicatorSignal = pullbackBuy ? 'BUY' : pullbackSell ? 'SELL' : 'NEUTRAL';
  const trend = uptrend ? 'ALTA' : 'BAIXA';
  const strength = nearEma ? clamp(70) : 30;
  const score = signal !== 'NEUTRAL' ? clamp(65 + strength * 0.25) : 45;
  return { name: 'Pullback', signal, trend, strength, score, confidence: clamp(strength + 15) };
}

export function calcBreakout(candles: Candle[]): IndicatorResult {
  if (candles.length < 20) {
    return { name: 'Breakout', signal: 'NEUTRAL', trend: 'LATERAL', strength: 0, score: 50, confidence: 30 };
  }
  const recent = candles.slice(-20, -1);
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const last = candles[candles.length - 1];
  const volAvg = recent.reduce((a, c) => a + c.volume, 0) / recent.length;
  const volConfirm = last.volume > volAvg * 1.3;
  const breakUp = last.close > high && volConfirm;
  const breakDown = last.close < low && volConfirm;
  const signal: IndicatorSignal = breakUp ? 'BUY' : breakDown ? 'SELL' : 'NEUTRAL';
  const trend = breakUp ? 'ALTA' : breakDown ? 'BAIXA' : 'LATERAL';
  const strength = volConfirm ? clamp(75) : 35;
  const score = signal !== 'NEUTRAL' ? clamp(70 + strength * 0.2) : 45;
  return { name: 'Breakout', signal, trend, strength, score, confidence: clamp(strength + 10) };
}

export function runAllIndicators(candles: Candle[]): IndicatorResult[] {
  return [
    calcRSI(candles), calcMACD(candles), calcEMA(candles), calcADX(candles),
    calcATR(candles), calcBollinger(candles), calcVolume(candles),
    calcPriceAction(candles), calcTrend(candles), calcPullback(candles), calcBreakout(candles),
  ];
}