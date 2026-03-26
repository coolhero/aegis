import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LogRetentionService } from './log-retention.service';
import { RequestLog } from './entities/request-log.entity';
import { Organization } from '@aegis/common/auth/organization.entity';

describe('LogRetentionService', () => {
  let service: LogRetentionService;
  let requestLogRepo: Record<string, jest.Mock | any>;
  let orgRepo: Record<string, jest.Mock>;

  const mockDeleteQb = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };

  const mockSelectQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    // Reset all mocks
    Object.values(mockSelectQb).forEach((fn) => (fn as jest.Mock).mockClear());
    Object.values(mockDeleteQb).forEach((fn) => (fn as jest.Mock).mockClear());

    // Re-set chainable returns
    mockSelectQb.select.mockReturnThis();
    mockSelectQb.where.mockReturnThis();
    mockSelectQb.andWhere.mockReturnThis();
    mockSelectQb.take.mockReturnThis();
    mockSelectQb.getMany.mockResolvedValue([]);

    mockDeleteQb.delete.mockReturnThis();
    mockDeleteQb.from.mockReturnThis();
    mockDeleteQb.whereInIds.mockReturnThis();
    mockDeleteQb.execute.mockResolvedValue({ affected: 0 });

    requestLogRepo = {
      createQueryBuilder: jest.fn((alias) => {
        if (alias === 'log') return mockSelectQb;
        return mockDeleteQb;
      }),
    };

    orgRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogRetentionService,
        { provide: getRepositoryToken(RequestLog), useValue: requestLogRepo },
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
      ],
    }).compile();

    service = module.get(LogRetentionService);
  });

  it('should do nothing when no organizations exist', async () => {
    orgRepo.find.mockResolvedValue([]);
    await service.cleanExpiredLogs();
    expect(requestLogRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('should use default 90-day retention when org has no custom setting', async () => {
    orgRepo.find.mockResolvedValue([
      { id: 'org-1', settings: {} },
    ]);

    await service.cleanExpiredLogs();

    expect(mockSelectQb.where).toHaveBeenCalledWith('log.org_id = :orgId', { orgId: 'org-1' });
    expect(mockSelectQb.andWhere).toHaveBeenCalledWith(
      'log.created_at < :cutoffDate',
      expect.objectContaining({ cutoffDate: expect.any(Date) }),
    );
  });

  it('should use custom retention days from org settings', async () => {
    orgRepo.find.mockResolvedValue([
      { id: 'org-1', settings: { logRetentionDays: 180 } },
    ]);

    const beforeCall = new Date();
    await service.cleanExpiredLogs();

    // Verify cutoff date is roughly 180 days ago (within 1 day tolerance)
    const callArgs = mockSelectQb.andWhere.mock.calls[0];
    const cutoffDate = callArgs[1].cutoffDate as Date;
    const daysAgo =
      (beforeCall.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysAgo).toBeGreaterThanOrEqual(179);
    expect(daysAgo).toBeLessThanOrEqual(181);
  });

  it('should delete logs in batches when expired logs exist', async () => {
    orgRepo.find.mockResolvedValue([
      { id: 'org-1', settings: {} },
    ]);

    // First batch returns 2 logs, second batch returns 0
    mockSelectQb.getMany
      .mockResolvedValueOnce([{ id: 'log-1' }, { id: 'log-2' }])
      .mockResolvedValueOnce([]);

    await service.cleanExpiredLogs();

    expect(mockDeleteQb.whereInIds).toHaveBeenCalledWith(['log-1', 'log-2']);
    expect(mockDeleteQb.execute).toHaveBeenCalledTimes(1);
  });
});
