export type AnalyzeOrigin =
  | 'BOOT_TIMER'
  | 'STREAM_OPEN'
  | 'RECONNECT'
  | 'AUTO_SCAN'
  | 'USER_CLICK'
  | 'HEALTH_RECOVERY'
  | 'CANDLE_CLOSE'
  | 'SIGNAL_CONTEXT'
  | 'LUX_ENGINE'
  | 'UNKNOWN';

export function resolveAnalyzeOrigin(origin?: string): AnalyzeOrigin {
  const o = (origin ?? 'UNKNOWN').toUpperCase() as AnalyzeOrigin;
  const allowed: AnalyzeOrigin[] = [
    'BOOT_TIMER',
    'STREAM_OPEN',
    'RECONNECT',
    'AUTO_SCAN',
    'USER_CLICK',
    'HEALTH_RECOVERY',
    'CANDLE_CLOSE',
    'SIGNAL_CONTEXT',
    'LUX_ENGINE',
    'UNKNOWN',
  ];
  return allowed.includes(o) ? o : 'UNKNOWN';
}

export function logAnalyzeInput(
  origin: AnalyzeOrigin,
  symbol: string,
  timeframe: string,
  extra?: string
): void {
  const tail = extra ? ` ${extra}` : '';
  console.log(
    `[Lux:AnalyzeInput] origin=${origin} symbol=${symbol} timeframe=${timeframe}${tail}`
  );
}
