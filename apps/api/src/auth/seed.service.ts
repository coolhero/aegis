import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Organization, Team, User, ApiKey, UserRole } from '@aegis/common';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async onModuleInit() {
    const orgCount = await this.orgRepository.count();
    if (orgCount > 0) {
      this.logger.log('Seed data already exists, skipping...');
      return;
    }

    this.logger.log('Seeding demo data...');
    await this.seed();
  }

  private async seed() {
    // 1. Create Organization
    const org = this.orgRepository.create({
      name: 'Demo Organization',
      slug: 'demo-org',
      plan: 'pro',
    });
    const savedOrg = await this.orgRepository.save(org);

    // 2. Create Teams
    const backendTeam = this.teamRepository.create({
      name: 'Backend Team',
      slug: 'backend',
      orgId: savedOrg.id,
    });
    const frontendTeam = this.teamRepository.create({
      name: 'Frontend Team',
      slug: 'frontend',
      orgId: savedOrg.id,
    });
    const [savedBackend, savedFrontend] = await this.teamRepository.save([
      backendTeam,
      frontendTeam,
    ]);

    // 3. Create Users (password: password123)
    const passwordHash = await bcrypt.hash('password123', 10);

    const admin = this.userRepository.create({
      email: 'admin@demo.com',
      name: 'Admin User',
      passwordHash,
      role: UserRole.ADMIN,
      orgId: savedOrg.id,
      teamId: savedBackend.id,
    });
    const member = this.userRepository.create({
      email: 'dev@demo.com',
      name: 'Developer',
      passwordHash,
      role: UserRole.MEMBER,
      orgId: savedOrg.id,
      teamId: savedBackend.id,
    });
    const viewer = this.userRepository.create({
      email: 'viewer@demo.com',
      name: 'Viewer',
      passwordHash,
      role: UserRole.VIEWER,
      orgId: savedOrg.id,
      teamId: savedFrontend.id,
    });
    await this.userRepository.save([admin, member, viewer]);

    // 4. Create API Key
    const rawKey = 'aegis_' + crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = this.apiKeyRepository.create({
      orgId: savedOrg.id,
      userId: admin.id,
      keyHash,
      keyPrefix: rawKey.substring(0, 12),
      name: 'Demo API Key',
      scopes: [],
    });
    await this.apiKeyRepository.save(apiKey);

    this.logger.log('=== Demo Seed Data Created ===');
    this.logger.log(`Organization: ${savedOrg.name} (${savedOrg.slug})`);
    this.logger.log(`Admin: admin@demo.com / password123`);
    this.logger.log(`Member: dev@demo.com / password123`);
    this.logger.log(`Viewer: viewer@demo.com / password123`);
    this.logger.log(`API Key: ${rawKey}`);
    this.logger.log('==============================');
  }
}
