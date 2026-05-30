import { TradeSignal, SignalType } from '../../types';
import { OrderRequest, ExecutionConfig, BrokerId } from '../../types/execution';
import { brokerRouter } from './brokerRouter';
import { RiskManager } from './riskManager';
import { PositionManager } from './positionManager';
import { PnLEngine } from './pnlEngine';
import { auditLog } from '../security/auditLog';
import { logger } from '../logger';
import { getTradingModeConfig } from '../../config/tradingModes';

export class OrderExecutionEngine {
  private risk: RiskManager;
  private positions: PositionManager;
  private pnl: PnLEngine;
  private config: ExecutionConfig;

  constructor(config: ExecutionConfig) {
    this.config = config;
    this.risk = new RiskManager(config.riskLimits);
    this.positions = new PositionManager();
    this.pnl = new PnLEngine();
    this.positions.setTrailingPercent(config.trailingStopPercent);
    this.positions.setBreakEvenAtR(config.breakEvenAtR);
  }

  async init() {
    await this.risk.init();
    await this.pnl.loadHistory();
    await auditLog.init();
  }

  updateConfig(config: Partial<ExecutionConfig>) {
    this.config = { ...this.config, ...config };
    if (config.riskLimits) this.risk.updateLimits(config.riskLimits);
  }

  async executeSignal(signal: TradeSignal, balance: number): Promise<{ success: boolean; message: string }> {
    if (!this.config.enabled || !this.config.autoExecute) {
      return { success: false, message: 'Execução automática desativada' };
    }

    const modeCfg = getTradingModeConfig(this.config.mode);
    if (signal.score < modeCfg.minScore) {
      return { success: false, message: `Score ${signal.score}% abaixo do mínimo do modo ${this.config.mode}` };
    }

    const riskCheck = await this.risk.canOpenTrade(balance);
    if (!riskCheck.allowed) {
      return { success: false, message: riskCheck.reason ?? 'Risk blocked' };
    }

    if (this.positions.countOpen() >= this.config.riskLimits.maxOpenPositions) {
      return { success: false, message: 'Máximo de posições abertas' };
    }

    const broker = brokerRouter.resolveBrokerForSymbol(signal.asset);
    if (!broker.isConfigured()) {
      return { success: false, message: `${broker.name} não configurado` };
    }

    const quantity = this.risk.calcPositionSize(balance, signal.entry, signal.sl, signal.asset);

    const req: OrderRequest = {
      symbol: signal.asset,
      side: signal.type === SignalType.BUY ? 'BUY' : 'SELL',
      quantity,
      entryPrice: modeCfg.useLimitOrders ? signal.entry : undefined,
      stopLoss: signal.sl,
      takeProfit: signal.tp1,
      takeProfit2: signal.tp2,
      takeProfit3: signal.tp3,
      leverage: 10,
      clientOrderId: signal.id,
    };

    logger.info(`Executando ordem real: ${signal.asset} ${req.side}`, 'execution', req);
    const result = await broker.placeOrder(req);

    await auditLog.record(
      'ORDER_PLACE',
      `${req.side} ${req.symbol} qty=${quantity}`,
      result.success,
      { broker: broker.id, symbol: signal.asset }
    );

    if (result.success) {
      this.positions.addLocal({
        id: result.orderId || signal.id,
        symbol: signal.asset,
        side: req.side,
        entryPrice: result.executedPrice ?? signal.entry,
        quantity,
        stopLoss: signal.sl,
        takeProfit: signal.tp1,
        currentPrice: signal.entry,
        unrealizedPnl: 0,
        status: 'OPEN',
        broker: broker.id,
        openedAt: Date.now(),
        breakEvenApplied: false,
        mode: this.config.mode,
      });
    }

    return { success: result.success, message: result.message };
  }

  async tickPositions(prices: Record<string, number>) {
    const open = this.positions.getOpenPositions();
    for (const pos of open) {
      const price = prices[pos.symbol];
      if (price) this.positions.updatePrice(pos.id, price);
    }
    const broker = brokerRouter.getBroker();
    const balance = await broker.getBalance().catch(() => 0);
    this.pnl.recordSnapshot(balance, this.risk.getDailyPnL(), open);
  }

  async syncPositions() {
    const broker = brokerRouter.getBroker();
    return this.positions.syncFromBroker(broker);
  }

  async killSwitch(reason: string) {
    await this.risk.activateKillSwitch(reason);
    const open = this.positions.getOpenPositions();
    const broker = brokerRouter.getBroker();
    for (const pos of open) {
      await broker.closePosition(pos.id, pos.symbol);
      this.positions.remove(pos.id);
    }
    return open.length;
  }

  getRiskManager() {
    return this.risk;
  }

  getPositionManager() {
    return this.positions;
  }

  getPnLEngine() {
    return this.pnl;
  }

  setBroker(id: BrokerId) {
    brokerRouter.setBroker(id);
  }
}

export function createDefaultExecutionConfig(): ExecutionConfig {
  return {
    enabled: false,
    broker: 'binance_futures',
    mode: 'SMART_MONEY',
    autoExecute: false,
    trailingStopPercent: 0.5,
    breakEvenAtR: 1.0,
    riskLimits: {
      maxDailyLoss: 500,
      maxDailyProfit: 1000,
      maxOpenPositions: 3,
      maxTradesPerDay: 20,
      riskPercentPerTrade: 1.5,
      killSwitch: false,
    },
  };
}
