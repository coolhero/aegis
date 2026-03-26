import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { BudgetGuard } from './budget.guard';
import { BudgetEngineService } from './budget-engine.service';
import { ModelTierService } from './model-tier.service';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';

describe('BudgetGuard', () => {
  let guard: BudgetGuard;
  let budgetEngine: Record<string, jest.Mock>;
  let modelTierService: Record<string, jest.Mock>;

  const orgId = 'org-001';
  const userId = 'user-001';
  const teamId = 'team-001';

  const createMockContext = (overrides: {
    apiKey?: any;
    body?: any;
    headers?: Record<string, string>;
    id?: string;
  } = {}): ExecutionContext => {
    const request = {
      apiKey: overrides.apiKey ?? null,
      body: overrides.body ?? { model: 'gpt-4o', messages: [] },
      headers: overrides.headers ?? {},
      id: overrides.id ?? 'req-001',
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    budgetEngine = {
      isRedisAvailable: jest.fn().mockResolvedValue(true),
      reserve: jest.fn().mockResolvedValue({
        reservationId: 'res-001',
        periodIds: { org: 'period-001' },
      }),
    };

    modelTierService = {
      resolveTierForModel: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetGuard,
        { provide: REDIS_CLIENT, useValue: {} },
        { provide: BudgetEngineService, useValue: budgetEngine },
        { provide: ModelTierService, useValue: modelTierService },
      ],
    }).compile();

    guard = module.get(BudgetGuard);
  });

  // ─── Redis fail-closed ─────────────────────────────────

  describe('Redis fail-closed', () => {
    it('should throw 503 when Redis is unavailable', async () => {
      budgetEngine.isRedisAvailable.mockResolvedValue(false);
      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId },
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
      try {
        await guard.canActivate(ctx);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(e.getResponse()).toEqual(
          expect.objectContaining({ error: 'service_unavailable' }),
        );
      }
    });
  });

  // ─── No API key (internal request) ────────────────────

  describe('No API key', () => {
    it('should allow request without API key (no budget enforcement)', async () => {
      const ctx = createMockContext({ apiKey: null });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(budgetEngine.reserve).not.toHaveBeenCalled();
    });
  });

  // ─── Successful reservation ────────────────────────────

  describe('Successful reservation', () => {
    it('should reserve budget and attach reservation to request', async () => {
      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId },
        body: {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello world' }],
        },
      });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          teamId,
          orgId,
          modelId: 'gpt-4o',
        }),
      );

      // reservation should be attached to request
      const request = ctx.switchToHttp().getRequest() as any;
      expect(request.budgetReservation).toEqual(
        expect.objectContaining({ reservationId: 'res-001' }),
      );
    });

    it('should pass modelTierId from tier resolution', async () => {
      modelTierService.resolveTierForModel.mockResolvedValue('tier-premium');

      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
        body: { model: 'claude-opus-4', messages: [] },
      });

      await guard.canActivate(ctx);

      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ modelTierId: 'tier-premium' }),
      );
    });

    it('should pass idempotency key from header', async () => {
      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
        headers: { 'x-idempotency-key': 'idem-abc' },
      });

      await guard.canActivate(ctx);

      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'idem-abc' }),
      );
    });
  });

  // ─── Budget exceeded ───────────────────────────────────

  describe('Budget exceeded', () => {
    it('should throw 429 with details when budget is exceeded', async () => {
      budgetEngine.reserve.mockRejectedValue({
        type: 'budget_exceeded',
        level: 'user',
        remainingTokens: 50,
        remainingCost: 0.001,
      });

      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
      });

      try {
        await guard.canActivate(ctx);
        fail('Expected HttpException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const body = e.getResponse();
        expect(body.error).toBe('budget_exceeded');
        expect(body.details.level).toBe('user');
        expect(body.details.remaining_tokens).toBe(50);
      }
    });

    it('should include tier info in 429 response when tier budget exceeded', async () => {
      budgetEngine.reserve.mockRejectedValue({
        type: 'budget_exceeded',
        level: 'org',
        tier: 'tier-premium',
        remainingTokens: 0,
        remainingCost: 0,
      });

      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
      });

      try {
        await guard.canActivate(ctx);
        fail('Expected HttpException');
      } catch (e: any) {
        const body = e.getResponse();
        expect(body.message).toContain('tier: tier-premium');
        expect(body.details.tier).toBe('tier-premium');
      }
    });
  });

  // ─── Unexpected errors (fail-closed) ──────────────────

  describe('Unexpected errors', () => {
    it('should throw 503 on unexpected reserve error', async () => {
      budgetEngine.reserve.mockRejectedValue(new Error('Redis EVALSHA failed'));

      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
      });

      try {
        await guard.canActivate(ctx);
        fail('Expected HttpException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });
  });

  // ─── Token estimation ─────────────────────────────────

  describe('Token estimation', () => {
    it('should estimate tokens based on message content length', async () => {
      const longMessage = 'a'.repeat(400); // 400 chars → ~100 tokens
      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
        body: {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: longMessage }],
        },
      });

      await guard.canActivate(ctx);

      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ estimatedTokens: 100 }),
      );
    });

    it('should use minimum 50 tokens for empty messages', async () => {
      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
        body: { model: 'gpt-4o', messages: [{ role: 'user', content: '' }] },
      });

      await guard.canActivate(ctx);

      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ estimatedTokens: 50 }),
      );
    });

    it('should default to 100 tokens when no messages provided', async () => {
      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
        body: { model: 'gpt-4o' },
      });

      await guard.canActivate(ctx);

      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ estimatedTokens: 100 }),
      );
    });

    it('should proceed with global-only budget when tier resolution fails', async () => {
      modelTierService.resolveTierForModel.mockRejectedValue(
        new Error('DB error'),
      );

      const ctx = createMockContext({
        apiKey: { orgId, userId, teamId: null },
      });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(budgetEngine.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ modelTierId: null }),
      );
    });
  });
});
