import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoggingService } from './logging.service';
import { RequestLog } from './entities/request-log.entity';

describe('LoggingService', () => {
  let service: LoggingService;
  let repo: Record<string, jest.Mock | any>;

  const orgId = 'org-001';

  const mockQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(50),
    getMany: jest.fn().mockResolvedValue([
      { id: 'log-1', model: 'gpt-4o', status: 'success' },
      { id: 'log-2', model: 'claude-sonnet-4', status: 'success' },
    ]),
    getRawMany: jest.fn().mockResolvedValue([
      { group: 'gpt-4o', period: '2026-03-01', request_count: 10, total_tokens: 5000 },
    ]),
  };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn().mockResolvedValue(null),
    };

    // Reset mocks
    Object.values(mockQb).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        (fn as jest.Mock).mockClear();
      }
    });
    // Re-set returnThis for chaining
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.select.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.groupBy.mockReturnThis();
    mockQb.addGroupBy.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingService,
        { provide: getRepositoryToken(RequestLog), useValue: repo },
      ],
    }).compile();

    service = module.get(LoggingService);
  });

  describe('findAll', () => {
    it('should return paginated logs with tenant filter', async () => {
      const result = await service.findAll(orgId, { page: 1, limit: 20 });

      expect(result.meta.total).toBe(50);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(mockQb.where).toHaveBeenCalledWith('log.org_id = :orgId', { orgId });
    });

    it('should apply model filter', async () => {
      await service.findAll(orgId, { model: 'gpt-4o' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.model = :model', { model: 'gpt-4o' });
    });

    it('should apply status filter', async () => {
      await service.findAll(orgId, { status: 'error' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.status = :status', { status: 'error' });
    });

    it('should apply date range filters', async () => {
      await service.findAll(orgId, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.created_at >= :startDate', { startDate: '2026-03-01' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('log.created_at <= :endDate', { endDate: '2026-03-31' });
    });
  });

  describe('findById', () => {
    it('should find log by id with tenant filter', async () => {
      const mockLog = { id: 'log-1', orgId, model: 'gpt-4o' };
      repo.findOne.mockResolvedValue(mockLog);

      const result = await service.findById(orgId, 'log-1');

      expect(result).toEqual(mockLog);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'log-1', orgId },
      });
    });

    it('should return null for non-existent or other org log', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findById(orgId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUsageAnalytics', () => {
    it('should return grouped usage analytics', async () => {
      const result = await service.getUsageAnalytics(orgId, {
        groupBy: 'model',
        period: 'daily',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.groupBy).toBe('model');
      expect(result.meta.period).toBe('daily');
      expect(mockQb.where).toHaveBeenCalledWith('log.org_id = :orgId', { orgId });
    });
  });

  describe('getCostAnalytics', () => {
    it('should return grouped cost analytics', async () => {
      const result = await service.getCostAnalytics(orgId, {
        groupBy: 'team',
        period: 'monthly',
      });

      expect(result.meta.groupBy).toBe('team');
      expect(result.meta.period).toBe('monthly');
    });
  });
});
