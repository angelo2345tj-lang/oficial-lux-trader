import { Candle } from '../indicators';
import { StructureAnalysis } from '../../engines/MarketStructureEngine';
import { LiquidityAnalysis } from '../../engines/LiquidityEngine';
import { SmartMoneyAnalysis } from '../../engines/SmartMoneyEngine';
import { CandleAnalysis } from '../../engines/CandleAnalyzer';

export interface InstitutionalContext {
  manipulation: boolean;
  institutionalSweep: boolean;
  absorption: boolean;
  exhaustion: boolean;
  volatilityCompression: boolean;
  imminentExpansion: boolean;
  mtfDivergence: boolean;
  macroBias: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  score: number;
  notes: string[];
}

export class InstitutionalAI {
  static analyze(
    candles: Candle[],
    structure: StructureAnalysis,
    liquidity: LiquidityAnalysis,
    smc: SmartMoneyAnalysis,
    candleAnalysis: CandleAnalysis,
    mtfAligned: boolean
  ): InstitutionalContext {
    const notes: string[] = [];
    let score = 50;

    const ranges = candles.slice(-20).map((c) => c.high - c.low);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const lastRange = ranges[ranges.length - 1] ?? 0;
    const volCompression = lastRange < avgRange * 0.5;
    const volExpansion = lastRange > avgRange * 1.8;

    const manipulation =
      candleAnalysis.manipulation ||
      (liquidity.sweepDetected && candleAnalysis.fakeout);

    const institutionalSweep = liquidity.sweepDetected && liquidity.score >= 65;
    const absorption =
      candleAnalysis.volatility > 120 &&
      !candleAnalysis.impulse &&
      liquidity.notes.some((n) => n.includes('absorção') || n.includes('Volume spike'));

    const exhaustion =
      candleAnalysis.pattern.includes('REVERSAL') &&
      (structure.choch || liquidity.sweepDetected);

    const imminentExpansion = volCompression && structure.bos;
    const mtfDivergence = !mtfAligned && structure.choch;

    let macroBias: InstitutionalContext['macroBias'] = 'NEUTRAL';
    if (structure.trend === 'BULLISH' && smc.smcBias === 'ACUMULAÇÃO') macroBias = 'RISK_ON';
    if (structure.trend === 'BEARISH' && smc.smcBias === 'DISTRIBUIÇÃO') macroBias = 'RISK_OFF';

    if (institutionalSweep) {
      score += 15;
      notes.push('Sweep institucional detectado');
    }
    if (absorption) {
      score += 10;
      notes.push('Absorção de volume');
    }
    if (exhaustion) {
      score += 8;
      notes.push('Exaustão de tendência');
    }
    if (volCompression) {
      score += 5;
      notes.push('Compressão de volatilidade');
    }
    if (imminentExpansion) {
      score += 12;
      notes.push('Expansão iminente pós-compressão');
    }
    if (manipulation) {
      score -= 20;
      notes.push('⚠ Possível manipulação — cautela');
    }
    if (mtfDivergence) {
      score -= 8;
      notes.push('Divergência multi-timeframe');
    }

    return {
      manipulation,
      institutionalSweep,
      absorption,
      exhaustion,
      volatilityCompression: volCompression,
      imminentExpansion,
      mtfDivergence,
      macroBias,
      score: Math.min(100, Math.max(0, score)),
      notes,
    };
  }
}
