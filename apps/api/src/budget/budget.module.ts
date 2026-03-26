import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetPeriod } from './entities/budget-period.entity';
import { UsageRecord } from './entities/usage-record.entity';
import { AlertRecord } from './entities/alert-record.entity';
import { ModelTier, ModelTierMember } from './entities/model-tier.entity';
import { BudgetService } from './budget.service';
import { BudgetEngineService } from './budget-engine.service';
import { BudgetAlertService } from './budget-alert.service';
import { BudgetResetProcessor } from './budget-reset.processor';
import { BudgetGuard } from './budget.guard';
import { BudgetController, UsageController } from './budget.controller';
import { ModelTierService } from './model-tier.service';
import { ModelTierController } from './model-tier.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Budget,
      BudgetPeriod,
      UsageRecord,
      AlertRecord,
      ModelTier,
      ModelTierMember,
    ]),
  ],
  controllers: [BudgetController, UsageController, ModelTierController],
  providers: [
    BudgetService,
    BudgetEngineService,
    BudgetAlertService,
    BudgetResetProcessor,
    BudgetGuard,
    ModelTierService,
  ],
  exports: [
    BudgetService,
    BudgetEngineService,
    BudgetGuard,
    BudgetAlertService,
    ModelTierService,
  ],
})
export class BudgetModule {}
