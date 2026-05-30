import type { TradeSignal } from '../../types';
import type { InstitutionalStreamPayload } from '../api/institutionalStream';
import type { SignalResult } from '../strategy/RealSignalEngine';
import { invalidateSignal } from '../../src/state/signalStore';
import { clearAnalysisCache } from '../signals/analysisQueue';
import { disconnectInstitutionalStream } from '../api/institutionalStream';
import { isCanonicalSnapshotId, resolveSnapshotId } from './snapshotId';

export function isValidSignalResult(
  result: SignalResult | null | undefined,
  expectedSymbol: string
): boolean {
  if (!result?.signal) return false;
  if (result.status && result.status !== 'OK') return false;
  const conf = Number(result.confidence ?? result.score ?? result.signal.confidence ?? 0);
  if (conf <= 0) return false;
  const br = result.blockReason ?? '';
  if (
    br.includes('NO_PROVIDER') ||
    br.includes('Sem provider') ||
    br.includes('NO_MARKET_DATA') ||
    br.includes('MARKET_CLOSED') ||
    br.includes('INSUFFICIENT_CANDLES')
  ) {
    return false;
  }
  const snap = resolveSnapshotId(result.snapshotId, result.signal.id);
  if (!snap) return false;
  if (result.signal.asset.toUpperCase() !== expectedSymbol.toUpperCase()) return false;
  if (result.signal.type === 'NEUTRAL') return false;
  return true;
}

export function isValidInstitutionalPayload(
  payload: InstitutionalStreamPayload | null | undefined,
  expectedSymbol?: string
): boolean {
  if (!payload) return false;
  if (payload.status !== 'OK') return false;

  const blockReason = payload.blockReason ?? '';
  if (
    blockReason.includes('NO_PROVIDER') ||
    blockReason.includes('Sem provider') ||
    blockReason.includes('NO_MARKET_DATA') ||
    blockReason.includes('MARKET_CLOSED') ||
    blockReason.includes('INSUFFICIENT_CANDLES') ||
    blockReason.includes('symbol not mapped')
  ) {
    return false;
  }

  if (!isCanonicalSnapshotId(payload.snapshotId)) return false;

  const confidence = Number(payload.confidence ?? payload.signal?.confidence ?? payload.signal?.score ?? 0);
  if (confidence <= 0) return false;

  const signal = payload.signal;
  if (!signal || signal.type === 'NEUTRAL') return false;

  const sym = (payload.symbol ?? signal.asset)?.toUpperCase();
  if (expectedSymbol && sym && sym !== expectedSymbol.toUpperCase()) return false;

  return true;
}

export function clearInstitutionalClientState(symbol?: string): void {
  invalidateSignal();
  clearAnalysisCache();
  if (symbol) {
    console.log('[Lux:UI] cleared signal state', symbol);
  }
}

export function resetAssetInstitutionalState(symbol: string, timeframe: string): void {
  clearInstitutionalClientState(symbol);
  disconnectInstitutionalStream();
  console.log('[Lux:UI] asset reset', symbol, timeframe);
}

export function normalizeCommittedSignal(signal: TradeSignal): TradeSignal {
  const confidence = Number(signal.confidence ?? signal.score ?? 0);
  return {
    ...signal,
    confidence,
    score: confidence,
    timestamp: signal.timestamp ? new Date(signal.timestamp as unknown as string) : new Date(),
  };
}
