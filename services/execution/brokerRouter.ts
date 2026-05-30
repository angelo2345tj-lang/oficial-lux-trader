import { BrokerId } from '../../types/execution';
import { BrokerAdapter } from './brokers/types';
import { binanceFuturesBroker } from './brokers/binanceFutures';
import { bybitBroker } from './brokers/bybitBroker';
import { mt5BridgeBroker } from './brokers/mt5Bridge';
import { pocketOptionBridge } from './brokers/pocketOptionBridge';
import { ASSETS } from '../../constants';

const brokers: Record<BrokerId, BrokerAdapter> = {
  binance_futures: binanceFuturesBroker,
  bybit: bybitBroker,
  mt5: mt5BridgeBroker,
  pocket_option: pocketOptionBridge,
};

export class BrokerRouter {
  private activeBroker: BrokerId = 'binance_futures';

  setBroker(id: BrokerId) {
    this.activeBroker = id;
  }

  getBroker(): BrokerAdapter {
    return brokers[this.activeBroker];
  }

  getBrokerById(id: BrokerId): BrokerAdapter {
    return brokers[id];
  }

  /** Roteamento inteligente por categoria do ativo */
  resolveBrokerForSymbol(symbol: string): BrokerAdapter {
    const asset = ASSETS.find((a) => a.symbol === symbol);
    if (!asset) return this.getBroker();

    if (asset.category === 'Crypto') {
      if (binanceFuturesBroker.isConfigured()) return binanceFuturesBroker;
      if (bybitBroker.isConfigured()) return bybitBroker;
    }
    if (asset.category === 'Forex' || asset.category === 'Commodities') {
      if (mt5BridgeBroker.isConfigured()) return mt5BridgeBroker;
    }
    return this.getBroker();
  }

  listConfigured(): BrokerId[] {
    return (Object.keys(brokers) as BrokerId[]).filter((id) => brokers[id].isConfigured());
  }

  listAll(): { id: BrokerId; name: string; configured: boolean }[] {
    return (Object.keys(brokers) as BrokerId[]).map((id) => ({
      id,
      name: brokers[id].name,
      configured: brokers[id].isConfigured(),
    }));
  }
}

export const brokerRouter = new BrokerRouter();
