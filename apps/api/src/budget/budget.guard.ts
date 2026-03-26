import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';
import { BudgetEngineService } from './budget-engine.service';
import { ModelTierService } from './model-tier.service';

@Injectable()
export class BudgetGuard implements CanActivate {
  private readonly logger = new Logger(BudgetGuard.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly budgetEngine: BudgetEngineService,
    private readonly modelTierService: ModelTierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // FR-015: Redis fail-closed — reject if Redis unavailable
    const redisAvailable = await this.budgetEngine.isRedisAvailable();
    if (!redisAvailable) {
      this.logger.error('Redis unavailable — fail-closed, rejecting request');
      throw new HttpException(
        {
          statusCode: 503,
          error: 'service_unavailable',
          message: 'Budget service temporarily unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Extract tenant context from API key auth
    const apiKey = request.apiKey;
    if (!apiKey) {
      // No API key = no budget enforcement (internal request)
      return true;
    }

    const orgId = apiKey.orgId;
    const userId = apiKey.userId;
    const teamId = apiKey.teamId ?? null;
    const body = request.body;

    // FR-016: Pessimistic token estimation (input + output + overhead)
    const estimatedTokens = this.estimateTokens(body?.messages, body);
    const estimatedCost = 0; // Cost will be calculated after model resolution

    // Check for idempotency key
    const idempotencyKey = request.headers['x-idempotency-key'] ?? null;

    // FR-020: Resolve model → tier for tier-specific budget check
    const modelName = body?.model ?? 'unknown';
    let modelTierId: string | null = null;
    try {
      modelTierId = await this.modelTierService.resolveTierForModel(modelName);
    } catch {
      // If tier resolution fails, proceed with global-only budget
    }

    try {
      const result = await this.budgetEngine.reserve({
        userId,
        teamId,
        orgId,
        estimatedTokens,
        estimatedCost,
        modelId: modelName,
        requestId: request.id ?? randomUUID(),
        idempotencyKey,
        modelTierId,
      });

      // Store reservation info on request for reconciliation
      request.budgetReservation = {
        reservationId: result.reservationId,
        estimatedTokens,
        modelTierId,
      };

      return true;
    } catch (error: any) {
      if (error?.type === 'budget_exceeded') {
        throw new HttpException(
          {
            statusCode: 429,
            error: 'budget_exceeded',
            message: `Token budget exceeded at ${error.level} level${error.tier ? ` (tier: ${error.tier})` : ''}`,
            details: {
              level: error.level,
              tier: error.tier ?? null,
              remaining_tokens: error.remainingTokens,
              remaining_cost_usd: error.remainingCost,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Redis error during Lua execution — fail-closed
      this.logger.error(`Budget check failed: ${error?.message ?? error}`);
      throw new HttpException(
        {
          statusCode: 503,
          error: 'service_unavailable',
          message: 'Budget service temporarily unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private estimateTokens(messages: any[] | undefined, body: any): number {
    if (!messages || messages.length === 0) return 100;

    // Input estimation: content + per-message overhead
    let inputTokens = messages.length * 4; // ~4 tokens/msg for role + delimiters
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        // ~3 chars/token: conservative ratio covering Korean (~2) and English (~4)
        inputTokens += Math.ceil(msg.content.length / 3);
      }
    }

    // Output estimation: use max_tokens if provided, otherwise default 256
    const maxTokens = body?.max_tokens;
    const outputEstimate = maxTokens
      ? Math.min(maxTokens, 4096) // cap to avoid over-reservation
      : 256;

    return Math.max(inputTokens + outputEstimate, 50);
  }
}
