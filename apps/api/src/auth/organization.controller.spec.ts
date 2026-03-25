import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrganizationController } from './organization.controller';
import { Organization, Team, User, UserRole } from '@aegis/common';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let orgRepository: any;
  let teamRepository: any;
  let userRepository: any;

  const mockOrgId = 'org-uuid-1';

  const mockAdminReq = {
    user: {
      tenantContext: { orgId: mockOrgId, userId: 'user-uuid-1', role: UserRole.ADMIN },
    },
  };

  beforeEach(async () => {
    orgRepository = {
      find: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'new-org-id', ...data })),
    };
    teamRepository = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'new-team-id', ...data })),
    };
    userRepository = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'new-user-id', ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        { provide: getRepositoryToken(Organization), useValue: orgRepository },
        { provide: getRepositoryToken(Team), useValue: teamRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
  });

  describe('GET /organizations', () => {
    it('should return organizations scoped to tenant', async () => {
      const orgs = [{ id: mockOrgId, name: 'Demo Org' }];
      orgRepository.find.mockResolvedValue(orgs);

      const result = await controller.getOrganizations(mockAdminReq);

      expect(orgRepository.find).toHaveBeenCalledWith({ where: { id: mockOrgId } });
      expect(result).toEqual(orgs);
    });
  });

  describe('GET /organizations/:id', () => {
    it('should return organization if same tenant', async () => {
      const org = { id: mockOrgId, name: 'Demo Org' };
      orgRepository.findOneOrFail.mockResolvedValue(org);

      const result = await controller.getOrganization(mockOrgId, mockAdminReq);

      expect(result).toEqual(org);
    });

    it('should throw 403 for cross-tenant access', async () => {
      await expect(
        controller.getOrganization('other-org-id', mockAdminReq),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /teams', () => {
    it('should return teams scoped to tenant', async () => {
      const teams = [{ id: 'team-1', name: 'Backend', orgId: mockOrgId }];
      teamRepository.find.mockResolvedValue(teams);

      const result = await controller.getTeams(mockAdminReq);

      expect(teamRepository.find).toHaveBeenCalledWith({ where: { orgId: mockOrgId } });
      expect(result).toEqual(teams);
    });
  });

  describe('POST /teams', () => {
    it('admin should create team within own org', async () => {
      const result = await controller.createTeam(
        { name: 'ML Team', slug: 'ml-team' },
        mockAdminReq,
      );

      expect(teamRepository.create).toHaveBeenCalledWith({
        name: 'ML Team',
        slug: 'ml-team',
        orgId: mockOrgId,
      });
      expect(result.name).toBe('ML Team');
    });
  });

  describe('GET /users', () => {
    it('should return users scoped to tenant without sensitive fields', async () => {
      const users = [
        { id: 'user-1', email: 'admin@demo.com', name: 'Admin', role: 'admin', orgId: mockOrgId },
      ];
      userRepository.find.mockResolvedValue(users);

      const result = await controller.getUsers(mockAdminReq);

      expect(userRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: mockOrgId } }),
      );
      expect(result).toEqual(users);
    });
  });

  describe('POST /users', () => {
    it('admin should create user within own org', async () => {
      const result = await controller.createUser(
        { email: 'new@demo.com', name: 'New User', password: 'pw123' },
        mockAdminReq,
      );

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@demo.com',
          orgId: mockOrgId,
          role: UserRole.MEMBER,
        }),
      );
    });
  });
});
