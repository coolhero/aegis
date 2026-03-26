import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';
import { Budget, BudgetLevel } from './entities/budget.entity';
import { BudgetPeriod } from './entities/budget-period.entity';
import { UsageRecord, UsageRecordStatus } from './entities/usage-record.entity';
import { randomUUID } from 'crypto';

export interface ReservationInput {
  userId: string;
  teamId: string | null;
  orgId: string;
  estimatedTokens: number;
  estimatedCost: number;
  modelId: string;
  requestId: string;
  idempotencyKey?: string;
  modelTierId?: string | null;
}

export interface ReservationResult {
  reservationId: string;
  periodIds: { user?: string; team?: string; org?: string };
}

export interface ReconcileInput {
  reservationId: string;
  actualInputTokens: number;
  actualOutputTokens: number;
  costUsd: number;
}

interface LuaResult {
  allowed: boolean;
  reservation_id?: string;
  denied_at?: 'user' | 'team' | 'org';
  remaining_tokens?: number;
  remaining_cost?: number;
}

// Lua script inlined to avoid webpack file resolution issues
const CHECK_AND_RESERVE_LUA = `
local est_tokens = tonumber(ARGV[1])
local est_cost = tonumber(ARGV[2])
local user_limit_tokens = tonumber(ARGV[3])
local user_limit_cost = tonumber(ARGV[4])
local team_limit_tokens = tonumber(ARGV[5])
local team_limit_cost = tonumber(ARGV[6])
local org_limit_tokens = tonumber(ARGV[7])
local org_limit_cost = tonumber(ARGV[8])
local reservation_id = ARGV[9]
local user_period_id = ARGV[10]
local team_period_id = ARGV[11]
local org_period_id = ARGV[12]
local ttl = tonumber(ARGV[13])
local has_user = tonumber(ARGV[14])
local has_team = tonumber(ARGV[15])
local has_org = tonumber(ARGV[16])

if has_user == 1 then
  local user_tokens = tonumber(redis.call('GET', KEYS[1]) or '0')
  local user_cost = tonumber(redis.call('GET', KEYS[2]) or '0')
  if user_limit_tokens > 0 and (user_tokens + est_tokens) > user_limit_tokens then
    return cjson.encode({allowed = false, denied_at = 'user', remaining_tokens = user_limit_tokens - user_tokens, remaining_cost = user_limit_cost - user_cost})
  end
  if user_limit_cost > 0 and (user_cost + est_cost) > user_limit_cost then
    return cjson.encode({allowed = false, denied_at = 'user', remaining_tokens = user_limit_tokens - user_tokens, remaining_cost = user_limit_cost - user_cost})
  end
end

if has_team == 1 then
  local team_tokens = tonumber(redis.call('GET', KEYS[3]) or '0')
  local team_cost = tonumber(redis.call('GET', KEYS[4]) or '0')
  if team_limit_tokens > 0 and (team_tokens + est_tokens) > team_limit_tokens then
    return cjson.encode({allowed = false, denied_at = 'team', remaining_tokens = team_limit_tokens - team_tokens, remaining_cost = team_limit_cost - team_cost})
  end
  if team_limit_cost > 0 and (team_cost + est_cost) > team_limit_cost then
    return cjson.encode({allowed = false, denied_at = 'team', remaining_tokens = team_limit_tokens - team_tokens, remaining_cost = team_limit_cost - team_cost})
  end
end

if has_org == 1 then
  local org_tokens = tonumber(redis.call('GET', KEYS[5]) or '0')
  local org_cost = tonumber(redis.call('GET', KEYS[6]) or '0')
  if org_limit_tokens > 0 and (org_tokens + est_tokens) > org_limit_tokens then
    return cjson.encode({allowed = false, denied_at = 'org', remaining_tokens = org_limit_tokens - org_tokens, remaining_cost = org_limit_cost - org_cost})
  end
  if org_limit_cost > 0 and (org_cost + est_cost) > org_limit_cost then
    return cjson.encode({allowed = false, denied_at = 'org', remaining_tokens = org_limit_tokens - org_tokens, remaining_cost = org_limit_cost - org_cost})
  end
end

if has_user == 1 then
  redis.call('INCRBY', KEYS[1], est_tokens)
  redis.call('INCRBYFLOAT', KEYS[2], est_cost)
end
if has_team == 1 then
  redis.call('INCRBY', KEYS[3], est_tokens)
  redis.call('INCRBYFLOAT', KEYS[4], est_cost)
end
if has_org == 1 then
  redis.call('INCRBY', KEYS[5], est_tokens)
  redis.call('INCRBYFLOAT', KEYS[6], est_cost)
end

redis.call('HSET', KEYS[7],
  'tokens', est_tokens, 'cost', est_cost,
  'user_key', KEYS[1], 'team_key', KEYS[3], 'org_key', KEYS[5],
  'user_period', user_period_id, 'team_period', team_period_id, 'org_period', org_period_id,
  'has_user', has_user, 'has_team', has_team, 'has_org', has_org
)
redis.call('EXPIRE', KEYS[7], ttl)

return cjson.encode({allowed = true, reservation_id = reservation_id})
`;

@Injectable()
export class BudgetEngineService {
  private readonly logger = new Logger(BudgetEngineService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: any,
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(BudgetPeriod)
    private readonly periodRepo: Repository<BudgetPeriod>,
    @InjectRepository(UsageRecord)
    private readonly usageRepo: Repository<UsageRecord>,
  ) {}

  async isRedisAvailable(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async reserve(input: ReservationInput): Promise<ReservationResult> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existing = await this.usageRepo.findOne({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing && existing.status === UsageRecordStatus.RESERVED) {
        return {
          reservationId: existing.id,
          periodIds: { org: existing.periodId },
        };
      }
    }

    // Find GLOBAL budgets (model_tier_id = NULL)
    const userBudget = await this.findBudgetWithPeriod(BudgetLevel.USER, input.userId, null);
    const teamBudget = input.teamId
      ? await this.findBudgetWithPeriod(BudgetLevel.TEAM, input.teamId, null)
      : null;
    const orgBudget = await this.findBudgetWithPeriod(BudgetLevel.ORG, input.orgId, null);

    // Find TIER-SPECIFIC budgets (if model has a tier)
    const tierId = input.modelTierId ?? null;
    const userTierBudget = tierId
      ? await this.findBudgetWithPeriod(BudgetLevel.USER, input.userId, tierId)
      : null;
    const teamTierBudget = tierId && input.teamId
      ? await this.findBudgetWithPeriod(BudgetLevel.TEAM, input.teamId, tierId)
      : null;
    const orgTierBudget = tierId
      ? await this.findBudgetWithPeriod(BudgetLevel.ORG, input.orgId, tierId)
      : null;

    const reservationId = randomUUID();
    const tierSuffix = tierId ?? '*';

    // --- Step 1: Check TIER-SPECIFIC budgets first (if any) ---
    if (tierId && (userTierBudget || teamTierBudget || orgTierBudget)) {
      const tierKeys = [
        `budget:user:${input.userId}:${tierId}:tokens`,
        `budget:user:${input.userId}:${tierId}:cost`,
        `budget:team:${input.teamId}:${tierId}:tokens`,
        `budget:team:${input.teamId}:${tierId}:cost`,
        `budget:org:${input.orgId}:${tierId}:tokens`,
        `budget:org:${input.orgId}:${tierId}:cost`,
        `reservation:tier:${reservationId}`,
      ];

      const tierArgs = [
        String(input.estimatedTokens),
        String(input.estimatedCost),
        String(userTierBudget?.budget.tokenLimit ?? 0),
        String(userTierBudget?.budget.costLimitUsd ?? 0),
        String(teamTierBudget?.budget.tokenLimit ?? 0),
        String(teamTierBudget?.budget.costLimitUsd ?? 0),
        String(orgTierBudget?.budget.tokenLimit ?? 0),
        String(orgTierBudget?.budget.costLimitUsd ?? 0),
        reservationId,
        userTierBudget?.period?.id ?? '',
        teamTierBudget?.period?.id ?? '',
        orgTierBudget?.period?.id ?? '',
        '300',
        userTierBudget && userTierBudget.budget.enabled ? '1' : '0',
        teamTierBudget && teamTierBudget.budget.enabled ? '1' : '0',
        orgTierBudget && orgTierBudget.budget.enabled ? '1' : '0',
      ];

      const tierResultStr = (await this.redis.eval(
        CHECK_AND_RESERVE_LUA,
        tierKeys.length,
        ...tierKeys,
        ...tierArgs,
      )) as string;

      const tierResult: LuaResult = JSON.parse(tierResultStr);

      if (!tierResult.allowed) {
        return Promise.reject({
          type: 'budget_exceeded',
          level: tierResult.denied_at,
          tier: tierId,
          remainingTokens: tierResult.remaining_tokens,
          remainingCost: tierResult.remaining_cost,
        });
      }
    }

    // --- Step 2: Check GLOBAL budgets ---
    const keys = [
      `budget:user:${input.userId}:*:tokens`,
      `budget:user:${input.userId}:*:cost`,
      `budget:team:${input.teamId}:*:tokens`,
      `budget:team:${input.teamId}:*:cost`,
      `budget:org:${input.orgId}:*:tokens`,
      `budget:org:${input.orgId}:*:cost`,
      `reservation:${reservationId}`,
    ];

    const args = [
      String(input.estimatedTokens),
      String(input.estimatedCost),
      String(userBudget?.budget.tokenLimit ?? 0),
      String(userBudget?.budget.costLimitUsd ?? 0),
      String(teamBudget?.budget.tokenLimit ?? 0),
      String(teamBudget?.budget.costLimitUsd ?? 0),
      String(orgBudget?.budget.tokenLimit ?? 0),
      String(orgBudget?.budget.costLimitUsd ?? 0),
      reservationId,
      userBudget?.period?.id ?? '',
      teamBudget?.period?.id ?? '',
      orgBudget?.period?.id ?? '',
      '300',
      userBudget && userBudget.budget.enabled ? '1' : '0',
      teamBudget && teamBudget.budget.enabled ? '1' : '0',
      orgBudget && orgBudget.budget.enabled ? '1' : '0',
    ];

    const resultStr = (await this.redis.eval(
      CHECK_AND_RESERVE_LUA,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result: LuaResult = JSON.parse(resultStr);

    if (!result.allowed) {
      // Rollback tier reservation if global fails
      if (tierId) {
        await this.redis.del(`reservation:tier:${reservationId}`);
      }
      return Promise.reject({
        type: 'budget_exceeded',
        level: result.denied_at,
        remainingTokens: result.remaining_tokens,
        remainingCost: result.remaining_cost,
      });
    }

    // Create UsageRecord in DB (reserved status)
    const budgetForRecord =
      userBudget?.budget ?? teamBudget?.budget ?? orgBudget?.budget;
    const periodForRecord =
      userBudget?.period ?? teamBudget?.period ?? orgBudget?.period;

    if (budgetForRecord && periodForRecord) {
      await this.usageRepo.save(
        this.usageRepo.create({
          id: reservationId,
          budgetId: budgetForRecord.id,
          periodId: periodForRecord.id,
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey ?? null,
          modelId: input.modelId,
          estimatedTokens: input.estimatedTokens,
          costUsd: input.estimatedCost,
          status: UsageRecordStatus.RESERVED,
        }),
      );
    }

    return {
      reservationId,
      periodIds: {
        user: userBudget?.period?.id,
        team: teamBudget?.period?.id,
        org: orgBudget?.period?.id,
      },
    };
  }

  async reconcile(input: ReconcileInput): Promise<void> {
    const reservation = await this.getReservation(input.reservationId);
    if (!reservation) {
      this.logger.warn(`Reservation ${input.reservationId} not found or expired`);
      return;
    }

    const actualTokens = input.actualInputTokens + input.actualOutputTokens;
    const estimatedTokens = Number(reservation.tokens);
    const estimatedCost = Number(reservation.cost);
    const tokenDiff = actualTokens - estimatedTokens;
    const costDiff = input.costUsd - estimatedCost;

    // Adjust Redis counters with the difference using key paths stored in reservation hash
    if (reservation.has_user === '1' && reservation.user_key) {
      const tokenKey = reservation.user_key; // e.g. "budget:user:{id}:*:tokens"
      const costKey = tokenKey.replace(':tokens', ':cost');
      if (tokenDiff !== 0) {
        await this.redis.incrby(tokenKey, tokenDiff);
      }
      if (costDiff !== 0) {
        await this.redis.incrbyfloat(costKey, costDiff);
      }
    }
    if (reservation.has_team === '1' && reservation.team_key) {
      const tokenKey = reservation.team_key;
      const costKey = tokenKey.replace(':tokens', ':cost');
      if (tokenDiff !== 0) {
        await this.redis.incrby(tokenKey, tokenDiff);
      }
      if (costDiff !== 0) {
        await this.redis.incrbyfloat(costKey, costDiff);
      }
    }
    if (reservation.has_org === '1' && reservation.org_key) {
      const tokenKey = reservation.org_key;
      const costKey = tokenKey.replace(':tokens', ':cost');
      if (tokenDiff !== 0) {
        await this.redis.incrby(tokenKey, tokenDiff);
      }
      if (costDiff !== 0) {
        await this.redis.incrbyfloat(costKey, costDiff);
      }
    }

    // Also reconcile tier-specific reservation if it exists
    const tierReservation = await this.getReservation(`tier:${input.reservationId}`);
    if (tierReservation) {
      const tierEstTokens = Number(tierReservation.tokens);
      const tierEstCost = Number(tierReservation.cost);
      const tierTokenDiff = actualTokens - tierEstTokens;
      const tierCostDiff = input.costUsd - tierEstCost;

      if (tierReservation.has_user === '1' && tierReservation.user_key) {
        const tokenKey = tierReservation.user_key;
        const costKey = tokenKey.replace(':tokens', ':cost');
        if (tierTokenDiff !== 0) {
          await this.redis.incrby(tokenKey, tierTokenDiff);
        }
        if (tierCostDiff !== 0) {
          await this.redis.incrbyfloat(costKey, tierCostDiff);
        }
      }
      if (tierReservation.has_team === '1' && tierReservation.team_key) {
        const tokenKey = tierReservation.team_key;
        const costKey = tokenKey.replace(':tokens', ':cost');
        if (tierTokenDiff !== 0) {
          await this.redis.incrby(tokenKey, tierTokenDiff);
        }
        if (tierCostDiff !== 0) {
          await this.redis.incrbyfloat(costKey, tierCostDiff);
        }
      }
      if (tierReservation.has_org === '1' && tierReservation.org_key) {
        const tokenKey = tierReservation.org_key;
        const costKey = tokenKey.replace(':tokens', ':cost');
        if (tierTokenDiff !== 0) {
          await this.redis.incrby(tokenKey, tierTokenDiff);
        }
        if (tierCostDiff !== 0) {
          await this.redis.incrbyfloat(costKey, tierCostDiff);
        }
      }
      await this.redis.del(`reservation:tier:${input.reservationId}`);
    }

    // Update UsageRecord in DB
    await this.usageRepo.update(input.reservationId, {
      inputTokens: input.actualInputTokens,
      outputTokens: input.actualOutputTokens,
      costUsd: input.costUsd,
      status: UsageRecordStatus.RECONCILED,
      reconciledAt: new Date(),
    });

    // Update BudgetPeriod totals in DB
    await this.updatePeriodTotals(reservation, actualTokens, input.costUsd);

    // Clean up reservation
    await this.redis.del(`reservation:${input.reservationId}`);

    this.logger.log(
      `Reconciled ${input.reservationId}: est=${estimatedTokens} actual=${actualTokens} diff=${tokenDiff}`,
    );
  }

  async release(reservationId: string): Promise<void> {
    const reservation = await this.getReservation(reservationId);
    if (!reservation) {
      this.logger.warn(`Reservation ${reservationId} not found or expired`);
      return;
    }

    const tokens = Number(reservation.tokens);
    const cost = Number(reservation.cost);

    // Reverse the reservation from Redis counters using key paths from reservation hash
    if (reservation.has_user === '1' && reservation.user_key) {
      const tokenKey = reservation.user_key;
      const costKey = tokenKey.replace(':tokens', ':cost');
      await this.redis.decrby(tokenKey, tokens);
      await this.redis.incrbyfloat(costKey, -cost);
    }
    if (reservation.has_team === '1' && reservation.team_key) {
      const tokenKey = reservation.team_key;
      const costKey = tokenKey.replace(':tokens', ':cost');
      await this.redis.decrby(tokenKey, tokens);
      await this.redis.incrbyfloat(costKey, -cost);
    }
    if (reservation.has_org === '1' && reservation.org_key) {
      const tokenKey = reservation.org_key;
      const costKey = tokenKey.replace(':tokens', ':cost');
      await this.redis.decrby(tokenKey, tokens);
      await this.redis.incrbyfloat(costKey, -cost);
    }

    // Update UsageRecord in DB
    await this.usageRepo.update(reservationId, {
      status: UsageRecordStatus.RELEASED,
    });

    // Clean up reservation
    await this.redis.del(`reservation:${reservationId}`);

    this.logger.log(`Released reservation ${reservationId}: ${tokens} tokens`);
  }

  async syncBudgetToRedis(budget: Budget, period: BudgetPeriod): Promise<void> {
    const key = `budget:${budget.level}:${budget.targetId}`;
    await this.redis.set(`${key}:tokens`, String(period.totalTokensUsed));
    await this.redis.set(`${key}:cost`, String(period.totalCostUsd));
    await this.redis.set(`${key}:period`, period.id);
  }

  private async findBudgetWithPeriod(
    level: BudgetLevel,
    targetId: string,
    modelTierId: string | null,
  ): Promise<{ budget: Budget; period: BudgetPeriod | null } | null> {
    const where: any = { level, targetId, enabled: true };
    if (modelTierId) {
      where.modelTierId = modelTierId;
    } else {
      where.modelTierId = null as any;
    }
    const budget = await this.budgetRepo.findOne({ where });
    if (!budget) return null;

    const period = budget.currentPeriodId
      ? await this.periodRepo.findOne({ where: { id: budget.currentPeriodId } })
      : null;

    return { budget, period };
  }

  private async getReservation(reservationId: string): Promise<Record<string, string> | null> {
    const data = await this.redis.hgetall(`reservation:${reservationId}`);
    return Object.keys(data).length > 0 ? data : null;
  }

  // extractUserKey/TeamKey/OrgKey removed — reservation hash now stores
  // the actual Redis key paths (user_key, team_key, org_key) directly,
  // set by the Lua script during reserve(). See reconcile() and release().

  private async updatePeriodTotals(
    reservation: Record<string, string>,
    actualTokens: number,
    costUsd: number,
  ): Promise<void> {
    const periodIds = [
      reservation.user_period,
      reservation.team_period,
      reservation.org_period,
    ].filter((id) => id && id !== '');

    for (const periodId of periodIds) {
      await this.periodRepo
        .createQueryBuilder()
        .update(BudgetPeriod)
        .set({
          totalTokensUsed: () => `total_tokens_used + ${actualTokens}`,
          totalCostUsd: () => `total_cost_usd + ${costUsd}`,
        })
        .where('id = :id', { id: periodId })
        .execute();
    }
  }
}
