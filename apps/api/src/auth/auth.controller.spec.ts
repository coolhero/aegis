import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '@aegis/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@demo.com',
    name: 'Admin User',
    role: UserRole.ADMIN,
    orgId: 'org-uuid-1',
    teamId: 'team-uuid-1' as string | null,
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: mockUser,
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      refresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('POST /auth/login', () => {
    it('should return tokens and user on valid credentials', async () => {
      authService.login.mockResolvedValue(mockTokens);

      const result = await controller.login({
        email: 'admin@demo.com',
        password: 'password123',
      });

      expect(result).toEqual(mockTokens);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('admin@demo.com');
      expect(result.user.role).toBe('admin');
      expect(result.user.orgId).toBe('org-uuid-1');
    });

    it('should throw 401 on invalid credentials', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login({ email: 'admin@demo.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 on non-existent user', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login({
          email: 'nonexistent@demo.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new token pair on valid refresh token', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      authService.refresh.mockResolvedValue(newTokens);

      const result = await controller.refresh({
        refreshToken: 'valid-refresh-token',
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw 401 on invalid refresh token', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(
        controller.refresh({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 on reused refresh token (rotation violation)', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(
        controller.refresh({ refreshToken: 'already-used-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile from JWT payload', () => {
      const mockReq = {
        user: {
          id: 'user-uuid-1',
          email: 'admin@demo.com',
          role: 'admin',
          orgId: 'org-uuid-1',
          teamId: 'team-uuid-1',
          tenantContext: {
            orgId: 'org-uuid-1',
            userId: 'user-uuid-1',
            role: 'admin',
          },
        },
      };

      const result = controller.getProfile(mockReq);

      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('admin@demo.com');
      expect(result.role).toBe('admin');
      expect(result).not.toHaveProperty('tenantContext');
    });
  });
});
