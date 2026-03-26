import { SecurityPolicyService } from '../security-policy.service';
import { BadRequestException } from '@nestjs/common';

describe('SecurityPolicyService', () => {
  let service: SecurityPolicyService;
  let mockRepo: any;
  let mockRedis: any;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ id: 'policy-1', ...data })),
      save: jest.fn((data) => Promise.resolve({ ...data, updatedAt: new Date() })),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    service = new SecurityPolicyService(mockRepo, mockRedis);
  });

  it('should return cached policy from Redis', async () => {
    const cached = {
      id: 'p-1',
      orgId: 'org-1',
      piiCategories: ['email'],
      piiAction: 'mask',
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getPolicy('org-1');
    expect(result).toEqual(cached);
    expect(mockRepo.findOne).not.toHaveBeenCalled();
  });

  it('should return DB policy on cache miss', async () => {
    const dbPolicy = {
      id: 'p-1',
      orgId: 'org-1',
      piiCategories: ['email'],
      piiAction: 'mask',
    };
    mockRepo.findOne.mockResolvedValue(dbPolicy);

    const result = await service.getPolicy('org-1');
    expect(result).toEqual(dbPolicy);
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it('should return default policy when none exists', async () => {
    const result = await service.getPolicy('org-new');
    expect(result.piiCategories).toEqual(['email', 'phone', 'ssn']);
    expect(result.piiAction).toBe('mask');
    expect(result.injectionDefenseEnabled).toBe(true);
  });

  it('should create new policy on update for new org', async () => {
    const result = await service.updatePolicy('org-1', {
      pii_categories: ['email', 'phone'],
      pii_action: 'reject',
    });

    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith('security-policy:org-1');
  });

  it('should update existing policy', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'p-1',
      orgId: 'org-1',
      piiCategories: ['email'],
      piiAction: 'mask',
      injectionDefenseEnabled: true,
      contentFilterCategories: [],
      bypassRoles: [],
      customPiiPatterns: [],
    });

    await service.updatePolicy('org-1', { pii_action: 'reject' });
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ piiAction: 'reject' }),
    );
  });

  it('should reject invalid regex in custom patterns', async () => {
    await expect(
      service.updatePolicy('org-1', {
        custom_pii_patterns: [
          { name: 'bad', pattern: '[invalid', placeholder: '[BAD]' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should invalidate Redis cache on update', async () => {
    await service.updatePolicy('org-1', { pii_action: 'warn' });
    expect(mockRedis.del).toHaveBeenCalledWith('security-policy:org-1');
  });
});
