import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, UserRole } from '@aegis/common';
import { BudgetService } from './budget.service';
import { SetBudgetDto } from './dto/set-budget.dto';
import { BudgetResponseDto } from './dto/budget-response.dto';
import { BudgetLevel } from './entities/budget.entity';

@Controller('budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Put(':level/:id')
  @Roles(UserRole.ADMIN)
  async setBudget(
    @Param('level') level: string,
    @Param('id') targetId: string,
    @Query('model_tier_id') modelTierId: string | undefined,
    @Body() dto: SetBudgetDto,
    @Req() req: any,
  ): Promise<BudgetResponseDto> {
    const budgetLevel = this.validateLevel(level);
    const orgId = req.user.orgId;

    const budget = await this.budgetService.setBudget(
      budgetLevel,
      targetId,
      orgId,
      dto,
      modelTierId ?? null,
    );

    const { period } = await this.budgetService.getBudgetWithPeriod(
      budgetLevel,
      targetId,
    );

    return this.toBudgetResponse(budget, period);
  }

  @Get(':level/:id')
  async getBudget(
    @Param('level') level: string,
    @Param('id') targetId: string,
    @Req() req: any,
  ): Promise<BudgetResponseDto> {
    const budgetLevel = this.validateLevel(level);
    const { budget, period } = await this.budgetService.getBudgetWithPeriod(
      budgetLevel,
      targetId,
    );

    // RBAC: Member can only see their own budget
    if (req.user.role === UserRole.MEMBER && budgetLevel === BudgetLevel.USER) {
      if (targetId !== req.user.userId) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
    }

    return this.toBudgetResponse(budget, period);
  }

  private validateLevel(level: string): BudgetLevel {
    if (!Object.values(BudgetLevel).includes(level as BudgetLevel)) {
      throw new HttpException(
        `Invalid budget level: ${level}. Must be org, team, or user`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return level as BudgetLevel;
  }

  private toBudgetResponse(budget: any, period: any): BudgetResponseDto {
    return {
      id: budget.id,
      level: budget.level,
      target_id: budget.targetId,
      token_limit: Number(budget.tokenLimit),
      cost_limit_usd: Number(budget.costLimitUsd),
      alert_thresholds: budget.alertThresholds,
      period_type: budget.periodType,
      webhook_url: budget.webhookUrl,
      enabled: budget.enabled,
      current_period: period
        ? {
            id: period.id,
            start_date: period.startDate.toISOString(),
            end_date: period.endDate.toISOString(),
            total_tokens_used: Number(period.totalTokensUsed),
            total_cost_usd: Number(period.totalCostUsd),
          }
        : null,
    };
  }
}

@Controller('usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsageController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get(':level/:id')
  async getUsage(
    @Param('level') level: string,
    @Param('id') targetId: string,
    @Query('period') period: string | undefined,
    @Req() req: any,
  ) {
    // RBAC: Member can only see their own usage
    if (req.user.role === UserRole.MEMBER && level === 'user') {
      if (targetId !== req.user.userId) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
    }

    const budgetLevel = level as BudgetLevel;
    const { budget, period: currentPeriod } =
      await this.budgetService.getBudgetWithPeriod(budgetLevel, targetId);

    if (!currentPeriod) {
      throw new HttpException('No active period', HttpStatus.NOT_FOUND);
    }

    return {
      budget_id: budget.id,
      level: budget.level,
      target_id: budget.targetId,
      period: {
        start_date: currentPeriod.startDate.toISOString(),
        end_date: currentPeriod.endDate.toISOString(),
      },
      token_limit: Number(budget.tokenLimit),
      tokens_used: Number(currentPeriod.totalTokensUsed),
      tokens_remaining:
        Number(budget.tokenLimit) - Number(currentPeriod.totalTokensUsed),
      token_usage_pct:
        Number(budget.tokenLimit) > 0
          ? Math.round(
              (Number(currentPeriod.totalTokensUsed) /
                Number(budget.tokenLimit)) *
                10000,
            ) / 100
          : 0,
      cost_limit_usd: Number(budget.costLimitUsd),
      cost_used_usd: Number(currentPeriod.totalCostUsd),
      cost_remaining_usd:
        Number(budget.costLimitUsd) - Number(currentPeriod.totalCostUsd),
      cost_usage_pct:
        Number(budget.costLimitUsd) > 0
          ? Math.round(
              (Number(currentPeriod.totalCostUsd) /
                Number(budget.costLimitUsd)) *
                10000,
            ) / 100
          : 0,
    };
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  async getUsageSummary(
    @Query('period') period: string | undefined,
    @Req() req: any,
  ) {
    return this.budgetService.getUsageSummary(req.user.orgId, period);
  }
}
