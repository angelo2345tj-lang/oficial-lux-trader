import { Position, TradingMode } from '../../types/execution';
import { BrokerAdapter } from './brokers/types';
import { auditLog } from '../security/auditLog';

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private trailingPercent = 0.5;
  private breakEvenAtR = 1.0;

  setTrailingPercent(p: number) {
    this.trailingPercent = p;
  }

  setBreakEvenAtR(r: number) {
    this.breakEvenAtR = r;
  }

  async syncFromBroker(broker: BrokerAdapter) {
    const remote = await broker.getPositions();
    this.positions.clear();
    remote.forEach((p) => this.positions.set(p.id, p));
    return remote;
  }

  getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter((p) => p.status === 'OPEN');
  }

  addLocal(position: Position) {
    this.positions.set(position.id, position);
  }

  updatePrice(positionId: string, currentPrice: number) {
    const pos = this.positions.get(positionId);
    if (!pos) return;

    const diff = pos.side === 'BUY' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
    pos.currentPrice = currentPrice;
    pos.unrealizedPnl = diff * pos.quantity;

    const risk = Math.abs(pos.entryPrice - pos.stopLoss);
    if (!pos.breakEvenApplied && risk > 0 && diff >= risk * this.breakEvenAtR) {
      pos.stopLoss = pos.entryPrice;
      pos.breakEvenApplied = true;
      pos.status = 'BREAKEVEN';
      auditLog.record('BREAK_EVEN', `${pos.symbol} SL → entry`, true, { symbol: pos.symbol });
    }

    if (pos.side === 'BUY' && currentPrice > pos.entryPrice) {
      const trail = currentPrice * (1 - this.trailingPercent / 100);
      if (!pos.trailingStop || trail > pos.trailingStop) {
        pos.trailingStop = trail;
        if (trail > pos.stopLoss) pos.stopLoss = trail;
        pos.status = 'TRAILING';
      }
    } else if (pos.side === 'SELL' && currentPrice < pos.entryPrice) {
      const trail = currentPrice * (1 + this.trailingPercent / 100);
      if (!pos.trailingStop || trail < pos.trailingStop) {
        pos.trailingStop = trail;
        if (trail < pos.stopLoss) pos.stopLoss = trail;
        pos.status = 'TRAILING';
      }
    }

    this.positions.set(positionId, pos);
  }

  remove(positionId: string) {
    this.positions.delete(positionId);
  }

  countOpen(): number {
    return this.getOpenPositions().length;
  }
}
