import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { LoggingService } from './logging.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly loggingService: LoggingService) {}

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsage(@Query() query: AnalyticsQueryDto, @Req() req: any) {
    const orgId = req.user?.orgId;
    return this.loggingService.getUsageAnalytics(orgId, query);
  }

  @Get('cost')
  @UseGuards(JwtAuthGuard)
  async getCost(@Query() query: AnalyticsQueryDto, @Req() req: any) {
    const orgId = req.user?.orgId;
    return this.loggingService.getCostAnalytics(orgId, query);
  }
}
