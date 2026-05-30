import type { SignalTimingMode } from '../types';

/** Normaliza símbolo — aceita `symbol` ou `asset` (legado). */
export function normalizeSymbol(input: {
  symbol?: string;
  asset?: string;
}): string | null {
  const raw = String(input.symbol ?? input.asset ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return raw.length >= 3 ? raw : null;
}

/** Converte M15, H1, 15m etc. para valores internos (1, 5, 15, 60, 240, D…). */
export function normalizeTimeframe(tf?: string): string {
  if (!tf) return '60';
  const t = String(tf).trim().toUpperCase();

  const aliases: Record<string, string> = {
    M1: '1',
    M2: '2',
    M3: '3',
    M5: '5',
    M10: '10',
    M15: '15',
    M30: '30',
    M45: '45',
    H1: '60',
    H2: '120',
    H4: '240',
    H6: '360',
    H8: '480',
    H12: '720',
    D1: 'D',
    W1: 'W',
    MN1: 'M',
    '1MIN': '1',
    '5MIN': '5',
    '15MIN': '15',
    '30MIN': '30',
    '1H': '60',
    '4H': '240',
  };

  if (aliases[t]) return aliases[t];
  if (/^\d+$/.test(t)) return t;
  if (t === 'D' || t === 'W' || t === 'M') return t;

  const digits = t.replace(/\D/g, '');
  if (digits) return digits;

  return '60';
}

export interface RawAnalyzeBody {
  symbol?: string;
  asset?: string;
  timeframe?: string;
  balance?: number;
  riskPercent?: number;
  livePrice?: number;
  timingMode?: SignalTimingMode;
  banca?: number;
  streamLive?: boolean;
  analyzeOrigin?: string;
}

export interface NormalizedAnalyzePayload {
  symbol: string;
  timeframe: string;
  balance: number;
  riskPercent: number;
  livePrice?: number;
  timingMode: SignalTimingMode;
  streamLive: boolean;
  analyzeOrigin?: string;
}

export function normalizeAnalyzePayload(
  raw: RawAnalyzeBody
): { ok: true; payload: NormalizedAnalyzePayload } | { ok: false; message: string } {
  const symbol = normalizeSymbol(raw);
  if (!symbol) {
    return { ok: false, message: 'Ativo não informado' };
  }

  const balance = Number(raw.balance ?? raw.banca ?? 0);
  const riskPercent = Number(raw.riskPercent ?? 1.5);

  return {
    ok: true,
    payload: {
      symbol,
      timeframe: normalizeTimeframe(raw.timeframe),
      balance: Number.isFinite(balance) && balance > 0 ? balance : 10000,
      riskPercent: Number.isFinite(riskPercent) && riskPercent > 0 ? riskPercent : 1.5,
      livePrice:
        raw.livePrice != null && Number(raw.livePrice) > 0
          ? Number(raw.livePrice)
          : undefined,
      timingMode: raw.timingMode === 'CONFIRMED' ? 'CONFIRMED' : 'INSTANT',
      streamLive: raw.streamLive !== false,
      analyzeOrigin: raw.analyzeOrigin,
    },
  };
}
