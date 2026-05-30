import { BrokerAdapter } from './types';
import { OrderRequest, OrderResult, Position } from '../../../types/execution';
import { validateEnv } from '../../security/envValidation';
import { BINANCE_SYMBOL_MAP } from '../../marketData/providers/binanceProvider';

const BASE = 'https://api.bybit.com';

async function hmacSign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function bybitRequest(method: string, path: string, body: Record<string, unknown> = {}) {
  const env = validateEnv();
  if (!env.bybitApiKey || !env.bybitSecret) throw new Error('Bybit: credenciais não configuradas');

  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const bodyStr = method === 'GET' ? '' : JSON.stringify(body);
  const signPayload = timestamp + env.bybitApiKey + recvWindow + bodyStr;
  const signature = await hmacSign(env.bybitSecret, signPayload);

  const url = method === 'GET' ? `${BASE}${path}` : `${BASE}${path}`;
  return fetch(url, {
    method,
    headers: {
      'X-BAPI-API-KEY': env.bybitApiKey,
      'X-BAPI-SIGN': signature,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : bodyStr,
  });
}

function mapSymbol(symbol: string): string {
  const b = BINANCE_SYMBOL_MAP[symbol];
  return b || symbol.replace('USD', 'USDT');
}

export const bybitBroker: BrokerAdapter = {
  id: 'bybit',
  name: 'Bybit',

  isConfigured() {
    const e = validateEnv();
    return Boolean(e.bybitApiKey && e.bybitSecret);
  },

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    try {
      const sym = mapSymbol(req.symbol);
      const res = await bybitRequest('POST', '/v5/order/create', {
        category: 'linear',
        symbol: sym,
        side: req.side === 'BUY' ? 'Buy' : 'Sell',
        orderType: 'Market',
        qty: String(req.quantity),
        stopLoss: String(req.stopLoss),
        takeProfit: String(req.takeProfit),
      });
      const json = await res.json();
      if (json.retCode !== 0) {
        return { success: false, broker: 'bybit', message: json.retMsg, timestamp: Date.now() };
      }
      return {
        success: true,
        orderId: json.result?.orderId,
        broker: 'bybit',
        message: 'Ordem Bybit executada',
        timestamp: Date.now(),
      };
    } catch (e) {
      return {
        success: false,
        broker: 'bybit',
        message: e instanceof Error ? e.message : 'Erro Bybit',
        timestamp: Date.now(),
      };
    }
  },

  async cancelOrder(orderId: string, symbol: string) {
    const res = await bybitRequest('POST', '/v5/order/cancel', {
      category: 'linear',
      symbol: mapSymbol(symbol),
      orderId,
    });
    const json = await res.json();
    return json.retCode === 0;
  },

  async getPositions(): Promise<Position[]> {
    const res = await bybitRequest('GET', '/v5/position/list?category=linear&settleCoin=USDT', {});
    const json = await res.json();
    if (json.retCode !== 0) return [];
    return (json.result?.list ?? []).map((p: Record<string, string>) => ({
      id: p.symbol,
      symbol: p.symbol,
      side: p.side === 'Buy' ? 'BUY' : 'SELL',
      entryPrice: parseFloat(p.avgPrice),
      quantity: parseFloat(p.size),
      stopLoss: parseFloat(p.stopLoss || '0'),
      takeProfit: parseFloat(p.takeProfit || '0'),
      currentPrice: parseFloat(p.markPrice),
      unrealizedPnl: parseFloat(p.unrealisedPnl),
      status: 'OPEN' as const,
      broker: 'bybit' as const,
      openedAt: Date.now(),
      breakEvenApplied: false,
      mode: 'SMART_MONEY' as const,
    }));
  },

  async closePosition(_id: string, symbol: string) {
    const res = await bybitRequest('POST', '/v5/order/create', {
      category: 'linear',
      symbol: mapSymbol(symbol),
      side: 'Sell',
      orderType: 'Market',
      reduceOnly: true,
      qty: '0',
    });
    const json = await res.json();
    return {
      success: json.retCode === 0,
      broker: 'bybit',
      message: json.retMsg || 'Closed',
      timestamp: Date.now(),
    };
  },

  async modifyStopLoss(_id: string, symbol: string, stopLoss: number) {
    const res = await bybitRequest('POST', '/v5/position/trading-stop', {
      category: 'linear',
      symbol: mapSymbol(symbol),
      stopLoss: String(stopLoss),
    });
    const json = await res.json();
    return json.retCode === 0;
  },

  async getBalance() {
    const res = await bybitRequest('GET', '/v5/account/wallet-balance?accountType=UNIFIED', {});
    const json = await res.json();
    const coin = json.result?.list?.[0]?.coin?.find((c: { coin: string }) => c.coin === 'USDT');
    return coin ? parseFloat(coin.walletBalance) : 0;
  },
};
