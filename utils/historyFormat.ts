import { TradeHistoryItem } from '../types';

const TF_LABELS: Record<string, string> = {
  '1': 'M1',
  '5': 'M5',
  '15': 'M15',
  '30': 'M30',
  '60': 'H1',
  '120': 'H2',
  '240': 'H4',
  D: 'D1',
  W: 'W1',
};

export function timeframeLabel(tf?: string): string {
  if (!tf) return '—';
  return TF_LABELS[tf] ?? tf;
}

export function calcPips(
  entry: number,
  exit: number,
  asset: string,
  direction: 'BUY' | 'SELL'
): number {
  if (!entry || !exit) return 0;
  const diff = direction === 'BUY' ? exit - entry : entry - exit;
  const isForex = asset.length === 6 && !asset.includes('BTC');
  const mult = isForex ? 10000 : asset.includes('BTC') ? 100 : 100;
  return Math.round(diff * mult * 10) / 10;
}

export function calcRiskReward(
  entry: number,
  sl: number,
  tp: number
): string {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk <= 0) return '—';
  const rr = reward / risk;
  return `1:${rr.toFixed(1)}`;
}

export function resultBadge(result: TradeHistoryItem['result']) {
  switch (result) {
    case 'WIN':
      return { emoji: '🟢', label: 'WIN', className: 'bg-green-500/10 text-green-400 border-green-500/30' };
    case 'LOSS':
      return { emoji: '🔴', label: 'LOSS', className: 'bg-red-500/10 text-red-400 border-red-500/30' };
    case 'BE':
      return { emoji: '🟡', label: 'BE', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    default:
      return { emoji: '⏳', label: 'PENDENTE', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' };
  }
}

export const DEFAULT_USD_BRL = 5.5;
