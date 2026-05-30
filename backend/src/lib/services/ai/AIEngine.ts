
import { GoogleGenAI } from '@google/genai';
import { Candle, IndicatorResult } from '../indicators';
import { ConfluenceResult } from '../confluenceEngine';
import { StructureAnalysis } from '../../engines/MarketStructureEngine';
import { LiquidityAnalysis } from '../../engines/LiquidityEngine';
import { SmartMoneyAnalysis } from '../../engines/SmartMoneyEngine';
import { CandleAnalysis } from '../../engines/CandleAnalyzer';
import { ConfidenceResult } from '../../engines/SignalConfidenceEngine';
import { validateEnv } from '../security/envValidation';

export interface AIValidation {
  approved: boolean;
  winProbability: number;
  confidence: number;
  reason: string;
  source: 'gemini' | 'local';
  adjustments: string[];
}

export interface AIContext {
  symbol: string;
  timeframe: string;
  direction: 'BUY' | 'SELL';
  confluence: ConfluenceResult;
  candles: Candle[];
  rsiValue: number;
  mtfAligned: boolean;
  structure?: StructureAnalysis;
  liquidity?: LiquidityAnalysis;
  smc?: SmartMoneyAnalysis;
  candleAnalysis?: CandleAnalysis;
  confidence?: ConfidenceResult;
}

function getApiKey(): string | null {
  const key = validateEnv().geminiKey;
  if (!key || key === 'PLACEHOLDER_API_KEY') return null;
  return key;
}

function analyzeStructure(candles: Candle[], direction: 'BUY' | 'SELL'): { aligned: number; total: number } {
  const last5 = candles.slice(-5);
  const aligned = last5.filter((c) =>
    direction === 'BUY' ? c.close >= c.open : c.close <= c.open
  ).length;
  return { aligned, total: last5.length };
}

function isExhaustion(rsi: number, direction: 'BUY' | 'SELL'): boolean {
  if (direction === 'BUY' && rsi > 68) return true;
  if (direction === 'SELL' && rsi < 32) return true;
  return false;
}

function isOptimalRSI(rsi: number, direction: 'BUY' | 'SELL'): boolean {
  if (direction === 'BUY') return rsi >= 45 && rsi <= 62;
  return rsi >= 38 && rsi <= 55;
}

export function localAIValidate(ctx: AIContext): AIValidation {
  const { direction, confluence, candles, rsiValue, mtfAligned, structure, liquidity, smc, candleAnalysis, confidence } = ctx;
  const map: Record<string, IndicatorResult> = {};
  confluence.indicators.forEach((i) => {
    map[i.name] = i;
  });

  let winProb = confidence?.winProbability ?? 48;
  const adjustments: string[] = [...(confidence?.factors ?? [])];
  const trend = map['Tendência'];
  const pullback = map['Pullback'];
  const ema = map['EMA'];
  const macd = map['MACD'];
  const adx = map['ADX'];
  const breakout = map['Breakout'];
  const structureCandles = analyzeStructure(candles, direction);

  if (trend?.signal === direction) {
    winProb += 10;
    adjustments.push('Tendência principal alinhada (+10)');
  } else if (trend?.signal !== 'NEUTRAL' && trend?.signal !== direction) {
    winProb -= 18;
    adjustments.push('Contra-tendência (-18)');
  }

  if (pullback?.signal === direction) {
    winProb += 12;
    adjustments.push('Pullback ideal (+12)');
  }

  if (ema?.signal === direction) {
    winProb += 6;
    adjustments.push('EMA (+6)');
  }
  if (macd?.signal === direction) {
    winProb += 8;
    adjustments.push('MACD (+8)');
  } else if (macd?.signal !== 'NEUTRAL' && macd?.signal !== direction) {
    winProb -= 10;
    adjustments.push('MACD divergente (-10)');
  }

  if (isExhaustion(rsiValue, direction)) {
    winProb -= 25;
    adjustments.push(`RSI exaustão (${rsiValue.toFixed(1)}) (-25)`);
  } else if (isOptimalRSI(rsiValue, direction)) {
    winProb += 10;
    adjustments.push(`RSI ótimo (${rsiValue.toFixed(1)}) (+10)`);
  }

  if ((adx?.strength ?? 0) >= 22) {
    winProb += 6;
    adjustments.push('ADX força (+6)');
  }

  if (structureCandles.aligned >= 3) {
    winProb += 8;
    adjustments.push(`Estrutura ${structureCandles.aligned}/5 (+8)`);
  }

  if (mtfAligned) {
    winProb += 10;
    adjustments.push('MTF (+10)');
  }

  if (structure?.bos) {
    winProb += 8;
    adjustments.push('BOS (+8)');
  }
  if (liquidity?.sweepDetected && liquidity.sweepDirection === direction) {
    winProb += 12;
    adjustments.push('Liquidity sweep alinhado (+12)');
  }
  if (smc?.smcBias === 'ACUMULAÇÃO' && direction === 'BUY') {
    winProb += 8;
    adjustments.push('SMC acumulação (+8)');
  }
  if (smc?.smcBias === 'DISTRIBUIÇÃO' && direction === 'SELL') {
    winProb += 8;
    adjustments.push('SMC distribuição (+8)');
  }
  if (candleAnalysis?.fakeout) {
    winProb -= 15;
    adjustments.push('Fakeout detectado (-15)');
  }
  if (candleAnalysis?.impulse && candleAnalysis.direction === direction) {
    winProb += 10;
    adjustments.push('Impulso alinhado (+10)');
  }

  winProb = Math.max(0, Math.min(95, Math.round(winProb)));

  if (candleAnalysis?.fakeout) {
    winProb = Math.max(42, winProb - 8);
    adjustments.push('Fakeout — confiança reduzida (-8)');
  }
  if (isExhaustion(rsiValue, direction)) {
    winProb = Math.max(40, winProb - 10);
    adjustments.push('RSI exaustão — confiança reduzida (-10)');
  }

  const approved = true;

  return {
    approved,
    winProbability: winProb,
    confidence: Math.round((winProb + confluence.confidence) / 2),
    reason: `IA Operacional: ${winProb}% — classificação e ranqueamento (sem bloqueio)`,
    source: 'local',
    adjustments,
  };
}

const GEMINI_TIMEOUT_MS = 2_000;

async function geminiValidate(ctx: AIContext): Promise<AIValidation | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[AI PROVIDER] No API key configured, using local AI');
    return null;
  }

  const { symbol, timeframe, direction, confluence, rsiValue, mtfAligned, structure, liquidity, smc, candleAnalysis, confidence } = ctx;
  const type = direction === 'BUY' ? 'CALL' : 'PUT';

  console.log('[AI PROVIDER] Google Gemini');
  console.log('[AI MODEL] gemini-2.0-flash');
  console.log('[AI REQUEST] symbol=', symbol, 'timeframe=', timeframe, 'direction=', direction);

  const prompt = `Analista institucional. Avalie setup REAL em candles (sem garantir lucro).

Par: ${symbol} | TF: ${timeframe} | ${type}
Confluência: ${confluence.score}% | Segurança: ${confluence.securityScore}%
RSI: ${rsiValue.toFixed(1)} | MTF: ${mtfAligned ? 'Sim' : 'Não'}
Estrutura: ${structure?.trend} BOS:${structure?.bos} CHOCH:${structure?.choch}
Liquidez sweep: ${liquidity?.sweepDetected} | SMC: ${smc?.smcBias}
Candles: ${candleAnalysis?.pattern} vol:${candleAnalysis?.volatility}%
Confiança engine: ${confidence?.score}% class:${confidence?.classification}

Indicadores: ${confluence.indicators.map((i) => `${i.name}:${i.signal}`).join(', ')}

JSON apenas: {"approve":bool,"winProbability":0-95,"confidence":0-100,"reason":"pt curto"}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const geminiCall = ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { temperature: 0.15, maxOutputTokens: 280 },
    });

    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), GEMINI_TIMEOUT_MS)
    );
    const response = await Promise.race([geminiCall, timeout]);
    if (!response) {
      console.log('[AI TIMEOUT] Gemini request timed out after', GEMINI_TIMEOUT_MS, 'ms');
      return null;
    }

    const text = response.text?.trim() ?? '';
    console.log('[AI RESPONSE] raw text length=', text.length);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[AI ERROR] No JSON found in Gemini response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const winProbability = clamp(Number(parsed.winProbability) || 50, 0, 95);
    const conf = clamp(Number(parsed.confidence) || 50, 0, 100);
    const approve = Boolean(parsed.approve) && winProbability >= 55;

    console.log('[AI SUCCESS] Gemini validated - approved=', approve, 'winProbability=', winProbability, 'confidence=', conf);

    return {
      approved: approve,
      winProbability,
      confidence: conf,
      reason: parsed.reason || 'Gemini validou análise multi-engine',
      source: 'gemini',
      adjustments: [`Gemini: ${winProbability}%`, ...(confidence?.factors.slice(0, 2) ?? [])],
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log('[AI ERROR] Gemini failed:', err.message);
    console.log('[AI ERROR] Stack:', err.stack);
    if (err.message.includes('Permission denied') || err.message.includes('high demand')) {
      console.log('[AI ERROR] Model overloaded - falling back to local AI');
    }
    return null;
  }
}

/** Gemini opcional — falha ou timeout usa IA local sem interromper análise. */
export async function validateWithAI(
  ctx: AIContext,
  options?: { skipRemote?: boolean }
): Promise<AIValidation> {
  if (!options?.skipRemote) {
    const gemini = await geminiValidate(ctx);
    if (gemini) {
      console.log('[AI SOURCE] Using Gemini validation');
      return gemini;
    }
    console.log('[AI SOURCE] Gemini failed or skipped, using local AI');
  } else {
    console.log('[AI SOURCE] Remote AI skipped, using local AI');
  }
  const local = localAIValidate(ctx);
  console.log('[AI SOURCE] Local AI result - approved=', local.approved, 'winProbability=', local.winProbability, 'confidence=', local.confidence);
  return local;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Re-export for backward compatibility
export { validateWithAI as default };
