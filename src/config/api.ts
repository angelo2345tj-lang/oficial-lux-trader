/**
 * Configuração central de API — dev (proxy Vite), same-origin (rewrites Vercel/Netlify)
 * ou cross-origin (frontend e API em domínios separados).
 */

const API_V1_PATH = '/api/v1';

/** API NestJS em produção (Render); sobrescreva com VITE_API_ORIGIN ou VITE_API_URL. */
const DEFAULT_PROD_API_ORIGIN = 'https://lux-trader-api.onrender.com';

const FRONTEND_VERCEL_ORIGIN = 'https://oficial-lux-trader.vercel.app';

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function readEnv(key: string): string | undefined {
  if (typeof import.meta === 'undefined') return undefined;
  const v = import.meta.env?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * API remota (NestJS) — desligada por padrão em dev (offline-first).
 * Ative com VITE_ENABLE_REMOTE_API=true ou URL absoluta em produção.
 */
export function isRemoteApiEnabled(): boolean {
  const flag = readEnv('VITE_ENABLE_REMOTE_API');
  if (flag === 'true') return true;
  if (flag === 'false') return false;

  const apiUrl = readEnv('VITE_API_URL');
  const apiOrigin = readEnv('VITE_API_ORIGIN');
  if (apiUrl && isAbsoluteUrl(apiUrl)) return true;
  if (apiOrigin && isAbsoluteUrl(apiOrigin)) return true;

  /** Produção: sinais centralizados no backend (cross-device determinístico). */
  if (import.meta.env?.PROD) return true;

  return false;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Origem da API (scheme + host), vazio = mesma origem do frontend. */
export function resolveApiOrigin(): string {
  const apiUrl = readEnv('VITE_API_URL');
  const apiOrigin = readEnv('VITE_API_ORIGIN');

  if (apiUrl && isAbsoluteUrl(apiUrl)) {
    try {
      return trimSlash(new URL(apiUrl).origin);
    } catch {
      /* fall through */
    }
  }

  if (apiOrigin && isAbsoluteUrl(apiOrigin)) {
    return trimSlash(apiOrigin);
  }

  if (import.meta.env?.DEV) {
    return '';
  }

  if (apiUrl?.startsWith('/')) {
    return '';
  }

  return DEFAULT_PROD_API_ORIGIN;
}

/** Base versionada da API NestJS (`/api/v1` ou URL absoluta equivalente). */
export function resolveApiV1Base(): string {
  const apiUrl = readEnv('VITE_API_URL');

  if (apiUrl) {
    if (isAbsoluteUrl(apiUrl)) {
      const base = trimSlash(apiUrl);
      return base.endsWith(API_V1_PATH) ? base : `${base}${API_V1_PATH}`;
    }
    if (apiUrl.startsWith('/')) {
      return apiUrl.replace(/\/+$/, '') || API_V1_PATH;
    }
  }

  const origin = resolveApiOrigin();
  if (!origin) return API_V1_PATH;
  return `${origin}${API_V1_PATH}`;
}

export const API_ORIGIN = resolveApiOrigin();
export const BASE_API_URL = resolveApiV1Base();
export const API_BASE = BASE_API_URL;

export const endpoints = {
  health: () => {
    const origin = resolveApiOrigin();
    if (!origin) return '/health';
    return `${origin}/health`;
  },
  signalsAnalyze: () => `${resolveApiV1Base()}/signals/analyze`,
  signalsLatest: (symbol: string, timeframe: string) =>
    `${resolveApiV1Base()}/signals/latest?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
  signals: (path = '') => {
    const base = resolveApiV1Base();
    const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    return `${base}/signals${suffix}`;
  },
} as const;

export const HEALTH_URL = endpoints.health();

/** Converte origem HTTP(S) em WebSocket (API própria, se existir no futuro). */
export function resolveApiWebSocketUrl(path = ''): string {
  const origin = resolveApiOrigin();
  if (!origin) {
    const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof location !== 'undefined' ? location.host : 'localhost:3001';
    return `${proto}://${host}${path}`;
  }
  const wsOrigin = origin.replace(/^http/i, 'ws');
  return `${wsOrigin}${path}`;
}

/** WebSocket de mercado (Binance) — sempre wss em produção. */
export function resolveBinanceWsUrl(stream: string, interval: string): string {
  return `wss://stream.binance.com:9443/ws/${stream}@kline_${interval}`;
}

export const isCrossOriginApi = (): boolean => {
  const base = resolveApiV1Base();
  return isAbsoluteUrl(base);
};

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
  /** Análises e health não devem ser cacheados. */
  noStore?: boolean;
}

const DEFAULT_RETRY_STATUSES = [502, 503, 504, 429];

function isRetryableStatus(status: number, retryOn: number[]): boolean {
  return retryOn.includes(status);
}

function mergeSignals(
  ...signals: (AbortSignal | null | undefined)[]
): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => s != null);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(valid);
  }
  const controller = new AbortController();
  for (const sig of valid) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

/**
 * fetch com timeout, retry limitado e cache desabilitado para rotas sensíveis.
 */
export async function apiFetch(
  input: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  if (!isRemoteApiEnabled()) {
    throw new Error('REMOTE_API_DISABLED');
  }

  const {
    timeoutMs = 12_000,
    retries = 1,
    retryDelayMs = 900,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
    noStore = true,
    signal: userSignal,
    ...init
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    const signal = mergeSignals(userSignal, controller.signal);
    const backoff = retryDelayMs * Math.pow(2, attempt);

    try {
      const res = await fetch(input, {
        ...init,
        signal,
        cache: noStore ? 'no-store' : init.cache,
        headers: {
          ...init.headers,
        },
      });

      if (!res.ok && attempt < retries && isRetryableStatus(res.status, retryOnStatuses)) {
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      return res;
    } catch (e) {
      lastError = e;
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, backoff));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha na requisição à API');
}

export async function parseApiError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}));
  const body = err as { message?: string | string[]; blockReason?: string };
  if (body.blockReason) return body.blockReason;
  if (Array.isArray(body.message)) return body.message.join(', ');
  if (body.message) return body.message;
  return `API ${res.status}`;
}

/** Origens permitidas no backend (documentação / deploy). */
export const CORS_FRONTEND_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  FRONTEND_VERCEL_ORIGIN,
] as const;

export default BASE_API_URL;
