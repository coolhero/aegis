import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModelTierService } from './model-tier.service';
import { ModelTier, ModelTierMember } from './entities/model-tier.entity';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';

describe('ModelTierService', () => {
  let service: ModelTierService;
  let tierRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock | any>;
  let redis: Record<string, jest.Mock>;

  const orgId = 'org-001';
  const tierId = 'tier-001';

  const makeTier = (overrides: Partial<ModelTier> = {}): ModelTier =>
    ({
      id: tierId,
      orgId,
      name: 'premium',
      description: 'Premium models',
      members: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as ModelTier;

  const makeMember = (
    overrides: Partial<ModelTierMember> = {},
  ): ModelTierMember =>
    ({
      id: 'member-001',
      tierId,
      modelId: 'model-001',
      ...overrides,
    }) as ModelTierMember;

  beforeEach(async () => {
    tierRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: tierId, ...entity })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const mockQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
    };

    memberRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      _mockQb: mockQb,
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelTierService,
        { provide: getRepositoryToken(ModelTier), useValue: tierRepo },
        { provide: getRepositoryToken(ModelTierMember), useValue: memberRepo },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(ModelTierService);
  });

  // ─── create ────────────────────────────────────────────

  describe('create', () => {
    it('should create a new tier successfully', async () => {
      tierRepo.findOne
        .mockResolvedValueOnce(null) // duplicate check → no conflict
        .mockResolvedValueOnce(makeTier()); // findById after save

      const result = await service.create(orgId, {
        name: 'premium',
        description: 'Premium models',
      });

      expect(tierRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('premium');
    });

    it('should throw ConflictException if tier name already exists', async () => {
      tierRepo.findOne.mockResolvedValue(makeTier());

      await expect(
        service.create(orgId, { name: 'premium' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should add models when model_ids provided', async () => {
      tierRepo.findOne
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce(makeTier()); // findById

      await service.create(orgId, {
        name: 'premium',
        model_ids: ['model-a', 'model-b'],
      });

      // 2 models → 2 saves
      expect(memberRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  // ─── findAll ───────────────────────────────────────────

  describe('findAll', () => {
    it('should return all tiers for org', async () => {
      const tiers = [makeTier(), makeTier({ id: 'tier-002', name: 'economy' })];
      tierRepo.find.mockResolvedValue(tiers);

      const result = await service.findAll(orgId);

      expect(result).toHaveLength(2);
      expect(tierRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId },
          relations: ['members'],
        }),
      );
    });
  });

  // ─── findById ──────────────────────────────────────────

  describe('findById', () => {
    it('should return tier with members', async () => {
      tierRepo.findOne.mockResolvedValue(makeTier({ members: [makeMember()] }));

      const result = await service.findById(tierId);

      expect(result.id).toBe(tierId);
      expect(result.members).toHaveLength(1);
    });

    it('should throw NotFoundException when tier not found', async () => {
      tierRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────

  describe('update', () => {
    it('should update tier name and description', async () => {
      const tier = makeTier();
      tierRepo.findOne.mockResolvedValue(tier);

      await service.update(tierId, {
        name: 'enterprise',
        description: 'Enterprise tier',
      });

      expect(tierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'enterprise',
          description: 'Enterprise tier',
        }),
      );
    });

    it('should add and remove models in a single update', async () => {
      tierRepo.findOne.mockResolvedValue(makeTier());

      await service.update(tierId, {
        add_model_ids: ['new-model'],
        remove_model_ids: ['old-model'],
      });

      expect(memberRepo.save).toHaveBeenCalled();
      expect(memberRepo.delete).toHaveBeenCalledWith({
        tierId,
        modelId: 'old-model',
      });
    });

    it('should throw ConflictException when adding model already in another tier', async () => {
      tierRepo.findOne.mockResolvedValue(makeTier());
      memberRepo.findOne.mockResolvedValue(
        makeMember({ tierId: 'other-tier', modelId: 'model-x' }),
      );

      await expect(
        service.update(tierId, { add_model_ids: ['model-x'] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── delete ────────────────────────────────────────────

  describe('delete', () => {
    it('should delete tier and invalidate Redis cache for all members', async () => {
      const members = [
        makeMember({ modelId: 'model-a' }),
        makeMember({ modelId: 'model-b' }),
      ];
      tierRepo.findOne.mockResolvedValue(makeTier({ members }));

      await service.delete(tierId);

      expect(redis.del).toHaveBeenCalledWith('model_tier:model-a');
      expect(redis.del).toHaveBeenCalledWith('model_tier:model-b');
      expect(tierRepo.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException when deleting non-existent tier', async () => {
      tierRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── resolveTierForModel ───────────────────────────────

  describe('resolveTierForModel', () => {
    it('should return cached tier ID on Redis hit', async () => {
      redis.get.mockResolvedValue('tier-cached');

      const result = await service.resolveTierForModel('gpt-4o');

      expect(result).toBe('tier-cached');
      expect(memberRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should return null when cached as "none"', async () => {
      redis.get.mockResolvedValue('none');

      const result = await service.resolveTierForModel('gpt-3.5-turbo');

      expect(result).toBeNull();
    });

    it('should query DB and cache result on Redis miss', async () => {
      redis.get.mockResolvedValue(null);
      memberRepo._mockQb.getRawOne.mockResolvedValue({ tierId: 'tier-from-db' });

      const result = await service.resolveTierForModel('claude-opus-4');

      expect(result).toBe('tier-from-db');
      expect(redis.set).toHaveBeenCalledWith(
        'model_tier:claude-opus-4',
        'tier-from-db',
        'EX',
        3600,
      );
    });

    it('should cache "none" when model has no tier', async () => {
      redis.get.mockResolvedValue(null);
      memberRepo._mockQb.getRawOne.mockResolvedValue(null);

      const result = await service.resolveTierForModel('unknown-model');

      expect(result).toBeNull();
      expect(redis.set).toHaveBeenCalledWith(
        'model_tier:unknown-model',
        'none',
        'EX',
        3600,
      );
    });
  });
});
