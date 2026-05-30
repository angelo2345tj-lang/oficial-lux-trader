import { Injectable } from '@nestjs/common';
import {
  fetchCandles,
  fetchLastPrice,
  fetchMTFCandles,
  getCurrentPrice,
  checkMTFAlignment,
  getProviderForSymbol,
  MarketDataError,
} from '../lib/services/marketData';

@Injectable()
export class MarketDataService {
  fetchCandles = fetchCandles;
  fetchLastPrice = fetchLastPrice;
  fetchMTFCandles = fetchMTFCandles;
  getCurrentPrice = getCurrentPrice;
  checkMTFAlignment = checkMTFAlignment;
  getProviderForSymbol = getProviderForSymbol;
  MarketDataError = MarketDataError;
}

export { MarketDataError };
