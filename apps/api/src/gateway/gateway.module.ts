import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '@aegis/common/gateway/provider.entity';
import { Model } from '@aegis/common/gateway/model.entity';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { ProviderRegistry } from './providers/provider.registry';

@Module({
  imports: [TypeOrmModule.forFeature([Provider, Model])],
  controllers: [GatewayController],
  providers: [GatewayService, ProviderRegistry, LoggerService],
  exports: [GatewayService, ProviderRegistry],
})
export class GatewayModule {}
