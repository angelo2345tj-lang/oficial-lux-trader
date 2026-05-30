import { Position, DailyPnL } from '../../types/execution';
import { secureStorage } from '../security/secureStorage';

const PNL_HISTORY_KEY = 'pnl_history';

export interface PnLSnapshot {
  timestamp: number;
  equity: number;
  realized: number;
  unrealized: number;
}

export class PnLEngine {
  private equityCurve: PnLSnapshot[] = [];

  async loadHistory() {
    this.equityCurve = (await secureStorage.get<PnLSnapshot[]>(PNL_HISTORY_KEY)) ?? [];
  }

  async saveHistory() {
    await secureStorage.set(PNL_HISTORY_KEY, this.equityCurve.slice(-2000));
  }

  recordSnapshot(balance: number, daily: DailyPnL, positions: Position[]) {
    const unrealized = positions.reduce((a, p) => a + p.unrealizedPnl, 0);
    this.equityCurve.push({
      timestamp: Date.now(),
      equity: balance + unrealized,
      realized: daily.realizedPnl,
      unrealized,
    });
    if (this.equityCurve.length > 2000) this.equityCurve.shift();
  }

  getEquityCurve(): PnLSnapshot[] {
    return [...this.equityCurve];
  }

  calcSharpe(returns: number[], riskFree = 0): number {
    if (returns.length < 2) return 0;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - avg) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return ((avg - riskFree) / std) * Math.sqrt(252);
  }

  calcExpectancy(wins: number[], losses: number[]): number {
    if (!wins.length && !losses.length) return 0;
    const winRate = wins.length / (wins.length + losses.length);
    const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    return winRate * avgWin - (1 - winRate) * avgLoss;
  }

  calcMaxDrawdown(curve: number[]): number {
    let peak = curve[0] ?? 0;
    let maxDd = 0;
    for (const v of curve) {
      peak = Math.max(peak, v);
      const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
      maxDd = Math.max(maxDd, dd);
    }
    return maxDd;
  }
}
