import { Injectable } from '@nestjs/common';
import { SignalAnalysisService } from '../services/signal-analysis.service';
import { AnalyzeSignalDto } from './dto/analyze-signal.dto';
import { normalizeAnalyzePayload } from '../lib/utils/analyzePayload';

@Injectable()
export class SignalsService {
  private readonly analysis = new SignalAnalysisService();

  analyze(dto: AnalyzeSignalDto) {
    const normalized = normalizeAnalyzePayload(dto);

    if (!normalized.ok) {
      const errMsg = 'message' in normalized ? normalized.message : 'Ativo não informado';
      return {
        success: false,
        message: errMsg,
        signal: null,
        blockReason: errMsg,
        status: 'NO_DATA',
      };
    }

    return this.analysis.analyze(normalized.payload);
  }

  getLatest(symbol: string, timeframe?: string) {
    if (!symbol?.trim()) {
      return { success: false, message: 'symbol required' };
    }
    return this.analysis.getLatest(symbol, timeframe);
  }
}
