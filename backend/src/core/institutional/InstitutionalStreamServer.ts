import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getLatestForSymbol } from './InstitutionalSignalCache';
import {
  subscribeInstitutionalStream,
  canReplayCachedSnapshot,
  isStreamBootGraceActive,
} from './InstitutionalStreamHub';
import { canTransmitPayload } from './snapshotValidation';
import type { InstitutionalSignalPayload } from './types';

interface StreamQuery {
  symbol?: string;
  timeframe?: string;
}

function parseQuery(url: string): StreamQuery {
  try {
    const u = new URL(url, 'http://localhost');
    return {
      symbol: u.searchParams.get('symbol')?.toUpperCase() || undefined,
      timeframe: u.searchParams.get('timeframe') || '60',
    };
  } catch {
    return {};
  }
}

function sendIfValid(
  ws: WebSocket,
  payload: InstitutionalSignalPayload,
  reason: 'replay' | 'live'
): void {
  if (!canTransmitPayload(payload)) {
    console.log(
      `[Lux:StreamMessage] blocked ${reason} ${payload.symbol} status=${payload.status} snap=${payload.snapshotId}`
    );
    return;
  }

  if (reason === 'replay') {
    if (
      isStreamBootGraceActive() ||
      !canReplayCachedSnapshot(payload.snapshotId, payload.symbol, payload.timeframe)
    ) {
      console.log(
        `[Lux:StreamReplay] suppressed ${payload.symbol} snap=${payload.snapshotId}`
      );
      return;
    }
    console.log(
      `[Lux:StreamReplay] send ${payload.symbol} ${payload.direction} ${payload.confidence}% snap=${payload.snapshotId}`
    );
  } else {
    console.log(
      `[Lux:StreamLive] send ${payload.symbol} ${payload.direction} ${payload.confidence}% snap=${payload.snapshotId}`
    );
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: 'institutional_signal',
        replay: reason === 'replay',
        live: reason === 'live',
        payload,
      })
    );
  }
}

/**
 * WebSocket institucional — todos os dispositivos recebem o mesmo payload.
 */
export function attachInstitutionalStream(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/institutional/stream' });

  wss.on('connection', (ws, req) => {
    const q = parseQuery(req.url ?? '');
    console.log(`[Lux:StreamOpen] ${q.symbol ?? '*'} TF${q.timeframe ?? '60'}`);

    if (q.symbol) {
      const latest = getLatestForSymbol(q.symbol, q.timeframe ?? '60');
      if (latest) {
        sendIfValid(ws, latest.payload, 'replay');
      } else {
        console.log(`[Lux:StreamOpen] no replay cache for ${q.symbol}`);
      }
    }

    const unsub = subscribeInstitutionalStream((payload, meta) => {
      if (q.symbol && payload.symbol !== q.symbol) return;
      if (q.timeframe && payload.timeframe !== q.timeframe) return;
      sendIfValid(ws, payload, meta.live ? 'live' : 'live');
    });

    ws.on('close', () => {
      unsub();
      console.log(`[Lux:StreamClose] ${q.symbol ?? '*'}`);
    });
    ws.on('error', () => unsub());
  });

  console.log('[Lux:Realtime] institutional stream ready /institutional/stream');
}
