import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Organization,
  Team,
  User,
  UserRole,
  JwtAuthGuard,
  RolesGuard,
  Roles,
} from '@aegis/common';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // --- Organizations ---

  @Get('organizations')
  async getOrganizations(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.orgRepository.find({ where: { id: orgId } });
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id') id: string, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    if (id !== orgId) {
      throw new ForbiddenException('Access denied to this organization');
    }
    return this.orgRepository.findOneOrFail({ where: { id } });
  }

  @Post('organizations')
  @Roles(UserRole.ADMIN)
  async createOrganization(@Body() body: { name: string; slug: string; plan?: string }) {
    const org = this.orgRepository.create({
      name: body.name,
      slug: body.slug,
      plan: body.plan || 'free',
    });
    return this.orgRepository.save(org);
  }

  // --- Teams ---

  @Get('teams')
  async getTeams(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.teamRepository.find({ where: { orgId } });
  }

  @Post('teams')
  @Roles(UserRole.ADMIN)
  async createTeam(@Body() body: { name: string; slug: string }, @Req() req: any) {
    const { orgId } = req.user.tenantContext;
    const team = this.teamRepository.create({
      name: body.name,
      slug: body.slug,
      orgId,
    });
    return this.teamRepository.save(team);
  }

  // --- Users ---

  @Get('users')
  async getUsers(@Req() req: any) {
    const { orgId } = req.user.tenantContext;
    return this.userRepository.find({
      where: { orgId },
      select: ['id', 'email', 'name', 'role', 'orgId', 'teamId', 'createdAt'],
    });
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  async createUser(
    @Body()
    body: {
      email: string;
      name: string;
      password: string;
      role?: UserRole;
      teamId?: string;
    },
    @Req() req: any,
  ) {
    const { orgId } = req.user.tenantContext;
    const user = this.userRepository.create({
      email: body.email,
      name: body.name,
      passwordHash: body.password, // @BeforeInsert will hash
      role: body.role || UserRole.MEMBER,
      orgId,
      teamId: body.teamId || null,
    });
    const saved = await this.userRepository.save(user);
    // Don't return passwordHash
    const { passwordHash, refreshTokenHash, ...result } = saved;
    return result;
  }
}
