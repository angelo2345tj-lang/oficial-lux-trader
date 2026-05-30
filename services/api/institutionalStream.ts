import type { TradeSignal } from '../../types';
import { resolveApiWebSocketUrl, isRemoteApiEnabled } from '../../src/config/api';
import { isValidInstitutionalPayload } from '../institutional/institutionalCommit';

export interface InstitutionalStreamPayload {
  symbol: string;
  timeframe: string;
  timestamp: string;
  snapshotId: string;
  snapshotTimestamp: number;
  marketSequence: number;
  signal: TradeSignal | null;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  status: 'OK' | 'NO_DATA' | 'BLOCKED';
  blockReason?: string;
}

type Handler = (payload: InstitutionalStreamPayload) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let activeKey = '';
let activeSymbol = '';
let activeTimeframe = '';
let handlers = new Set<Handler>();
let reconnectAttempt = 0;
const MAX_RECONNECT = 8;
let lastMessageKey = '';

const CLIENT_BOOT_AT = Date.now();
const CLIENT_BOOT_GRACE_MS = 45_000;
let scannerRunning = false;
let lastRestAnalyzedBarTs = 0;

function snapshotBarTs(snapshotId: string): number {
  const m = /^[A-Z0-9]{3,12}_\d+_(\d+)$/i.exec(snapshotId.trim());
  return m ? Number(m[1]) : 0;
}

/** Sincroniza com App.tsx — bloqueia replay enquanto scanner REST está ativo. */
export function setInstitutionalScannerRunning(running: boolean): void {
  scannerRunning = running;
  if (running) {
    console.log('[Lux:StreamReplay] scanner active — replay suppressed');
  }
}

export function markClientAnalyzedSnapshot(snapshotId: string | undefined): void {
  const barTs = snapshotId ? snapshotBarTs(snapshotId) : 0;
  if (barTs > 0) lastRestAnalyzedBarTs = barTs;
}

function streamUrl(symbol: string, timeframe: string): string {
  const base = resolveApiWebSocketUrl('/institutional/stream');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;
}

function reviveSignal(raw: TradeSignal | null): TradeSignal | null {
  if (!raw) return null;
  return {
    ...raw,
    timestamp: raw.timestamp ? new Date(raw.timestamp as unknown as string) : new Date(),
  };
}

function messageKey(payload: InstitutionalStreamPayload): string {
  return `${payload.snapshotId}:${payload.marketSequence}:${payload.confidence}:${payload.direction}`;
}

function shouldAcceptReplay(payload: InstitutionalStreamPayload): boolean {
  if (Date.now() - CLIENT_BOOT_AT < CLIENT_BOOT_GRACE_MS) {
    console.log(`[Lux:StreamReplay] blocked boot-grace ${payload.symbol}`);
    return false;
  }
  if (scannerRunning) {
    console.log(`[Lux:StreamReplay] blocked scanner-running ${payload.symbol}`);
    return false;
  }
  const barTs = snapshotBarTs(payload.snapshotId);
  if (lastRestAnalyzedBarTs <= 0) {
    console.log(`[Lux:StreamReplay] blocked no-rest-baseline ${payload.symbol} snap=${payload.snapshotId}`);
    return false;
  }
  if (barTs <= lastRestAnalyzedBarTs) {
    console.log(
      `[Lux:StreamReplay] blocked stale snap=${payload.snapshotId} barTs=${barTs} last=${lastRestAnalyzedBarTs}`
    );
    return false;
  }
  return true;
}

function dispatch(payload: InstitutionalStreamPayload, meta?: { replay?: boolean }): void {
  if (!isValidInstitutionalPayload(payload, activeSymbol)) {
    console.log(
      `[Lux:StreamMessage] rejected ${payload.symbol} status=${payload.status} snap=${payload.snapshotId}`
    );
    return;
  }

  if (meta?.replay && !shouldAcceptReplay(payload)) {
    return;
  }

  const key = messageKey(payload);
  if (key === lastMessageKey) {
    console.log('[Lux:StreamDuplicate]', key);
    return;
  }
  lastMessageKey = key;

  const normalized: InstitutionalStreamPayload = {
    ...payload,
    signal: reviveSignal(payload.signal),
  };

  if (meta?.replay) {
    console.log(
      `[Lux:StreamReplay] accepted ${normalized.symbol} ${normalized.direction} ${normalized.confidence}% snap=${normalized.snapshotId}`
    );
  } else {
    console.log(
      `[Lux:StreamLive] ${normalized.symbol} ${normalized.direction} ${normalized.confidence}% snap=${normalized.snapshotId}`
    );
  }

  handlers.forEach((h) => {
    try {
      h(normalized);
    } catch (e) {
      console.error('[Lux:StreamMessage] handler error', e);
    }
  });
}

export function subscribeInstitutionalSignalStream(
  symbol: string,
  timeframe: string,
  handler: Handler
): () => void {
  console.log('[TRACE] subscribeInstitutionalSignalStream called - symbol=', symbol, ' timeframe=', timeframe, ' handlers.size=', handlers.size);
  if (!isRemoteApiEnabled()) {
    console.log('[TRACE] subscribeInstitutionalSignalStream API NOT enabled, returning no-op cleanup');
    return () => undefined;
  }

  handlers.add(handler);
  console.log('[TRACE] subscribeInstitutionalSignalStream handler added - handlers.size=', handlers.size);
  const key = `${symbol}:${timeframe}`;
  if (key !== activeKey || !socket || socket.readyState > WebSocket.OPEN) {
    console.log('[TRACE] subscribeInstitutionalSignalStream connecting - key=', key, ' activeKey=', activeKey, ' socket=', !!socket, ' readyState=', socket?.readyState);
    connectInstitutionalStream(symbol, timeframe);
  }

  return () => {
    console.log('[TRACE] subscribeInstitutionalSignalStream cleanup called - handlers.size before=', handlers.size);
    handlers.delete(handler);
    console.log('[TRACE] subscribeInstitutionalSignalStream handler removed - handlers.size after=', handlers.size);
    if (handlers.size === 0) {
      console.log('[TRACE] subscribeInstitutionalSignalStream no handlers left, disconnecting');
      disconnectInstitutionalStream();
    }
  };
}

export function connectInstitutionalStream(symbol: string, timeframe: string): void {
  if (!isRemoteApiEnabled()) {
    console.log('[TRACE] connectInstitutionalStream API NOT enabled, returning');
    return;
  }

  console.log('[TRACE] connectInstitutionalStream called - symbol=', symbol, ' timeframe=', timeframe, ' current socket=', !!socket);
  disconnectInstitutionalStream();
  activeKey = `${symbol}:${timeframe}`;
  activeSymbol = symbol.toUpperCase();
  activeTimeframe = timeframe;
  lastMessageKey = '';

  const url = streamUrl(symbol, timeframe);
  console.log('[Lux:StreamOpen]', activeSymbol, activeTimeframe);

  try {
    socket = new WebSocket(url);
    console.log('[TRACE] connectInstitutionalStream WebSocket created');
  } catch (e) {
    console.warn('[Lux:StreamOpen] failed', e);
    scheduleReconnect(symbol, timeframe);
    return;
  }

  socket.onopen = () => {
    reconnectAttempt = 0;
    console.log('[Lux:StreamOpen] connected', activeSymbol);
  };

  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as {
        type?: string;
        replay?: boolean;
        live?: boolean;
        payload?: InstitutionalStreamPayload;
      };
      if (data.type === 'institutional_signal' && data.payload) {
        dispatch(data.payload, { replay: data.replay === true });
      }
    } catch {
      /* ignore */
    }
  };

  socket.onclose = () => {
    console.log('[Lux:StreamClose]', activeSymbol);
    if (handlers.size > 0 && reconnectAttempt < MAX_RECONNECT) {
      scheduleReconnect(symbol, timeframe);
    }
  };

  socket.onerror = () => {
    console.log('[TRACE] connectInstitutionalStream WebSocket error, closing');
    socket?.close();
  };
}

function scheduleReconnect(symbol: string, timeframe: string): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectAttempt += 1;
  const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttempt));
  console.log(`[Lux:StreamReconnect] attempt ${reconnectAttempt} in ${delay}ms`);
  reconnectTimer = setTimeout(() => {
    if (handlers.size > 0) connectInstitutionalStream(symbol, timeframe);
  }, delay);
}

export function disconnectInstitutionalStream(): void {
  console.log('[TRACE] disconnectInstitutionalStream called - socket=', !!socket, ' reconnectTimer=', !!reconnectTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectAttempt = 0;
  activeKey = '';
  if (socket) {
    const s = socket;
    socket = null;
    s.onclose = null;
    s.onerror = null;
    s.onmessage = null;
    s.close();
    console.log('[Lux:StreamClose] disconnected');
  } else {
    console.log('[TRACE] disconnectInstitutionalStream no socket to disconnect');
  }
}
