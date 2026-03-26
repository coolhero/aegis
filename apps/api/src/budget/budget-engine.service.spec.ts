import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BudgetEngineService, ReservationInput } from './budget-engine.service';
import { Budget, BudgetLevel } from './entities/budget.entity';
import { BudgetPeriod } from './entities/budget-period.entity';
import { UsageRecord, UsageRecordStatus } from './entities/usage-record.entity';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';

describe('BudgetEngineService', () => {
  let service: BudgetEngineService;
  let redis: Record<string, jest.Mock>;
  let budgetRepo: Record<string, jest.Mock>;
  let periodRepo: Record<string, jest.Mock | any>;
  let usageRepo: Record<string, jest.Mock>;

  const orgId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000002';
  const teamId = '00000000-0000-0000-0000-000000000003';
  const budgetId = '00000000-0000-0000-0000-000000000010';
  const periodId = '00000000-0000-0000-0000-000000000020';

  const makeBudget = (overrides: Partial<Budget> = {}): Budget =>
    ({
      id: budgetId,
      level: BudgetLevel.ORG,
      targetId: orgId,
      orgId,
      modelTierId: null,
      tokenLimit: 100000,
      costLimitUsd: 50,
      alertThresholds: [80, 90, 100],
      periodType: 'monthly',
      webhookUrl: null,
      enabled: true,
      currentPeriodId: periodId,
      ...overrides,
    }) as Budget;

  const makePeriod = (overrides: Partial<BudgetPeriod> = {}): BudgetPeriod =>
    ({
      id: periodId,
      budgetId,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-04-01'),
      totalTokensUsed: 0,
      totalCostUsd: 0,
      isActive: true,
      ...overrides,
    }) as BudgetPeriod;

  beforeEach(async () => {
    redis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      eval: jest.fn(),
      hgetall: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockResolvedValue(1),
      incrby: jest.fn().mockResolvedValue(0),
      decrby: jest.fn().mockResolvedValue(0),
      incrbyfloat: jest.fn().mockResolvedValue('0'),
      set: jest.fn().mockResolvedValue('OK'),
    };

    budgetRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const mockQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    periodRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    usageRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetEngineService,
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: getRepositoryToken(Budget), useValue: budgetRepo },
        { provide: getRepositoryToken(BudgetPeriod), useValue: periodRepo },
        { provide: getRepositoryToken(UsageRecord), useValue: usageRepo },
      ],
    }).compile();

    service = module.get(BudgetEngineService);
  });

  // ─── isRedisAvailable ──────────────────────────────────

  describe('isRedisAvailable', () => {
    it('should return true when Redis responds PONG', async () => {
      expect(await service.isRedisAvailable()).toBe(true);
    });

    it('should return false when Redis throws', async () => {
      redis.ping.mockRejectedValue(new Error('connection refused'));
      expect(await service.isRedisAvailable()).toBe(false);
    });
  });

  // ─── reserve ───────────────────────────────────────────

  describe('reserve', () => {
    const baseInput: ReservationInput = {
      userId,
      teamId: null,
      orgId,
      estimatedTokens: 500,
      estimatedCost: 0.01,
      modelId: 'gpt-4o',
      requestId: '00000000-0000-0000-0000-aaaaaaaaaaaa',
    };

    it('should return existing reservation on idempotency hit', async () => {
      const existingRecord = {
        id: 'existing-res-id',
        periodId: periodId,
        status: UsageRecordStatus.RESERVED,
      };
      usageRepo.findOne.mockResolvedValue(existingRecord);

      const result = await service.reserve({
        ...baseInput,
        idempotencyKey: 'idem-key-1',
      });

      expect(result.reservationId).toBe('existing-res-id');
      expect(result.periodIds.org).toBe(periodId);
      expect(redis.eval).not.toHaveBeenCalled();
    });

    it('should skip idempotency if existing record is not RESERVED', async () => {
      usageRepo.findOne.mockResolvedValue({
        id: 'old-res',
        status: UsageRecordStatus.RECONCILED,
      });

      // No budget found → Lua returns allowed with no budget checks
      redis.eval.mockResolvedValue(
        JSON.stringify({ allowed: true, reservation_id: 'new-res' }),
      );

      const result = await service.reserve({
        ...baseInput,
        idempotencyKey: 'idem-key-2',
      });

      expect(result.reservationId).toBeDefined();
      expect(redis.eval).toHaveBeenCalled();
    });

    it('should call Lua script and return reservation on success', async () => {
      const budget = makeBudget();
      const period = makePeriod();

      // org budget found
      budgetRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.level === BudgetLevel.ORG && where.modelTierId === null)
          return budget;
        return null;
      });
      periodRepo.findOne.mockResolvedValue(period);

      redis.eval.mockResolvedValue(
        JSON.stringify({ allowed: true, reservation_id: 'lua-res-id' }),
      );

      const result = await service.reserve(baseInput);

      expect(result.reservationId).toBeDefined();
      expect(result.periodIds.org).toBe(periodId);
      expect(redis.eval).toHaveBeenCalled();
      expect(usageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetId,
          periodId,
          modelId: 'gpt-4o',
          status: UsageRecordStatus.RESERVED,
        }),
      );
    });

    it('should reject with budget_exceeded when Lua denies at org level', async () => {
      const budget = makeBudget();
      const period = makePeriod();

      budgetRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.level === BudgetLevel.ORG && where.modelTierId === null)
          return budget;
        return null;
      });
      periodRepo.findOne.mockResolvedValue(period);

      redis.eval.mockResolvedValue(
        JSON.stringify({
          allowed: false,
          denied_at: 'org',
          remaining_tokens: 100,
          remaining_cost: 0.5,
        }),
      );

      await expect(service.reserve(baseInput)).rejects.toEqual(
        expect.objectContaining({
          type: 'budget_exceeded',
          level: 'org',
          remainingTokens: 100,
          remainingCost: 0.5,
        }),
      );
    });

    it('should check tier-specific budget before global budget', async () => {
      const tierId = '00000000-0000-0000-0000-000000000099';
      const tierBudget = makeBudget({ modelTierId: tierId, id: 'tier-budget' });
      const tierPeriod = makePeriod({ id: 'tier-period', budgetId: 'tier-budget' });
      const globalBudget = makeBudget();
      const globalPeriod = makePeriod();

      budgetRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.modelTierId === tierId && where.level === BudgetLevel.ORG)
          return tierBudget;
        if (where.modelTierId === null && where.level === BudgetLevel.ORG)
          return globalBudget;
        return null;
      });
      periodRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 'tier-period') return tierPeriod;
        if (where.id === periodId) return globalPeriod;
        return null;
      });

      // Tier check → allowed, Global check → allowed
      redis.eval
        .mockResolvedValueOnce(
          JSON.stringify({ allowed: true, reservation_id: 'tier-ok' }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({ allowed: true, reservation_id: 'global-ok' }),
        );

      const result = await service.reserve({
        ...baseInput,
        modelTierId: tierId,
      });

      expect(redis.eval).toHaveBeenCalledTimes(2);
      expect(result.reservationId).toBeDefined();
    });

    it('should rollback tier reservation when global budget is denied', async () => {
      const tierId = '00000000-0000-0000-0000-000000000099';
      const tierBudget = makeBudget({ modelTierId: tierId, id: 'tier-budget' });
      const tierPeriod = makePeriod({ id: 'tier-period', budgetId: 'tier-budget' });
      const globalBudget = makeBudget();
      const globalPeriod = makePeriod();

      budgetRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.modelTierId === tierId && where.level === BudgetLevel.ORG)
          return tierBudget;
        if (where.modelTierId === null && where.level === BudgetLevel.ORG)
          return globalBudget;
        return null;
      });
      periodRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 'tier-period') return tierPeriod;
        if (where.id === periodId) return globalPeriod;
        return null;
      });

      // Tier → allowed, Global → denied
      redis.eval
        .mockResolvedValueOnce(
          JSON.stringify({ allowed: true, reservation_id: 'tier-ok' }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({ allowed: false, denied_at: 'org', remaining_tokens: 0, remaining_cost: 0 }),
        );

      await expect(
        service.reserve({ ...baseInput, modelTierId: tierId }),
      ).rejects.toEqual(
        expect.objectContaining({ type: 'budget_exceeded', level: 'org' }),
      );

      // Should have cleaned up tier reservation
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('reservation:tier:'),
      );
    });
  });

  // ─── reconcile ─────────────────────────────────────────

  describe('reconcile', () => {
    it('should silently return when reservation not found', async () => {
      redis.hgetall.mockResolvedValue({});
      await service.reconcile({
        reservationId: 'missing',
        actualInputTokens: 100,
        actualOutputTokens: 50,
        costUsd: 0.02,
      });
      expect(usageRepo.update).not.toHaveBeenCalled();
    });

    it('should update usage record to RECONCILED and clean up', async () => {
      redis.hgetall.mockResolvedValue({
        tokens: '500',
        cost: '0.01',
        user_period: '',
        team_period: '',
        org_period: periodId,
        has_user: '0',
        has_team: '0',
        has_org: '1',
      });

      await service.reconcile({
        reservationId: 'res-123',
        actualInputTokens: 300,
        actualOutputTokens: 200,
        costUsd: 0.02,
      });

      expect(usageRepo.update).toHaveBeenCalledWith(
        'res-123',
        expect.objectContaining({
          inputTokens: 300,
          outputTokens: 200,
          costUsd: 0.02,
          status: UsageRecordStatus.RECONCILED,
        }),
      );
      expect(redis.del).toHaveBeenCalledWith('reservation:res-123');
    });
  });

  // ─── release ───────────────────────────────────────────

  describe('release', () => {
    it('should silently return when reservation not found', async () => {
      redis.hgetall.mockResolvedValue({});
      await service.release('missing');
      expect(usageRepo.update).not.toHaveBeenCalled();
    });

    it('should reverse Redis counters and mark as RELEASED', async () => {
      redis.hgetall.mockResolvedValue({
        tokens: '500',
        cost: '0.01',
        user_period: '',
        team_period: '',
        org_period: periodId,
        has_user: '0',
        has_team: '0',
        has_org: '1',
      });

      await service.release('res-456');

      expect(usageRepo.update).toHaveBeenCalledWith('res-456', {
        status: UsageRecordStatus.RELEASED,
      });
      expect(redis.del).toHaveBeenCalledWith('reservation:res-456');
    });
  });

  // ─── syncBudgetToRedis ─────────────────────────────────

  describe('syncBudgetToRedis', () => {
    it('should set tokens, cost, and period keys in Redis', async () => {
      const budget = makeBudget();
      const period = makePeriod({ totalTokensUsed: 5000, totalCostUsd: 2.5 });

      await service.syncBudgetToRedis(budget, period);

      expect(redis.set).toHaveBeenCalledWith(
        `budget:org:${orgId}:tokens`,
        '5000',
      );
      expect(redis.set).toHaveBeenCalledWith(
        `budget:org:${orgId}:cost`,
        '2.5',
      );
      expect(redis.set).toHaveBeenCalledWith(
        `budget:org:${orgId}:period`,
        periodId,
      );
    });
  });
});
