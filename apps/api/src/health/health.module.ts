import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisService } from '@aegis/common/redis/redis.service';
import { LoggerService } from '@aegis/common/logger/logger.service';

@Module({
  controllers: [HealthController],
  providers: [RedisService, LoggerService],
})
export class HealthModule {}
