import { BrokerAdapter } from './types';
import { OrderRequest, OrderResult, Position } from '../../../types/execution';
import { validateEnv } from '../../security/envValidation';

/**
 * Pocket Option não possui API pública oficial para retail.
 * Integração apenas via bridge HTTP local (automação externa).
 */
export const pocketOptionBridge: BrokerAdapter = {
  id: 'pocket_option',
  name: 'Pocket Option (Bridge)',

  isConfigured() {
    return Boolean(validateEnv().pocketBridgeUrl);
  },

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const url = validateEnv().pocketBridgeUrl;
    if (!url) {
      return {
        success: false,
        broker: 'pocket_option',
        message: 'Configure VITE_POCKET_BRIDGE_URL para bridge local',
        timestamp: Date.now(),
      };
    }
    try {
      const res = await fetch(`${url}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: req.symbol,
          direction: req.side === 'BUY' ? 'call' : 'put',
          amount: req.quantity,
        }),
      });
      const json = await res.json();
      return {
        success: Boolean(json.success),
        orderId: json.id,
        broker: 'pocket_option',
        message: json.message || 'Bridge order',
        timestamp: Date.now(),
      };
    } catch (e) {
      return {
        success: false,
        broker: 'pocket_option',
        message: e instanceof Error ? e.message : 'Pocket bridge offline',
        timestamp: Date.now(),
      };
    }
  },

  async cancelOrder() {
    return false;
  },

  async getPositions(): Promise<Position[]> {
    return [];
  },

  async closePosition() {
    return { success: false, broker: 'pocket_option', message: 'N/A', timestamp: Date.now() };
  },

  async modifyStopLoss() {
    return false;
  },

  async getBalance() {
    return 0;
  },
};
