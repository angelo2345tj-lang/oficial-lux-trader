import { LUX_REALTIME_DEBUG } from './realtime/realtimeConfig';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LuxChannel =
  | 'app'
  | 'AI'
  | 'Trend'
  | 'Institutional'
  | 'Reversal'
  | 'Phase'
  | 'Score'
  | 'Decision'
  | 'MTF'
  | 'SMC'
  | 'Liquidity'
  | 'Momentum'
  | 'Signal'
  | 'WS'
  | 'API'
  | 'RealSignalEngine'
  | 'marketData'
  | 'candleStream'
  | 'Mobile'
  | 'Android'
  | 'PWA'
  | 'Socket'
  | 'Reconnect'
  | 'Background'
  | 'WakeLock'
  | 'Notifications'
  | 'Realtime'
  | 'Stale'
  | 'Recovery'
  | 'Binance'
  | 'Heartbeat'
  | 'REST'
  | 'Fallback'
  | 'Health'
  | 'Signal';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: number;
  data?: unknown;
}

const MAX_LOGS = 200;
const logs: LogEntry[] = [];
const listeners = new Set<(entries: LogEntry[]) => void>();

const CHANNEL_ALIASES: Record<string, LuxChannel> = {
  RealSignalEngine: 'Signal',
  candleStream: 'WS',
  marketData: 'API',
  confluenceEngine: 'Trend',
  InstitutionalAI: 'AI',
  institutionalGate: 'SMC',
  LiquidityEngine: 'Liquidity',
};

function resolveChannel(ctx?: string): string {
  if (!ctx) return 'Lux:app';
  const mapped = CHANNEL_ALIASES[ctx] ?? ctx;
  return mapped.startsWith('Lux:') ? mapped : `Lux:${mapped}`;
}

function emit() {
  listeners.forEach((cb) => cb([...logs]));
}

function push(level: LogLevel, message: string, context?: string, data?: unknown) {
  const debugOnly =
    level === 'debug' ||
    context === 'cache' ||
    context === 'Heartbeat' ||
    (level === 'info' &&
      (context === 'Refresh' || message.includes('latency') || message.includes('cache')));
  if (debugOnly && !LUX_REALTIME_DEBUG) return;

  const channel = resolveChannel(context);
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    message,
    context: channel,
    timestamp: Date.now(),
    data,
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${channel}]`, message, data ?? '');
  emit();
}

export const logger = {
  debug: (msg: string, ctx?: string, data?: unknown) => push('debug', msg, ctx, data),
  info: (msg: string, ctx?: string, data?: unknown) => push('info', msg, ctx, data),
  warn: (msg: string, ctx?: string, data?: unknown) => push('warn', msg, ctx, data),
  error: (msg: string, ctx?: string, data?: unknown) => push('error', msg, ctx, data),
  getLogs: () => [...logs],
  subscribe: (cb: (entries: LogEntry[]) => void) => {
    listeners.add(cb);
    cb([...logs]);
    return () => {
      listeners.delete(cb);
    };
  },
  clear: () => {
    logs.length = 0;
    emit();
  },
};
