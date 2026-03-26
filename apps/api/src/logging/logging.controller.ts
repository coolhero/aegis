import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from '@aegis/common';
import { JwtAuthGuard } from '@aegis/common/auth/jwt-auth.guard';
import { LoggingService } from './logging.service';
import { LogQueryDto } from './dto/log-query.dto';

@Controller('logs')
export class LoggingController {
  constructor(private readonly loggingService: LoggingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: LogQueryDto, @Req() req: any) {
    const orgId = req.user?.orgId;
    return this.loggingService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user?.orgId;
    const log = await this.loggingService.findById(orgId, id);
    if (!log) {
      throw new NotFoundException('Log not found');
    }
    return log;
  }
}
