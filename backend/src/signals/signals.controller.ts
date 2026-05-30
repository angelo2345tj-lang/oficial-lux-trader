import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { AnalyzeSignalDto } from './dto/analyze-signal.dto';

const signalsService = new SignalsService();

@Controller('api/v1/signals')
export class SignalsController {
  @Post('analyze')
  analyze(@Body() dto: AnalyzeSignalDto) {
    return signalsService.analyze(dto);
  }

  @Get('latest')
  latest(@Query('symbol') symbol: string, @Query('timeframe') timeframe?: string) {
    return signalsService.getLatest(symbol, timeframe);
  }
}
