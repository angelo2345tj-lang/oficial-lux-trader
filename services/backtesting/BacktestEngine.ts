import { Candle } from '../indicators';
import { fetchCandles } from '../marketData';
import { SignalType } from '../../types';
import { logger } from '../logger';
import { PnLEngine } from '../execution/pnlEngine';

export interface BacktestTrade {
  entry: number;
  exit: number;
  type: SignalType;
  result: 'WIN' | 'LOSS';
  profit: number;
  timestamp: number;
  session?: string;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  expectancy: number;
  equityCurve: EquityPoint[];
  monteCarloMedian: number;
  monteCarloWorst: number;
  walkForwardWinRate: number;
  spreadCost: number;
  slippageCost: number;
  trades: BacktestTrade[];
  aiAccuracy: number;
}

function getSession(hourUTC: number): string {
  if (hourUTC >= 0 && hourUTC < 8) return 'ASIA';
  if (hourUTC >= 8 && hourUTC < 13) return 'LONDON';
  if (hourUTC >= 13 && hourUTC < 21) return 'NY';
  return 'OFF';
}

function simulateCosts(entry: number, spreadBps = 2, slippageBps = 1): number {
  return entry * ((spreadBps + slippageBps) / 10000);
}

export class BacktestEngine {
  static async run(
    symbol: string,
    timeframe: string,
    candleCount = 300,
    banca = 10000,
    riskPercent = 1.5,
    options?: { spreadBps?: number; slippageBps?: number; sessionFilter?: string }
  ): Promise<BacktestResult> {
    logger.info(`Backtest PRO: ${symbol}`, 'backtest');
    const candles = await fetchCandles(symbol, timeframe, candleCount, false);
    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [{ timestamp: candles[0]?.timestamp ?? Date.now(), equity: banca }];
    let equity = banca;
    let peak = banca;
    let maxDrawdown = 0;
    let spreadCost = 0;
    let slippageCost = 0;

    const spreadBps = options?.spreadBps ?? 2;
    const slippageBps = options?.slippageBps ?? 1;
    const step = Math.max(20, Math.floor(candles.length / 25));

    for (let i = 50; i < candles.length - 5; i += step) {
      const slice = candles.slice(0, i + 1);
      const next = candles[i + 1];
      const hourUTC = new Date(next.timestamp).getUTCHours();
      const session = getSession(hourUTC);

      if (options?.sessionFilter && session !== options.sessionFilter) continue;

      try {
        const { computeConfluence } = await import('../confluenceEngine');
        const conf = computeConfluence(slice);
        if (conf.blocked || conf.type === 'NONE') continue;

        const direction = conf.signal;
        const entry = slice[slice.length - 1].close;
        const cost = simulateCosts(entry, spreadBps, slippageBps);
        spreadCost += cost * 0.6;
        slippageCost += cost * 0.4;
        const exit = next.close;
        const win = direction === SignalType.BUY ? exit > entry + cost : exit < entry - cost;
        const risk = banca * (riskPercent / 100);
        const profit = (win ? risk * 2 : -risk) - cost;

        trades.push({
          entry,
          exit,
          type: direction,
          result: win ? 'WIN' : 'LOSS',
          profit,
          timestamp: next.timestamp,
          session,
        });

        equity += profit;
        peak = Math.max(peak, equity);
        maxDrawdown = Math.max(maxDrawdown, peak > 0 ? ((peak - equity) / peak) * 100 : 0);
        equityCurve.push({ timestamp: next.timestamp, equity });
      } catch {
        continue;
      }
    }

    const wins = trades.filter((t) => t.result === 'WIN');
    const losses = trades.filter((t) => t.result === 'LOSS');
    const grossWin = wins.reduce((a, t) => a + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.profit, 0));
    const returns = trades.map((t) => t.profit / banca);

    const pnl = new PnLEngine();
    const sharpeRatio = pnl.calcSharpe(returns);
    const expectancy = pnl.calcExpectancy(
      wins.map((t) => t.profit),
      losses.map((t) => t.profit)
    );

    const { median, worst } = BacktestEngine.monteCarlo(trades, 500, banca);
    const walkForwardWinRate = await BacktestEngine.walkForward(candles, banca, riskPercent);

    return {
      symbol,
      timeframe,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
      totalProfit: trades.reduce((a, t) => a + t.profit, 0),
      maxDrawdown,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      sharpeRatio,
      expectancy,
      equityCurve,
      monteCarloMedian: median,
      monteCarloWorst: worst,
      walkForwardWinRate,
      spreadCost,
      slippageCost,
      trades,
      aiAccuracy: trades.length ? (wins.length / trades.length) * 100 : 0,
    };
  }

  static monteCarlo(trades: BacktestTrade[], simulations: number, banca: number) {
    if (!trades.length) return { median: banca, worst: banca };
    const finals: number[] = [];
    for (let s = 0; s < simulations; s++) {
      let eq = banca;
      const shuffled = [...trades].sort(() => Math.random() - 0.5);
      for (const t of shuffled) eq += t.profit;
      finals.push(eq);
    }
    finals.sort((a, b) => a - b);
    return {
      median: finals[Math.floor(finals.length / 2)],
      worst: finals[0],
    };
  }

  static async walkForward(candles: Candle[], _banca: number, _riskPercent: number): Promise<number> {
    const { computeConfluence } = await import('../confluenceEngine');
    const fold = Math.floor(candles.length / 3);
    if (fold < 30) return 0;
    let wins = 0;
    let total = 0;
    for (let f = 0; f < 3; f++) {
      const segment = candles.slice(f * fold, (f + 1) * fold);
      for (let i = 20; i < segment.length - 2; i += 10) {
        const slice = segment.slice(0, i + 1);
        const next = segment[i + 1];
        try {
          const conf = computeConfluence(slice);
          if (conf.blocked || conf.type === 'NONE') continue;
          const entry = slice[slice.length - 1].close;
          const win = conf.signal === SignalType.BUY ? next.close > entry : next.close < entry;
          if (win) wins++;
          total++;
        } catch {
          /* skip */
        }
      }
    }
    return total ? (wins / total) * 100 : 0;
  }

  static async replay(
    symbol: string,
    timeframe: string,
    onCandle: (candle: Candle, index: number) => void,
    delayMs = 100
  ): Promise<Candle[]> {
    const candles = await fetchCandles(symbol, timeframe, 150, false);
    for (let i = 0; i < candles.length; i++) {
      onCandle(candles[i], i);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return candles;
  }
}
