import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RequestLog } from './entities/request-log.entity';
import { LogQueryDto } from './dto/log-query.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);

  constructor(
    @InjectRepository(RequestLog)
    private readonly requestLogRepo: Repository<RequestLog>,
  ) {}

  async findAll(
    orgId: string,
    query: LogQueryDto,
  ): Promise<PaginatedResult<Partial<RequestLog>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.requestLogRepo
      .createQueryBuilder('log')
      .where('log.org_id = :orgId', { orgId })
      .orderBy('log.created_at', 'DESC');

    this.applyFilters(qb, query);

    const total = await qb.getCount();
    const data = await qb
      .select([
        'log.id',
        'log.requestId',
        'log.traceId',
        'log.model',
        'log.provider',
        'log.inputTokens',
        'log.outputTokens',
        'log.costUsd',
        'log.latencyMs',
        'log.status',
        'log.cacheHit',
        'log.createdAt',
      ])
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(orgId: string, id: string): Promise<RequestLog | null> {
    return this.requestLogRepo.findOne({
      where: { id, orgId },
    });
  }

  async getUsageAnalytics(orgId: string, query: AnalyticsQueryDto) {
    const groupCol = this.resolveGroupColumn(query.groupBy);
    const dateTrunc = this.resolveDateTrunc(query.period);

    const qb = this.requestLogRepo
      .createQueryBuilder('log')
      .select(groupCol, 'group')
      .addSelect(`${dateTrunc}`, 'period')
      .addSelect('COUNT(*)::int', 'request_count')
      .addSelect('SUM(log.input_tokens)::int', 'total_input_tokens')
      .addSelect('SUM(log.output_tokens)::int', 'total_output_tokens')
      .addSelect('SUM(log.input_tokens + log.output_tokens)::int', 'total_tokens')
      .where('log.org_id = :orgId', { orgId })
      .groupBy(groupCol)
      .addGroupBy(dateTrunc)
      .orderBy(dateTrunc, 'ASC');

    this.applyDateRange(qb, query);

    const data = await qb.getRawMany();
    return {
      data,
      meta: {
        groupBy: query.groupBy,
        period: query.period,
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      },
    };
  }

  async getCostAnalytics(orgId: string, query: AnalyticsQueryDto) {
    const groupCol = this.resolveGroupColumn(query.groupBy);
    const dateTrunc = this.resolveDateTrunc(query.period);

    const qb = this.requestLogRepo
      .createQueryBuilder('log')
      .select(groupCol, 'group')
      .addSelect(`${dateTrunc}`, 'period')
      .addSelect('SUM(log.cost_usd)::numeric(12,6)', 'total_cost_usd')
      .addSelect('COUNT(*)::int', 'request_count')
      .where('log.org_id = :orgId', { orgId })
      .groupBy(groupCol)
      .addGroupBy(dateTrunc)
      .orderBy(dateTrunc, 'ASC');

    this.applyDateRange(qb, query);

    const data = await qb.getRawMany();
    return {
      data,
      meta: {
        groupBy: query.groupBy,
        period: query.period,
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      },
    };
  }

  private applyFilters(qb: SelectQueryBuilder<RequestLog>, query: LogQueryDto): void {
    if (query.model) qb.andWhere('log.model = :model', { model: query.model });
    if (query.provider) qb.andWhere('log.provider = :provider', { provider: query.provider });
    if (query.userId) qb.andWhere('log.user_id = :userId', { userId: query.userId });
    if (query.teamId) qb.andWhere('log.team_id = :teamId', { teamId: query.teamId });
    if (query.status) qb.andWhere('log.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('log.created_at >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('log.created_at <= :endDate', { endDate: query.endDate });
    if (query.minCost != null) qb.andWhere('log.cost_usd >= :minCost', { minCost: query.minCost });
    if (query.maxCost != null) qb.andWhere('log.cost_usd <= :maxCost', { maxCost: query.maxCost });
  }

  private applyDateRange(qb: SelectQueryBuilder<RequestLog>, query: AnalyticsQueryDto): void {
    if (query.startDate) qb.andWhere('log.created_at >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('log.created_at <= :endDate', { endDate: query.endDate });
  }

  private resolveGroupColumn(groupBy: string): string {
    switch (groupBy) {
      case 'model': return 'log.model';
      case 'team': return 'log.team_id';
      case 'user': return 'log.user_id';
      default: return 'log.model';
    }
  }

  private resolveDateTrunc(period: string): string {
    switch (period) {
      case 'daily': return "DATE_TRUNC('day', log.created_at)";
      case 'weekly': return "DATE_TRUNC('week', log.created_at)";
      case 'monthly': return "DATE_TRUNC('month', log.created_at)";
      default: return "DATE_TRUNC('day', log.created_at)";
    }
  }
}
