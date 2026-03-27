import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '@aegis/common/gateway/provider.entity';
import { Model } from '@aegis/common/gateway/model.entity';
import { ApiKey } from '@aegis/common';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { ProviderRegistry } from './providers/provider.registry';
import { ApiKeyService } from '../auth/api-key.service';
import { BudgetModule } from '../budget/budget.module';
import { LoggingModule } from '../logging/logging.module';
import { SecurityModule } from '../security/security.module';
import { CacheModule } from '../cache/cache.module';
import { CircuitBreakerService } from './circuit-breaker.service';
import { LatencyTrackerService } from './latency-tracker.service';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Provider, Model, ApiKey]), BudgetModule, LoggingModule, SecurityModule, CacheModule],
  controllers: [GatewayController, HealthController],
  providers: [GatewayService, ProviderRegistry, LoggerService, ApiKeyService, CircuitBreakerService, LatencyTrackerService],
  exports: [GatewayService, ProviderRegistry, CircuitBreakerService, LatencyTrackerService],
})
export class GatewayModule {}
