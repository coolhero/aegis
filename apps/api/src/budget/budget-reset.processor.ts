import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Queue } from 'bullmq';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';
import { Budget } from './entities/budget.entity';
import { BudgetPeriod } from './entities/budget-period.entity';
import { BudgetEngineService } from './budget-engine.service';

@Injectable()
export class BudgetResetProcessor implements OnModuleInit {
  private readonly logger = new Logger(BudgetResetProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: any,
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(BudgetPeriod)
    private readonly periodRepo: Repository<BudgetPeriod>,
    private readonly budgetEngine: BudgetEngineService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: this.redis.options?.host ?? 'localhost',
      port: this.redis.options?.port ?? 6379,
    };

    this.queue = new Queue('budget-reset', { connection });
    this.worker = new Worker(
      'budget-reset',
      async (job) => {
        await this.processReset(job.data);
      },
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Budget reset job failed: ${err.message}`);
    });

    // Schedule monthly reset: 1st day of each month at 00:00 UTC
    await this.queue.upsertJobScheduler(
      'monthly-reset',
      { pattern: '0 0 1 * *' },
      { name: 'reset-all-budgets', data: {} },
    );

    this.logger.log('Budget reset scheduler initialized');
  }

  private async processReset(data: any): Promise<void> {
    this.logger.log('Starting monthly budget reset...');

    const budgets = await this.budgetRepo.find({
      where: { enabled: true },
    });

    let resetCount = 0;

    for (const budget of budgets) {
      try {
        await this.resetBudget(budget);
        resetCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to reset budget ${budget.id}: ${error?.message}`,
        );
      }
    }

    this.logger.log(
      `Monthly reset complete: ${resetCount}/${budgets.length} budgets reset`,
    );
  }

  private async resetBudget(budget: Budget): Promise<void> {
    // Deactivate current period
    if (budget.currentPeriodId) {
      await this.periodRepo.update(budget.currentPeriodId, {
        isActive: false,
      });
    }

    // Create new period
    const now = new Date();
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const endDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const newPeriod = await this.periodRepo.save(
      this.periodRepo.create({
        budgetId: budget.id,
        startDate,
        endDate,
        isActive: true,
      }),
    );

    // Update budget's current period
    await this.budgetRepo.update(budget.id, {
      currentPeriodId: newPeriod.id,
    });

    // Reset Redis counters
    await this.budgetEngine.syncBudgetToRedis(
      { ...budget, currentPeriodId: newPeriod.id },
      newPeriod,
    );

    this.logger.log(
      `Reset budget ${budget.level}/${budget.targetId} — new period ${newPeriod.id}`,
    );
  }
}
