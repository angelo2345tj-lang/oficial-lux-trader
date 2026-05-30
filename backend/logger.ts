export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

function emit() {
  listeners.forEach((cb) => cb([...logs]));
}

function push(level: LogLevel, message: string, context?: string, data?: unknown) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    message,
    context,
    timestamp: Date.now(),
    data,
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[Lux:${context ?? 'app'}]`, message, data ?? '');
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
    return () => listeners.delete(cb);
  },
  clear: () => {
    logs.length = 0;
    emit();
  },
};
