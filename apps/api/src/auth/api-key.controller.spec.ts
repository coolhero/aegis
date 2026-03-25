import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard, RolesGuard } from '@aegis/common';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let apiKeyService: jest.Mocked<ApiKeyService>;

  const mockOrgId = 'org-uuid-1';
  const mockUserId = 'user-uuid-1';

  const mockAdminReq = {
    user: {
      tenantContext: { orgId: mockOrgId, userId: mockUserId, role: 'admin' },
    },
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      list: jest.fn(),
      revoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [{ provide: ApiKeyService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
    apiKeyService = module.get(ApiKeyService);
  });

  describe('POST /api-keys', () => {
    it('should create API key and return raw key once', async () => {
      const mockResult = {
        id: 'key-uuid-1',
        key: 'aegis_abc123def456...',
        name: 'Production Key',
        keyPrefix: 'aegis_abc123',
        scopes: ['gpt-4o'],
        expiresAt: null,
        createdAt: new Date(),
      };
      apiKeyService.create.mockResolvedValue(mockResult);

      const result = await controller.create(
        { name: 'Production Key', scopes: ['gpt-4o'] },
        mockAdminReq,
      );

      expect(result.key).toBeDefined();
      expect(result.key).toContain('aegis_');
      expect(result.name).toBe('Production Key');
      expect(apiKeyService.create).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        { name: 'Production Key', scopes: ['gpt-4o'] },
      );
    });
  });

  describe('GET /api-keys', () => {
    it('should list API keys with prefix only (no raw key)', async () => {
      const mockList = [
        {
          id: 'key-uuid-1',
          name: 'Production Key',
          keyPrefix: 'aegis_abc123',
          scopes: ['gpt-4o'],
          lastUsedAt: new Date(),
          expiresAt: null,
          revoked: false,
          createdAt: new Date(),
        },
      ];
      apiKeyService.list.mockResolvedValue(mockList as any);

      const result = await controller.list(mockAdminReq);

      expect(result).toHaveLength(1);
      expect(result[0].keyPrefix).toBeDefined();
      expect(result[0]).not.toHaveProperty('key');
      expect(result[0]).not.toHaveProperty('keyHash');
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('should revoke API key', async () => {
      apiKeyService.revoke.mockResolvedValue({
        id: 'key-uuid-1',
        revoked: true,
        message: 'API key has been revoked',
      });

      const result = await controller.revoke('key-uuid-1', mockAdminReq);

      expect(result.revoked).toBe(true);
    });

    it('should throw 404 for non-existent key', async () => {
      apiKeyService.revoke.mockResolvedValue(null);

      await expect(
        controller.revoke('non-existent', mockAdminReq),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
