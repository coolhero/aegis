import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';
import { Budget } from './entities/budget.entity';
import { BudgetPeriod } from './entities/budget-period.entity';
import { AlertRecord } from './entities/alert-record.entity';

export interface AlertPayload {
  budget_id: string;
  level: string;
  target_id: string;
  threshold: number;
  usage_pct: number;
  period: { start: string; end: string };
  tokens_used: number;
  token_limit: number;
  cost_used_usd: number;
  cost_limit_usd: number;
}

@Injectable()
export class BudgetAlertService {
  private readonly logger = new Logger(BudgetAlertService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: any,
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(BudgetPeriod)
    private readonly periodRepo: Repository<BudgetPeriod>,
    @InjectRepository(AlertRecord)
    private readonly alertRepo: Repository<AlertRecord>,
  ) {}

  async checkAndAlert(budgetId: string): Promise<void> {
    const budget = await this.budgetRepo.findOne({ where: { id: budgetId } });
    if (!budget || !budget.currentPeriodId || !budget.webhookUrl) return;

    const period = await this.periodRepo.findOne({
      where: { id: budget.currentPeriodId },
    });
    if (!period) return;

    const tokenUsagePct =
      Number(budget.tokenLimit) > 0
        ? (Number(period.totalTokensUsed) / Number(budget.tokenLimit)) * 100
        : 0;
    const costUsagePct =
      Number(budget.costLimitUsd) > 0
        ? (Number(period.totalCostUsd) / Number(budget.costLimitUsd)) * 100
        : 0;
    const usagePct = Math.max(tokenUsagePct, costUsagePct);

    for (const threshold of budget.alertThresholds) {
      if (usagePct >= threshold) {
        await this.triggerAlert(budget, period, threshold, usagePct);
      }
    }
  }

  private async triggerAlert(
    budget: Budget,
    period: BudgetPeriod,
    threshold: number,
    usagePct: number,
  ): Promise<void> {
    // Redis dedup check
    const dedupKey = `alert:${budget.id}:${period.id}:${threshold}`;
    const exists = await this.redis.exists(dedupKey);
    if (exists) return;

    // DB dedup check (belt and suspenders)
    const existingAlert = await this.alertRepo.findOne({
      where: {
        budgetId: budget.id,
        periodId: period.id,
        threshold,
      },
    });
    if (existingAlert) {
      await this.redis.set(dedupKey, '1');
      return;
    }

    // Create AlertRecord with pending status
    const alert = await this.alertRepo.save(
      this.alertRepo.create({
        budgetId: budget.id,
        periodId: period.id,
        threshold,
        usagePct,
        webhookStatus: 'pending',
      }),
    );

    // Set Redis dedup key
    await this.redis.set(dedupKey, '1');

    // Send webhook with retry (FR-017)
    const payload: AlertPayload = {
      budget_id: budget.id,
      level: budget.level,
      target_id: budget.targetId,
      threshold,
      usage_pct: Math.round(usagePct * 100) / 100,
      period: {
        start: period.startDate.toISOString(),
        end: period.endDate.toISOString(),
      },
      tokens_used: Number(period.totalTokensUsed),
      token_limit: Number(budget.tokenLimit),
      cost_used_usd: Number(period.totalCostUsd),
      cost_limit_usd: Number(budget.costLimitUsd),
    };

    const success = await this.sendWebhookWithRetry(
      budget.webhookUrl!,
      payload,
      3,
    );

    // Update AlertRecord status (SC-015)
    await this.alertRepo.update(alert.id, {
      webhookStatus: success ? 'sent' : 'failed',
    });

    this.logger.log(
      `Alert ${threshold}% for budget ${budget.id}: webhook ${success ? 'sent' : 'failed'}`,
    );
  }

  private async sendWebhookWithRetry(
    url: string,
    payload: AlertPayload,
    maxRetries: number,
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) return true;

        this.logger.warn(
          `Webhook attempt ${attempt + 1}/${maxRetries + 1} failed: ${response.status}`,
        );
      } catch (error: any) {
        this.logger.warn(
          `Webhook attempt ${attempt + 1}/${maxRetries + 1} error: ${error?.message}`,
        );
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return false;
  }
}
