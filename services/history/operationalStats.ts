import { TradeHistoryItem } from '../../types';

export interface OperationalStats {
  totalOps: number;
  wins: number;
  losses: number;
  breakEven: number;
  pending: number;
  winRate: number;
  totalProfit: number;
  dailyProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
  biggestWin: number;
  biggestLoss: number;
  currentWinStreak: number;
  currentLossStreak: number;
  totalPips: number;
  roi: number;
  avgPayoff: number;
  expectancy: number;
  profitFactor: number;
  equityCurve: { t: string; equity: number }[];
}

function closed(items: TradeHistoryItem[]) {
  return items.filter((h) => h.result === 'WIN' || h.result === 'LOSS' || h.result === 'BE');
}

function profitInRange(items: TradeHistoryItem[], from: Date) {
  return items
    .filter((h) => new Date(h.timestamp) >= from)
    .reduce((a, h) => a + (h.profitUsd ?? h.profit), 0);
}

export function computeOperationalStats(history: TradeHistoryItem[]): OperationalStats {
  const wins = history.filter((h) => h.result === 'WIN');
  const losses = history.filter((h) => h.result === 'LOSS');
  const breakEven = history.filter((h) => h.result === 'BE');
  const pending = history.filter((h) => h.result === 'PENDING');
  const closedTrades = closed(history);

  const totalProfit = history.reduce((a, h) => a + (h.profitUsd ?? h.profit), 0);
  const totalInvested = history.reduce((a, h) => a + (h.entryValue || h.entry || 0), 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const winProfits = wins.map((w) => w.profitUsd ?? w.profit);
  const lossProfits = losses.map((l) => Math.abs(l.profitUsd ?? l.profit));
  const grossWin = winProfits.reduce((a, b) => a + b, 0);
  const grossLoss = lossProfits.reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const avgPayoff = avgLoss > 0 ? avgWin / avgLoss : avgWin;
  const lossRate = closedTrades.length ? losses.length / closedTrades.length : 0;
  const winRateFrac = closedTrades.length ? wins.length / closedTrades.length : 0;
  const expectancy = winRateFrac * avgWin - lossRate * avgLoss;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  const sorted = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  for (const h of sorted) {
    if (h.result === 'PENDING') continue;
    if (h.result === 'WIN') {
      if (currentLossStreak > 0) break;
      currentWinStreak++;
    } else if (h.result === 'LOSS') {
      if (currentWinStreak > 0) break;
      currentLossStreak++;
    } else break;
  }

  const totalPips = history.reduce((a, h) => a + (h.pips ?? 0), 0);

  let equity = 0;
  const equityCurve = [...history]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((h) => {
      equity += h.profitUsd ?? h.profit;
      return {
        t: new Date(h.timestamp).toISOString().slice(0, 10),
        equity: Math.round(equity * 100) / 100,
      };
    });

  return {
    totalOps: history.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: breakEven.length,
    pending: pending.length,
    winRate,
    totalProfit,
    dailyProfit: profitInRange(history, startOfDay),
    weeklyProfit: profitInRange(history, startOfWeek),
    monthlyProfit: profitInRange(history, startOfMonth),
    biggestWin: winProfits.length ? Math.max(...winProfits) : 0,
    biggestLoss: lossProfits.length ? -Math.max(...lossProfits) : 0,
    currentWinStreak,
    currentLossStreak,
    totalPips,
    roi,
    avgPayoff,
    expectancy,
    profitFactor,
    equityCurve,
  };
}
