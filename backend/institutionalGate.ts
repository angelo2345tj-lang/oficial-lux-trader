import { SignalTimingMode } from '../../types';

import { AIValidation } from './AIEngine';

import { ConfluenceResult } from '../confluenceEngine';

import { StructureAnalysis } from '../../engines/MarketStructureEngine';

import { CandleAnalysis } from '../../engines/CandleAnalyzer';

import { EnsembleResult } from '../../engines/operational/ensembleAnalysis';



export type InstitutionalStrength = 'ELITE' | 'STRONG' | 'MODERATE' | 'WEAK';



export interface InstitutionalGateInput {

  timingMode: SignalTimingMode;

  blendedScore: number;

  ensemble: EnsembleResult;

  ai: AIValidation;

  structure: StructureAnalysis;

  candleAnalysis: CandleAnalysis;

  confluence: ConfluenceResult;

  mtfAligned: boolean;

  rsiValue: number;

  direction: 'BUY' | 'SELL';

}



export interface InstitutionalGateResult {

  pass: boolean;

  strength: InstitutionalStrength;

  operationalProbability: number;

  reasons: string[];

  /** Apenas informativo — não bloqueia emissão de sinal */

  advisory?: string;

}



function classifyStrength(

  winProb: number,

  confluenceCount: number,

  agreement: number

): InstitutionalStrength {

  if (winProb >= 78 && confluenceCount >= 4 && agreement >= 55) return 'ELITE';

  if (winProb >= 68 && confluenceCount >= 3 && agreement >= 45) return 'STRONG';

  if (winProb >= 55 && agreement >= 28) return 'MODERATE';

  return 'WEAK';

}



/**

 * Ranqueia qualidade operacional — NÃO bloqueia sinais por score fixo.

 * Prioriza setups fortes; setups fracos seguem com classificação WEAK/MODERATE.

 */

export function evaluateInstitutionalSetup(

  input: InstitutionalGateInput

): InstitutionalGateResult {

  const {

    blendedScore,

    ensemble,

    ai,

    structure,

    candleAnalysis,

    confluence,

    mtfAligned,

    rsiValue,

    direction,

  } = input;



  const reasons: string[] = [];

  const advisories: string[] = [];

  const confluenceCount = confluence.confluences?.length ?? 0;

  const operationalProbability = Math.round(

    (ai.winProbability * 0.55 + blendedScore * 0.25 + ensemble.agreement * 0.2)

  );



  if (candleAnalysis.fakeout) {

    advisories.push('Fakeout monitorado — aguarde confirmação extra');

  }



  if (structure.trend === 'RANGE' && !structure.bos && !structure.choch) {

    advisories.push('Mercado lateral — reduzir lote');

  }



  const rsiExhausted =

    (direction === 'BUY' && rsiValue > 72) || (direction === 'SELL' && rsiValue < 28);

  if (rsiExhausted) {

    advisories.push('RSI em zona de exaustão');

  }



  if (confluence.blocked) {

    advisories.push('Confluência parcial — ranqueamento conservador');

  }



  if (ensemble.agreement < 25) {

    advisories.push('Convergência moderada entre engines');

  }



  if (!ai.approved) {

    advisories.push(ai.reason || 'Validação IA com ressalvas');

  }



  if (mtfAligned) reasons.push('MTF alinhado');

  if (structure.bos) reasons.push('BOS confirmado');

  if (confluenceCount >= 3) reasons.push(`${confluenceCount} confluências`);

  if (confluenceCount >= 1) {

    const tags = confluence.confluences?.slice(0, 4) ?? [];

    reasons.push(...tags);

  }

  reasons.push('RSI', 'MACD', 'EMA 8/21/50', 'Bollinger', 'ADX', 'Momentum');

  if (ai.source === 'gemini') reasons.push('Validação Gemini');

  else reasons.push('Validação IA local');



  const strength = classifyStrength(

    operationalProbability,

    confluenceCount,

    ensemble.agreement

  );



  return {

    pass: true,

    strength,

    operationalProbability: Math.min(97, Math.max(42, operationalProbability)),

    reasons: reasons.slice(0, 8),

    advisory: advisories.length ? advisories.join(' · ') : undefined,

  };

}

