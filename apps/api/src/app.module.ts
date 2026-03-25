import { Module } from '@nestjs/common';
import { AegisConfigModule } from '@aegis/common/config/config.module';
import { DatabaseModule } from '@aegis/common/database/database.module';
import { RedisModule } from '@aegis/common/redis/redis.module';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { HealthModule } from './health/health.module';
import { GatewayModule } from './gateway/gateway.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AegisConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    GatewayModule,
    AuthModule,
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class AppModule {}
