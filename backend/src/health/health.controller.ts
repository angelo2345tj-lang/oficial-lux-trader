import { Controller, Get } from '@nestjs/common';
import { getProviderHealth, resetProviderHealth } from '../lib/services/marketData/MarketDataManager';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'lux-trader-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/providers')
  providersHealth() {
    return {
      status: 'ok',
      service: 'lux-trader-api',
      timestamp: new Date().toISOString(),
      providers: getProviderHealth(),
    };
  }
}
