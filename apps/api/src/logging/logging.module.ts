import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestLog } from './entities/request-log.entity';
import { LoggingService } from './logging.service';
import { LoggingController } from './logging.controller';
import { AnalyticsController } from './analytics.controller';
import { RequestLoggerInterceptor } from './request-logger.interceptor';
import { LoggingQueueProcessor } from './logging-queue.processor';
import { LangfuseService } from './langfuse.service';
import { LogRetentionService } from './log-retention.service';
import { Model } from '@aegis/common/gateway/model.entity';
import { Organization } from '@aegis/common/auth/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestLog, Model, Organization]),
    ScheduleModule.forRoot(),
  ],
  controllers: [LoggingController, AnalyticsController],
  providers: [
    LoggingService,
    RequestLoggerInterceptor,
    LoggingQueueProcessor,
    LangfuseService,
    LogRetentionService,
  ],
  exports: [LoggingService, RequestLoggerInterceptor, LoggingQueueProcessor, TypeOrmModule],
})
export class LoggingModule {}
