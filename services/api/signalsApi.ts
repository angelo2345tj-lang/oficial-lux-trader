import { SignalTimingMode, TradeSignal } from '../../types';
import { RealSignalEngine, SignalResult } from '../strategy/RealSignalEngine';
import { enqueueAnalysis, clearAnalysisCache } from '../signals/analysisQueue';
import { getProviderForSymbol, fetchCandles } from '../marketData';
import {
  normalizeAnalyzePayload,
  type RawAnalyzeBody,
  type NormalizedAnalyzePayload,
} from './analyzePayload';
import { apiFetch, endpoints, isRemoteApiEnabled } from '../../src/config/api';
import {
  API_ENABLED,
  logRemoteApiMode,
  safeApiCallOptional,
} from '../../src/config/safeApi';
import { withRequestDedup, cancelInflight } from '../../src/config/requestManager';
import { isCanonicalSnapshotId } from '../institutional/snapshotId';
import { normalizeBlockReasonCode } from '../institutional/blockReasonUI';
import {
  logAnalyzeInput,
  resolveAnalyzeOrigin,
  type AnalyzeOrigin,
} from '../institutional/analyzeOrigin';

const API_TIMEOUT_MS = 18_000;
const HEALTH_TIMEOUT_MS = 3_000;

let analyzeGeneration = 0;

logRemoteApiMode();

export interface AnalyzePayload extends RawAnalyzeBody {
  symbol?: string;
  asset?: string;
  timeframe?: string;
  balance?: number;
  riskPercent?: number;
  livePrice?: number;
  timingMode?: SignalTimingMode;
  forceRest?: boolean;
  analyzeOrigin?: AnalyzeOrigin | string;
}

function analyzeKey(p: NormalizedAnalyzePayload) {
  return `${p.symbol}:${p.timeframe}:${p.timingMode}`;
}

async function analyzeLocal(body: NormalizedAnalyzePayload): Promise<SignalResult> {
  return RealSignalEngine.analyze(
    body.symbol,
    body.balance,
    body.riskPercent,
    body.timeframe,
    body.livePrice,
    body.timingMode
  );
}

/** Fallback local quando API remota falha mas Binance público ainda responde (crypto). */
function shouldTryLocalFallback(
  result: SignalResult | null | undefined,
  symbol: string
): boolean {
  if (result?.status === 'OK' && result.signal) return false;
  const code = normalizeBlockReasonCode(result?.blockReason);
  if (
    code === 'NO_PROVIDER' ||
    code === 'MARKET_CLOSED' ||
    code === 'NO_CONSENSUS'
  ) {
    return false;
  }
  return getProviderForSymbol(symbol) === 'binance';
}

function reviveSignal(raw: TradeSignal | null): TradeSignal | null {
  if (!raw) return null;
  return {
    ...raw,
    timestamp: raw.timestamp
      ? new Date(raw.timestamp as unknown as string)
      : new Date(),
  };
}

function snapshotBarTs(snapshotId: string): number {
  const m = /^[A-Z0-9]{3,12}_\d+_(\d+)$/i.exec(snapshotId.trim());
  return m ? Number(m[1]) : 0;
}

let lastRestAnalyzedBarTs = 0;

export function markRestAnalyzedSnapshot(snapshotId: string | undefined): void {
  const barTs = snapshotId ? snapshotBarTs(snapshotId) : 0;
  if (barTs > 0) {
    lastRestAnalyzedBarTs = barTs;
    console.log(`[Lux:AnalyzeResult] client marked barTs=${barTs} snap=${snapshotId}`);
  }
}

function mapApiToSignalResult(
  data: SignalResult & {
    confidence?: number;
    score?: number;
    status?: string;
    snapshotId?: string;
    success?: boolean;
  },
  _expectedSymbol: string
): SignalResult {
  const status = (data.status as SignalResult['status']) ?? (data.success === false ? 'NO_DATA' : undefined);
  const snapshotId = data.snapshotId ?? '';

  const confidence = Number(data.confidence ?? data.score ?? data.signal?.confidence ?? 0);
  const br = data.blockReason ?? '';
  let blockCode = normalizeBlockReasonCode(br);
  if (snapshotId.includes('_nodata') && blockCode === 'NO_MARKET_DATA') {
    blockCode = br.toUpperCase().includes('NO_PROVIDER') ? 'NO_PROVIDER' : 'PROVIDER_ERROR';
  }

  const reject =
    status === 'NO_DATA' ||
    status === 'BLOCKED' ||
    data.success === false ||
    !isCanonicalSnapshotId(snapshotId) ||
    confidence <= 0 ||
    !data.signal ||
    blockCode === 'NO_PROVIDER' ||
    blockCode === 'NO_MARKET_DATA' ||
    blockCode === 'MARKET_CLOSED' ||
    blockCode === 'INSUFFICIENT_CANDLES' ||
    blockCode === 'PROVIDER_ERROR' ||
    blockCode === 'INVALID_SNAPSHOT' ||
    blockCode === 'NO_CONSENSUS' ||
    blockCode === 'SIGNAL_UNAVAILABLE' ||
    snapshotId.includes('_nodata');

  if (reject) {
    const mapped: SignalResult = {
      signal: null,
      status: status === 'BLOCKED' ? 'BLOCKED' : 'NO_DATA',
      confidence: 0,
      score: 0,
      blockReason: blockCode,
      snapshotId,
      dataSource: 'institutional-api',
    };
    console.log(
      `[Lux:AnalyzeResult] api-mapped NO_DATA snap=${snapshotId} reason=${mapped.blockReason} raw=${br}`
    );
    return mapped;
  }

  const signal = reviveSignal(data.signal);
  markRestAnalyzedSnapshot(snapshotId);

  const mapped: SignalResult = {
    ...data,
    signal: signal ? { ...signal, score: confidence, confidence } : null,
    score: confidence,
    confidence,
    status: 'OK',
    snapshotId,
    dataSource: 'institutional-api',
  };
  console.log(
    `[Lux:AnalyzeResult] api-mapped OK snap=${snapshotId} conf=${confidence}% dir=${mapped.signal?.type}`
  );
  return mapped;
}

async function requestInstitutionalAnalyze(
  payload: NormalizedAnalyzePayload,
  generation: number,
  origin: AnalyzeOrigin
): Promise<SignalResult | null> {
  console.log('[TRACE] requestInstitutionalAnalyze called - payload.symbol=', payload.symbol, ' generation=', generation, ' origin=', origin, ' API_ENABLED=', API_ENABLED);
  if (!API_ENABLED) {
    console.log('[TRACE] requestInstitutionalAnalyze API NOT enabled, returning null');
    return null;
  }

  logAnalyzeInput(origin, payload.symbol, payload.timeframe, `mode=${payload.timingMode}`);

  const dedupKey = `analyze:${payload.symbol}:${payload.timeframe}:${payload.timingMode}`;
  console.log('[TRACE] requestInstitutionalAnalyze dedupKey=', dedupKey);

  return safeApiCallOptional(async () => {
    console.log('[TRACE] requestInstitutionalAnalyze calling apiFetch');
    const res = await withRequestDedup(dedupKey, (signal) =>
      apiFetch(endpoints.signalsAnalyze(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: payload.symbol,
          asset: payload.symbol,
          timeframe: payload.timeframe,
          balance: payload.balance,
          riskPercent: payload.riskPercent,
          livePrice: payload.livePrice,
          timingMode: payload.timingMode,
          streamLive: true,
          analyzeOrigin: origin,
        }),
        timeoutMs: API_TIMEOUT_MS,
        retries: 0,
        retryDelayMs: 0,
        noStore: true,
        signal,
      })
    );
    console.log('[TRACE] requestInstitutionalAnalyze apiFetch returned - res.ok=', res.ok, ' res.status=', res.status);

    if (generation !== analyzeGeneration) {
      console.log('[TRACE] requestInstitutionalAnalyze stale response discarded - generation mismatch');
      console.log('[Lux:Signal] stale analyze response discarded', payload.symbol);
      return null;
    }

    const data = (await res.json().catch(() => ({}))) as SignalResult & {
      success?: boolean;
      message?: string;
      snapshotId?: string;
    };
    console.log('[TRACE] requestInstitutionalAnalyze data parsed - status=', data.status, ' blockReason=', data.blockReason);

    if (!res.ok) {
      const message = data.message || data.blockReason || `API ${res.status}`;
      console.log('[TRACE] requestInstitutionalAnalyze API error - message=', message);
      throw new Error(message);
    }

    const mapped = mapApiToSignalResult(data, payload.symbol);
    console.log(
      `[Lux:Signal] institutional ${payload.symbol} snap=${mapped.snapshotId ?? '—'} status=${mapped.status} conf=${mapped.confidence ?? 0}%`
    );
    return mapped;
  });
}

async function analyzeCentralized(
  body: NormalizedAnalyzePayload,
  origin: AnalyzeOrigin
): Promise<SignalResult> {
  console.log('[TRACE] analyzeCentralized called - body.symbol=', body.symbol, ' origin=', origin, ' API_ENABLED=', API_ENABLED);
  const generation = ++analyzeGeneration;
  console.log('[TRACE] analyzeCentralized generation=', generation);

  if (!API_ENABLED) {
    console.log('[TRACE] analyzeCentralized API NOT enabled, using local engine');
    const local = await analyzeLocal(body);
    if (generation !== analyzeGeneration) {
      console.log('[TRACE] analyzeCentralized local superseded - generation mismatch');
      return {
        signal: null,
        blockReason: 'ANALYSIS_SUPERSEDED',
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
      };
    }
    console.log(
      `[Lux:Signal] local-engine ${body.symbol} status=${local.status} conf=${local.confidence ?? 0}%`
    );
    return local;
  }

  console.log('[TRACE] analyzeCentralized calling requestInstitutionalAnalyze');
  const api = await requestInstitutionalAnalyze(body, generation, origin);
  console.log('[TRACE] analyzeCentralized API returned - status=', api?.status, ' blockReason=', api?.blockReason);

  if (generation !== analyzeGeneration) {
    console.log('[TRACE] analyzeCentralized API superseded - generation mismatch');
    return {
      signal: null,
      blockReason: 'ANALYSIS_SUPERSEDED',
      status: 'NO_DATA',
      confidence: 0,
      score: 0,
    };
  }

  if (api?.status === 'OK' && api.signal) {
    console.log('[TRACE] analyzeCentralized API OK with signal, returning');
    return api;
  }

  if (shouldTryLocalFallback(api, body.symbol)) {
    console.log('[TRACE] analyzeCentralized trying local fallback');
    const local = await analyzeLocal(body);
    if (generation !== analyzeGeneration) {
      console.log('[TRACE] analyzeCentralized local fallback superseded - generation mismatch');
      return {
        signal: null,
        blockReason: 'ANALYSIS_SUPERSEDED',
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
      };
    }
    if (local.status === 'OK' && local.signal) {
      console.log(
        `[Lux:Signal] local-fallback OK ${body.symbol} conf=${local.confidence ?? 0}% (api=${api?.blockReason ?? 'null'})`
      );
      return { ...local, dataSource: 'local-fallback' };
    }
  }

  if (api) {
    console.log('[TRACE] analyzeCentralized returning API result (no signal)');
    return api;
  }

  console.log('[TRACE] analyzeCentralized returning NO_DATA - API unavailable');
  return {
    signal: null,
    status: 'NO_DATA',
    confidence: 0,
    score: 0,
    blockReason: 'Institutional API indisponível',
    timingMode: body.timingMode,
    dataSource: 'api-error',
  };
}

export function cancelPendingAnalysis(symbol?: string, timeframe?: string): void {
  analyzeGeneration += 1;
  if (symbol && timeframe) {
    cancelInflight(`analyze:${symbol}:${timeframe}:INSTANT`);
    cancelInflight(`analyze:${symbol}:${timeframe}:CONFIRMED`);
  } else {
    clearAnalysisCache();
  }
}

export async function analyzeSignal(
  payload: AnalyzePayload
): Promise<SignalResult & { success?: boolean; message?: string }> {
  console.log('[TRACE] analyzeSignal called - payload.symbol=', payload.symbol);
  const normalized = normalizeAnalyzePayload(payload);
  if (!normalized.ok) {
    console.log('[TRACE] analyzeSignal normalized FAILED - message=', normalized.message);
    return {
      signal: null,
      blockReason: normalized.message,
      success: false,
      message: normalized.message,
      status: 'NO_DATA',
      confidence: 0,
    };
  }

  console.log('[TRACE] analyzeSignal normalized OK');
  const body = normalized.payload;
  const origin = resolveAnalyzeOrigin(payload.analyzeOrigin);
  const key = analyzeKey(body);
  console.log('[TRACE] analyzeSignal key=', key, ' origin=', origin);

  console.log('[TRACE] analyzeSignal calling enqueueAnalysis with origin=', origin);
  const result = await enqueueAnalysis(key, () => analyzeCentralized(body, origin), origin);

  if (!result) {
    console.log('[TRACE] analyzeSignal enqueueAnalysis returned null - ANALYSIS_BUSY');
    return {
      signal: null,
      blockReason: 'ANALYSIS_BUSY',
      success: false,
      message: 'ANALYSIS_BUSY',
    };
  }

  console.log('[TRACE] analyzeSignal returning result - status=', result.status, ' blockReason=', result.blockReason);
  return result;
}

export async function checkApiHealth(): Promise<boolean> {
  if (!API_ENABLED) {
    try {
      await fetchCandles('BTCUSD', '15', 5, false);
      return true;
    } catch {
      return false;
    }
  }

  return safeApiCallOptional(async () => {
    const res = await apiFetch(endpoints.health(), {
      method: 'GET',
      timeoutMs: HEALTH_TIMEOUT_MS,
      retries: 0,
      noStore: true,
    });
    return res.ok;
  }).then((ok) => ok === true);
}

export async function isMarketDataLive(): Promise<boolean> {
  return checkApiHealth();
}

export { isRemoteApiEnabled, API_ENABLED };
