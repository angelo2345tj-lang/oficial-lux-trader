import { BrokerAdapter } from './types';
import { OrderRequest, OrderResult, Position } from '../../../types/execution';
import { validateEnv } from '../../security/envValidation';
import { BINANCE_SYMBOL_MAP } from '../../marketData/providers/binanceProvider';

const BASE = 'https://fapi.binance.com';

async function hmacSign(secret: string, query: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(query));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signedRequest(
  method: string,
  path: string,
  params: Record<string, string>
): Promise<Response> {
  const env = validateEnv();
  if (!env.binanceApiKey || !env.binanceSecret) {
    throw new Error('Binance Futures: API key/secret não configurados');
  }
  const timestamp = Date.now().toString();
  const query = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = await hmacSign(env.binanceSecret, query);
  const url = `${BASE}${path}?${query}&signature=${signature}`;
  return fetch(url, {
    method,
    headers: { 'X-MBX-APIKEY': env.binanceApiKey },
  });
}

export const binanceFuturesBroker: BrokerAdapter = {
  id: 'binance_futures',
  name: 'Binance Futures',

  isConfigured() {
    const e = validateEnv();
    return Boolean(e.binanceApiKey && e.binanceSecret);
  },

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const sym = BINANCE_SYMBOL_MAP[req.symbol];
    if (!sym) {
      return { success: false, broker: 'binance_futures', message: 'Symbol not mapped', timestamp: Date.now() };
    }
    try {
      const side = req.side === 'BUY' ? 'BUY' : 'SELL';
      const posSide = side;
      const params: Record<string, string> = {
        symbol: sym,
        side,
        positionSide: posSide,
        type: req.entryPrice ? 'LIMIT' : 'MARKET',
        quantity: req.quantity.toFixed(3),
      };
      if (req.entryPrice) {
        params.price = req.entryPrice.toFixed(2);
        params.timeInForce = 'GTC';
      }

      const res = await signedRequest('POST', '/fapi/v1/order', params);
      const json = await res.json();
      if (!res.ok) {
        return {
          success: false,
          broker: 'binance_futures',
          message: json.msg || `HTTP ${res.status}`,
          timestamp: Date.now(),
        };
      }

      if (req.stopLoss > 0) {
        await signedRequest('POST', '/fapi/v1/order', {
          symbol: sym,
          side: req.side === 'BUY' ? 'SELL' : 'BUY',
          type: 'STOP_MARKET',
          stopPrice: req.stopLoss.toFixed(2),
          closePosition: 'true',
        });
      }
      if (req.takeProfit > 0) {
        await signedRequest('POST', '/fapi/v1/order', {
          symbol: sym,
          side: req.side === 'BUY' ? 'SELL' : 'BUY',
          type: 'TAKE_PROFIT_MARKET',
          stopPrice: req.takeProfit.toFixed(2),
          closePosition: 'true',
        });
      }

      return {
        success: true,
        orderId: String(json.orderId),
        broker: 'binance_futures',
        message: 'Ordem executada',
        executedPrice: parseFloat(json.avgPrice || json.price || '0'),
        executedQty: parseFloat(json.executedQty || json.origQty || '0'),
        timestamp: Date.now(),
      };
    } catch (e) {
      return {
        success: false,
        broker: 'binance_futures',
        message: e instanceof Error ? e.message : 'Erro Binance',
        timestamp: Date.now(),
      };
    }
  },

  async cancelOrder(orderId: string, symbol: string) {
    const sym = BINANCE_SYMBOL_MAP[symbol];
    if (!sym) return false;
    const res = await signedRequest('DELETE', '/fapi/v1/order', { symbol: sym, orderId });
    return res.ok;
  },

  async getPositions(): Promise<Position[]> {
    const res = await signedRequest('GET', '/fapi/v2/positionRisk', {});
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Array<Record<string, string>>)
      .filter((p) => parseFloat(p.positionAmt) !== 0)
      .map((p) => ({
        id: p.symbol,
        symbol: p.symbol.replace('USDT', 'USD'),
        side: parseFloat(p.positionAmt) > 0 ? 'BUY' : 'SELL',
        entryPrice: parseFloat(p.entryPrice),
        quantity: Math.abs(parseFloat(p.positionAmt)),
        stopLoss: 0,
        takeProfit: 0,
        currentPrice: parseFloat(p.markPrice),
        unrealizedPnl: parseFloat(p.unRealizedProfit),
        status: 'OPEN' as const,
        broker: 'binance_futures' as const,
        openedAt: Date.now(),
        breakEvenApplied: false,
        mode: 'SMART_MONEY' as const,
      }));
  },

  async closePosition(positionId: string, symbol: string) {
    const sym = BINANCE_SYMBOL_MAP[symbol] || positionId;
    const res = await signedRequest('POST', '/fapi/v1/order', {
      symbol: sym,
      side: 'SELL',
      type: 'MARKET',
      closePosition: 'true',
    });
    const json = await res.json();
    return {
      success: res.ok,
      orderId: String(json.orderId || ''),
      broker: 'binance_futures',
      message: res.ok ? 'Posição fechada' : json.msg,
      timestamp: Date.now(),
    };
  },

  async modifyStopLoss(_positionId: string, symbol: string, stopLoss: number) {
    const sym = BINANCE_SYMBOL_MAP[symbol];
    if (!sym) return false;
    const res = await signedRequest('POST', '/fapi/v1/order', {
      symbol: sym,
      side: 'SELL',
      type: 'STOP_MARKET',
      stopPrice: stopLoss.toFixed(2),
      closePosition: 'true',
    });
    return res.ok;
  },

  async getBalance() {
    const res = await signedRequest('GET', '/fapi/v2/balance', {});
    if (!res.ok) return 0;
    const data = await res.json();
    const usdt = (data as Array<{ asset: string; balance: string }>).find((b) => b.asset === 'USDT');
    return usdt ? parseFloat(usdt.balance) : 0;
  },
};
