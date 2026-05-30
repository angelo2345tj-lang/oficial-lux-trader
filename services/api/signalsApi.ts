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
  // Allow fallback for PROVIDER_ERROR since candles may still be available
  // Only block fallback for truly unrecoverable errors
  if (
    code === 'MARKET_CLOSED' ||
    code === 'NO_CONSENSUS'
  ) {
    return false;
  }
  // Try fallback if provider is binance (crypto has public data)
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
  console.log('[Lux:API] requestInstitutionalAnalyze - symbol=', payload.symbol, ' timeframe=', payload.timeframe, ' API_ENABLED=', API_ENABLED);
  if (!API_ENABLED) {
    console.log('[Lux:API] API NOT enabled, returning null for local fallback');
    return null;
  }

  logAnalyzeInput(origin, payload.symbol, payload.timeframe, `mode=${payload.timingMode}`);

  const dedupKey = `analyze:${payload.symbol}:${payload.timeframe}:${payload.timingMode}`;

  return safeApiCallOptional(async () => {
    console.log('[Lux:API] calling institutional API endpoint');
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
    console.log('[Lux:API] API response - res.ok=', res.ok, ' res.status=', res.status);

    if (generation !== analyzeGeneration) {
      console.log('[Lux:API] stale response discarded - generation mismatch');
      console.log('[Lux:Signal] stale analyze response discarded', payload.symbol);
      return null;
    }

    const data = (await res.json().catch(() => ({}))) as SignalResult & {
      success?: boolean;
      message?: string;
      snapshotId?: string;
      candleCount?: number;
    };
    console.log('[Lux:API] API data - status=', data.status, ' blockReason=', data.blockReason, ' snapshotId=', data.snapshotId, ' candleCount=', data.candleCount);

    if (!res.ok) {
      const message = data.message || data.blockReason || `API ${res.status}`;
      console.log('[Lux:API] API error - message=', message);
      throw new Error(message);
    }

    const mapped = mapApiToSignalResult(data, payload.symbol);
    console.log(
      `[Lux:API] institutional result - symbol=${payload.symbol} snap=${mapped.snapshotId ?? '—'} status=${mapped.status} conf=${mapped.confidence ?? 0}% blockReason=${mapped.blockReason ?? 'none'} candleCount=${data.candleCount ?? 'N/A'}`
    );
    return mapped;
  });
}

async function analyzeCentralized(
  body: NormalizedAnalyzePayload,
  origin: AnalyzeOrigin
): Promise<SignalResult> {
  console.log('[Lux:Analyze] analyzeCentralized - symbol=', body.symbol, ' timeframe=', body.timeframe, ' API_ENABLED=', API_ENABLED);
  const generation = ++analyzeGeneration;

  if (!API_ENABLED) {
    console.log('[Lux:Analyze] API NOT enabled, using local engine');
    const local = await analyzeLocal(body);
    if (generation !== analyzeGeneration) {
      console.log('[Lux:Analyze] local superseded - generation mismatch');
      return {
        signal: null,
        blockReason: 'ANALYSIS_SUPERSEDED',
        status: 'NO_DATA',
        confidence: 0,
        score: 0,
      };
    }
    console.log(
      `[Lux:Analyze] local-engine result - symbol=${body.symbol} status=${local.status} conf=${local.confidence ?? 0}%`
    );
    return local;
  }

  console.log('[Lux:Analyze] calling institutional API');
  const api = await requestInstitutionalAnalyze(body, generation, origin);
  console.log('[Lux:Analyze] API returned - status=', api?.status, ' blockReason=', api?.blockReason);

  if (generation !== analyzeGeneration) {
    console.log('[Lux:Analyze] API superseded - generation mismatch');
    return {
      signal: null,
      blockReason: 'ANALYSIS_SUPERSEDED',
      status: 'NO_DATA',
      confidence: 0,
      score: 0,
    };
  }

  if (api?.status === 'OK' && api.signal) {
    console.log('[Lux:Analyze] API OK with signal, returning');
    return api;
  }

  // Check if local fallback should be attempted
  const shouldFallback = shouldTryLocalFallback(api, body.symbol);
  console.log('[Lux:Analyze] shouldTryLocalFallback=', shouldFallback, ' symbol=', body.symbol, ' api.blockReason=', api?.blockReason, ' api.snapshotId=', api?.snapshotId);

  if (shouldFallback) {
    console.log('[Lux:Analyze] API failed, attempting local fallback');
    const local = await analyzeLocal(body);
    if (generation !== analyzeGeneration) {
      console.log('[Lux:Analyze] local fallback superseded - generation mismatch');
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
        `[Lux:Analyze] local-fallback SUCCESS - symbol=${body.symbol} conf=${local.confidence ?? 0}% (api.blockReason=${api?.blockReason ?? 'null'})`
      );
      return { ...local, dataSource: 'local-fallback' };
    }
    console.log('[Lux:Analyze] local-fallback FAILED - local.status=', local.status, ' local.blockReason=', local.blockReason);
  }

  if (api) {
    console.log('[Lux:Analyze] returning API result (no signal) - blockReason=', api.blockReason);
    return api;
  }

  console.log('[Lux:Analyze] returning NO_DATA - API unavailable');
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
  console.log('[Lux:Analyze] analyzeSignal - symbol=', payload.symbol, ' timeframe=', payload.timeframe);
  const normalized = normalizeAnalyzePayload(payload);
  if (!normalized.ok) {
    console.log('[Lux:Analyze] normalized FAILED - message=', normalized.message);
    return {
      signal: null,
      blockReason: normalized.message,
      success: false,
      message: normalized.message,
      status: 'NO_DATA',
      confidence: 0,
    };
  }

  const body = normalized.payload;
  const origin = resolveAnalyzeOrigin(payload.analyzeOrigin);
  const key = analyzeKey(body);
  console.log('[Lux:Analyze] cache key=', key, ' origin=', origin);

  const result = await enqueueAnalysis(key, () => analyzeCentralized(body, origin), origin);

  if (!result) {
    console.log('[Lux:Analyze] enqueueAnalysis returned null - ANALYSIS_BUSY');
    return {
      signal: null,
      blockReason: 'ANALYSIS_BUSY',
      success: false,
      message: 'ANALYSIS_BUSY',
    };
  }

  console.log('[Lux:Analyze] final result - symbol=', payload.symbol, ' status=', result.status, ' blockReason=', result.blockReason, ' dataSource=', result.dataSource);
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
