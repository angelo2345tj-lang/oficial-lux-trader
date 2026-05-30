/** Logs verbosos (cache/tick/refresh) — desligado em produção. */
export const LUX_REALTIME_DEBUG =
  typeof import.meta !== 'undefined' &&
  (import.meta as ImportMeta & { env?: { VITE_LUX_DEBUG?: string } }).env?.VITE_LUX_DEBUG ===
    'true';

export const REAL_TICK_STALE_MS = 20_000;
export const ANALYSIS_TIMEOUT_MS = 12_000;
/** Gap mínimo entre qualquer análise (manual ou auto). */
export const ANALYSIS_MIN_GAP_MS = 3_000;
/** Auto-scan / candle-close / boot — no máximo 1 análise por intervalo. */
export const AUTO_ANALYSIS_MIN_GAP_MS = 25_000;
export const REFRESH_COOLDOWN_MS = 60_000;
/** Recovery REST/WS — no máximo 1 por minuto. */
export const RECOVERY_COOLDOWN_MS = 60_000;
export const CACHE_MERGE_THROTTLE_MS = 250;
