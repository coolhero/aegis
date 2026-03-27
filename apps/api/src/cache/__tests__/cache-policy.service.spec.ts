import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CachePolicyService } from '../cache-policy.service';
import { CachePolicy } from '../cache-policy.entity';

describe('CachePolicyService', () => {
  let service: CachePolicyService;
  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CachePolicyService,
        { provide: getRepositoryToken(CachePolicy), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(CachePolicyService);
    jest.clearAllMocks();
  });

  describe('getPolicy', () => {
    it('should return default policy when none exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getPolicy('org-1');

      expect(result).toEqual({
        similarity_threshold: 0.95,
        ttl_seconds: 86400,
        enabled: true,
      });
    });

    it('should return stored policy', async () => {
      mockRepo.findOne.mockResolvedValue({
        orgId: 'org-1',
        similarityThreshold: 0.9,
        ttlSeconds: 3600,
        enabled: false,
      });

      const result = await service.getPolicy('org-1');

      expect(result.similarity_threshold).toBe(0.9);
      expect(result.ttl_seconds).toBe(3600);
      expect(result.enabled).toBe(false);
    });
  });

  describe('updatePolicy', () => {
    it('should create new policy if none exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const created = {
        orgId: 'org-1',
        similarityThreshold: 0.85,
        ttlSeconds: 7200,
        enabled: true,
      };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.updatePolicy('org-1', {
        similarity_threshold: 0.85,
        ttl_seconds: 7200,
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(result.similarityThreshold).toBe(0.85);
    });

    it('should update existing policy', async () => {
      const existing = {
        orgId: 'org-1',
        similarityThreshold: 0.95,
        ttlSeconds: 86400,
        enabled: true,
      };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updatePolicy('org-1', { enabled: false });

      expect(result.enabled).toBe(false);
      expect(result.similarityThreshold).toBe(0.95);
    });
  });
});
