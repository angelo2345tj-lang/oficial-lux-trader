import { RiskLimits, DailyPnL } from '../../types/execution';
import { auditLog } from '../security/auditLog';
import { secureStorage } from '../security/secureStorage';

const RISK_KEY = 'risk_state';

interface RiskState {
  daily: DailyPnL;
  tradesToday: number;
  lastTradeAt: number;
  killSwitch: boolean;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function loadState(): Promise<RiskState> {
  const saved = await secureStorage.get<RiskState>(RISK_KEY);
  if (saved && saved.daily.date === todayKey()) return saved;
  return {
    daily: { date: todayKey(), realizedPnl: 0, unrealizedPnl: 0, tradesCount: 0, wins: 0, losses: 0 },
    tradesToday: 0,
    lastTradeAt: 0,
    killSwitch: false,
  };
}

async function saveState(state: RiskState) {
  await secureStorage.set(RISK_KEY, state);
}

export class RiskManager {
  private limits: RiskLimits;
  private state: RiskState | null = null;
  private minTradeIntervalMs = 30_000;

  constructor(limits: RiskLimits) {
    this.limits = limits;
  }

  async init() {
    this.state = await loadState();
    if (this.limits.killSwitch) this.state.killSwitch = true;
  }

  updateLimits(limits: Partial<RiskLimits>) {
    this.limits = { ...this.limits, ...limits };
  }

  async activateKillSwitch(reason: string) {
    if (!this.state) await this.init();
    this.state!.killSwitch = true;
    this.limits.killSwitch = true;
    await saveState(this.state!);
    await auditLog.record('KILL_SWITCH', reason, true);
  }

  async deactivateKillSwitch() {
    if (!this.state) await this.init();
    this.state!.killSwitch = false;
    this.limits.killSwitch = false;
    await saveState(this.state!);
  }

  async canOpenTrade(balance: number): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.state) await this.init();
    const s = this.state!;

    if (s.killSwitch || this.limits.killSwitch) {
      return { allowed: false, reason: 'KILL SWITCH ATIVO' };
    }

    if (s.tradesToday >= this.limits.maxTradesPerDay) {
      return { allowed: false, reason: `Limite diário de trades (${this.limits.maxTradesPerDay})` };
    }

    const dailyLossLimit =
      this.limits.maxDailyLoss > 0 && this.limits.maxDailyLoss < 1
        ? balance * this.limits.maxDailyLoss
        : this.limits.maxDailyLoss;

    if (s.daily.realizedPnl <= -dailyLossLimit && dailyLossLimit > 0) {
      await this.activateKillSwitch('Daily loss limit atingido');
      return { allowed: false, reason: 'STOP DIÁRIO DE LOSS ATINGIDO' };
    }

    const dailyProfitLimit =
      this.limits.maxDailyProfit > 0 && this.limits.maxDailyProfit < 1
        ? balance * this.limits.maxDailyProfit
        : this.limits.maxDailyProfit;

    if (s.daily.realizedPnl >= dailyProfitLimit && dailyProfitLimit > 0) {
      return { allowed: false, reason: 'META DIÁRIA DE GANHO ATINGIDA' };
    }

    if (Date.now() - s.lastTradeAt < this.minTradeIntervalMs) {
      return { allowed: false, reason: 'Anti-overtrade: aguarde intervalo mínimo' };
    }

    return { allowed: true };
  }

  calcPositionSize(balance: number, entry: number, stopLoss: number, symbol: string): number {
    const riskAmount = balance * (this.limits.riskPercentPerTrade / 100);
    const distance = Math.abs(entry - stopLoss);
    if (distance <= 0) return 0.01;

    const isForex = symbol.length === 6 && !symbol.includes('BTC');
    const pipValue = isForex ? 10 : 1;
    const lots = riskAmount / (distance * 10000 * pipValue);
    return Math.max(0.01, Math.min(lots, balance * 0.1));
  }

  async recordTrade(pnl: number, win: boolean) {
    if (!this.state) await this.init();
    this.state!.tradesToday++;
    this.state!.lastTradeAt = Date.now();
    this.state!.daily.tradesCount++;
    this.state!.daily.realizedPnl += pnl;
    if (win) this.state!.daily.wins++;
    else this.state!.daily.losses++;
    await saveState(this.state!);
  }

  getDailyPnL(): DailyPnL {
    return this.state?.daily ?? {
      date: todayKey(),
      realizedPnl: 0,
      unrealizedPnl: 0,
      tradesCount: 0,
      wins: 0,
      losses: 0,
    };
  }

  isKillSwitchActive() {
    return this.state?.killSwitch || this.limits.killSwitch;
  }
}
