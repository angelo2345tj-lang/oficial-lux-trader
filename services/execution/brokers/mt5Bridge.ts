import { BrokerAdapter } from './types';
import { OrderRequest, OrderResult, Position } from '../../../types/execution';
import { validateEnv } from '../../security/envValidation';

async function bridgeFetch(path: string, body?: unknown) {
  const env = validateEnv();
  const base = env.mt5BridgeUrl || 'http://127.0.0.1:8080';
  const res = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`MT5 Bridge HTTP ${res.status}`);
  return res.json();
}

export const mt5BridgeBroker: BrokerAdapter = {
  id: 'mt5',
  name: 'MetaTrader 5',

  isConfigured() {
    return Boolean(validateEnv().mt5BridgeUrl);
  },

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    try {
      const json = await bridgeFetch('/order', {
        symbol: req.symbol,
        action: req.side === 'BUY' ? 'BUY' : 'SELL',
        volume: req.quantity,
        sl: req.stopLoss,
        tp: req.takeProfit,
        comment: 'LuxTrader',
      });
      return {
        success: Boolean(json.success),
        orderId: String(json.ticket || json.orderId || ''),
        broker: 'mt5',
        message: json.message || 'MT5 order sent',
        executedPrice: json.price,
        timestamp: Date.now(),
      };
    } catch (e) {
      return {
        success: false,
        broker: 'mt5',
        message: e instanceof Error ? e.message : 'MT5 Bridge offline — inicie o EA/bridge local',
        timestamp: Date.now(),
      };
    }
  },

  async cancelOrder(orderId: string, _symbol: string) {
    try {
      const json = await bridgeFetch('/cancel', { ticket: orderId });
      return Boolean(json.success);
    } catch {
      return false;
    }
  },

  async getPositions(): Promise<Position[]> {
    try {
      const json = await bridgeFetch('/positions');
      return (json.positions ?? []).map((p: Record<string, unknown>) => ({
        id: String(p.ticket),
        symbol: String(p.symbol),
        side: String(p.type).includes('BUY') ? 'BUY' : 'SELL',
        entryPrice: Number(p.price_open),
        quantity: Number(p.volume),
        stopLoss: Number(p.sl || 0),
        takeProfit: Number(p.tp || 0),
        currentPrice: Number(p.price_current),
        unrealizedPnl: Number(p.profit),
        status: 'OPEN' as const,
        broker: 'mt5' as const,
        openedAt: Date.now(),
        breakEvenApplied: false,
        mode: 'SMART_MONEY' as const,
      }));
    } catch {
      return [];
    }
  },

  async closePosition(positionId: string, symbol: string) {
    try {
      const json = await bridgeFetch('/close', { ticket: positionId, symbol });
      return {
        success: Boolean(json.success),
        broker: 'mt5',
        message: json.message || 'Closed',
        timestamp: Date.now(),
      };
    } catch (e) {
      return {
        success: false,
        broker: 'mt5',
        message: e instanceof Error ? e.message : 'Close failed',
        timestamp: Date.now(),
      };
    }
  },

  async modifyStopLoss(positionId: string, symbol: string, stopLoss: number) {
    try {
      const json = await bridgeFetch('/modify', { ticket: positionId, symbol, sl: stopLoss });
      return Boolean(json.success);
    } catch {
      return false;
    }
  },

  async getBalance() {
    try {
      const json = await bridgeFetch('/account');
      return Number(json.balance ?? json.equity ?? 0);
    } catch {
      return 0;
    }
  },
};
