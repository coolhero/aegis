import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget, BudgetLevel } from './entities/budget.entity';
import { BudgetPeriod } from './entities/budget-period.entity';
import { UsageRecord } from './entities/usage-record.entity';
import { SetBudgetDto } from './dto/set-budget.dto';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(BudgetPeriod)
    private readonly periodRepo: Repository<BudgetPeriod>,
    @InjectRepository(UsageRecord)
    private readonly usageRepo: Repository<UsageRecord>,
  ) {}

  async setBudget(
    level: BudgetLevel,
    targetId: string,
    orgId: string,
    dto: SetBudgetDto,
    modelTierId?: string | null,
  ): Promise<Budget> {
    const where: any = { level, targetId };
    if (modelTierId) {
      where.modelTierId = modelTierId;
    } else {
      where.modelTierId = null as any;
    }
    let budget = await this.budgetRepo.findOne({ where });

    if (budget) {
      budget.tokenLimit = dto.token_limit;
      budget.costLimitUsd = dto.cost_limit_usd;
      if (dto.alert_thresholds) budget.alertThresholds = dto.alert_thresholds;
      if (dto.webhook_url !== undefined) budget.webhookUrl = dto.webhook_url;
      if (dto.enabled !== undefined) budget.enabled = dto.enabled;
      budget = await this.budgetRepo.save(budget);
    } else {
      budget = this.budgetRepo.create({
        level,
        targetId,
        orgId,
        modelTierId: modelTierId ?? null,
        tokenLimit: dto.token_limit,
        costLimitUsd: dto.cost_limit_usd,
        alertThresholds: dto.alert_thresholds ?? [80, 90, 100],
        webhookUrl: dto.webhook_url ?? null,
        enabled: dto.enabled ?? true,
      });
      budget = await this.budgetRepo.save(budget);

      // Create initial budget period
      const now = new Date();
      const startDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const endDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      );

      const period = this.periodRepo.create({
        budgetId: budget.id,
        startDate,
        endDate,
        isActive: true,
      });
      const savedPeriod = await this.periodRepo.save(period);

      budget.currentPeriodId = savedPeriod.id;
      budget = await this.budgetRepo.save(budget);
    }

    this.logger.log(
      `Budget set: ${level}/${targetId} — ${dto.token_limit} tokens, $${dto.cost_limit_usd}`,
    );

    return budget;
  }

  async getBudget(level: BudgetLevel, targetId: string): Promise<Budget> {
    const budget = await this.budgetRepo.findOne({
      where: { level, targetId },
    });
    if (!budget) {
      throw new NotFoundException(
        `Budget not found for ${level}/${targetId}`,
      );
    }
    return budget;
  }

  async getBudgetWithPeriod(
    level: BudgetLevel,
    targetId: string,
  ): Promise<{ budget: Budget; period: BudgetPeriod | null }> {
    const budget = await this.getBudget(level, targetId);
    const period = budget.currentPeriodId
      ? await this.periodRepo.findOne({
          where: { id: budget.currentPeriodId },
        })
      : null;
    return { budget, period };
  }

  async findBudgetForTarget(
    level: BudgetLevel,
    targetId: string,
  ): Promise<Budget | null> {
    return this.budgetRepo.findOne({ where: { level, targetId } });
  }

  async getActivePeriod(budgetId: string): Promise<BudgetPeriod | null> {
    return this.periodRepo.findOne({
      where: { budgetId, isActive: true },
    });
  }

  async getUsageSummary(
    orgId: string,
    period?: string,
  ): Promise<{
    org: any;
    teams: any[];
    users: any[];
  }> {
    // Get all budgets for this org
    const budgets = await this.budgetRepo.find({ where: { orgId } });

    const result: { org: any; teams: any[]; users: any[] } = {
      org: null,
      teams: [],
      users: [],
    };

    for (const budget of budgets) {
      const activePeriod = await this.getActivePeriod(budget.id);
      if (!activePeriod) continue;

      const summary = {
        budget_id: budget.id,
        target_id: budget.targetId,
        token_limit: Number(budget.tokenLimit),
        tokens_used: Number(activePeriod.totalTokensUsed),
        tokens_remaining:
          Number(budget.tokenLimit) - Number(activePeriod.totalTokensUsed),
        token_usage_pct:
          Number(budget.tokenLimit) > 0
            ? (Number(activePeriod.totalTokensUsed) /
                Number(budget.tokenLimit)) *
              100
            : 0,
        cost_limit_usd: Number(budget.costLimitUsd),
        cost_used_usd: Number(activePeriod.totalCostUsd),
        cost_remaining_usd:
          Number(budget.costLimitUsd) - Number(activePeriod.totalCostUsd),
        cost_usage_pct:
          Number(budget.costLimitUsd) > 0
            ? (Number(activePeriod.totalCostUsd) /
                Number(budget.costLimitUsd)) *
              100
            : 0,
      };

      switch (budget.level) {
        case BudgetLevel.ORG:
          result.org = summary;
          break;
        case BudgetLevel.TEAM:
          result.teams.push(summary);
          break;
        case BudgetLevel.USER:
          result.users.push(summary);
          break;
      }
    }

    return result;
  }
}
