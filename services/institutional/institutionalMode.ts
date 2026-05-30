import { API_ENABLED } from '../../src/config/safeApi';

/**
 * Modo institucional: sinais SOMENTE via API + stream.
 * RealtimeOrchestrator permanece apenas para candles/gráfico (sem análise local).
 */
export const INSTITUTIONAL_SIGNALS_ONLY = API_ENABLED;

export function shouldRunLocalSignalEngine(): boolean {
  return !INSTITUTIONAL_SIGNALS_ONLY;
}

export function shouldAutoRefreshFromCandles(): boolean {
  return !INSTITUTIONAL_SIGNALS_ONLY;
}
