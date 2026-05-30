import { API_ENABLED } from '../../src/config/safeApi';

/**
 * Modo institucional: sinais SOMENTE via API + stream.
 * RealtimeOrchestrator permanece apenas para candles/gráfico (sem análise local).
 * 
 * MODIFICADO: Habilitar motor local como fallback quando API institucional falhar.
 */
export const INSTITUTIONAL_SIGNALS_ONLY = false; // Forçar motor local habilitado

export function shouldRunLocalSignalEngine(): boolean {
  return true; // Sempre habilitar motor local para fallback
}

export function shouldAutoRefreshFromCandles(): boolean {
  return true; // Sempre permitir auto-refresh de candles
}
