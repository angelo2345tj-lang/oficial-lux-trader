/**
 * Espelho servidor — estado WS mobile (logs / telemetria).
 * O stream real Binance vive no cliente; este módulo evita sockets duplicados no backend.
 */
import { logger } from '../logger';

export type MobileSocketPhase = 'idle' | 'background' | 'foreground' | 'reconnecting';

let phase: MobileSocketPhase = 'idle';
let lastSymbol = '';
let lastTimeframe = '';

export const mobileInstitutionalSocketServer = {
  setPhase(next: MobileSocketPhase): void {
    phase = next;
    logger.info(`[Lux:Socket] phase=${next}`, 'WS');
  },

  trackConnection(symbol: string, timeframe: string): void {
    lastSymbol = symbol;
    lastTimeframe = timeframe;
    logger.info(`[Lux:Socket] track ${symbol}@${timeframe}`, 'WS');
  },

  getState(): { phase: MobileSocketPhase; symbol: string; timeframe: string } {
    return { phase, symbol: lastSymbol, timeframe: lastTimeframe };
  },
};
