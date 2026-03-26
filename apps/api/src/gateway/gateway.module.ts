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

@Module({
  imports: [TypeOrmModule.forFeature([Provider, Model, ApiKey]), BudgetModule],
  controllers: [GatewayController],
  providers: [GatewayService, ProviderRegistry, LoggerService, ApiKeyService],
  exports: [GatewayService, ProviderRegistry],
})
export class GatewayModule {}
