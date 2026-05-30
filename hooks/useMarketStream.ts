import { useMarket } from '../context/MarketContext';

/** Hook para stream de mercado em tempo real */
export function useMarketStream() {
  return useMarket();
}
