import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { SecurityPolicy } from './entities/security-policy.entity';
import { UpdateSecurityPolicyDto } from './dto/update-security-policy.dto';

const CACHE_PREFIX = 'security-policy:';
const CACHE_TTL = 300; // 5 minutes

const DEFAULT_POLICY: Partial<SecurityPolicy> = {
  piiCategories: ['email', 'phone', 'ssn'],
  piiAction: 'mask',
  injectionDefenseEnabled: true,
  contentFilterCategories: ['hate_speech', 'violence', 'self_harm', 'illegal'],
  bypassRoles: [],
  customPiiPatterns: [],
};

@Injectable()
export class SecurityPolicyService {
  private readonly logger = new Logger(SecurityPolicyService.name);

  constructor(
    @InjectRepository(SecurityPolicy)
    private readonly policyRepo: Repository<SecurityPolicy>,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async getPolicy(orgId: string): Promise<SecurityPolicy> {
    // 1. Check Redis cache
    const cached = await this.redis.get(`${CACHE_PREFIX}${orgId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Check DB
    const policy = await this.policyRepo.findOne({ where: { orgId } });
    if (policy) {
      await this.cachePolicy(orgId, policy);
      return policy;
    }

    // 3. Return default policy (not persisted)
    return {
      ...DEFAULT_POLICY,
      orgId,
    } as SecurityPolicy;
  }

  async updatePolicy(
    orgId: string,
    dto: UpdateSecurityPolicyDto,
  ): Promise<SecurityPolicy> {
    // Validate custom PII patterns (regex compilation test)
    if (dto.custom_pii_patterns) {
      for (const pattern of dto.custom_pii_patterns) {
        try {
          new RegExp(pattern.pattern);
        } catch {
          throw new BadRequestException(
            `Invalid regex pattern for '${pattern.name}': ${pattern.pattern}`,
          );
        }
      }
    }

    let policy = await this.policyRepo.findOne({ where: { orgId } });

    if (policy) {
      // Update existing
      if (dto.pii_categories !== undefined) policy.piiCategories = dto.pii_categories;
      if (dto.pii_action !== undefined) policy.piiAction = dto.pii_action;
      if (dto.injection_defense_enabled !== undefined)
        policy.injectionDefenseEnabled = dto.injection_defense_enabled;
      if (dto.content_filter_categories !== undefined)
        policy.contentFilterCategories = dto.content_filter_categories;
      if (dto.bypass_roles !== undefined) policy.bypassRoles = dto.bypass_roles;
      if (dto.custom_pii_patterns !== undefined)
        policy.customPiiPatterns = dto.custom_pii_patterns;
    } else {
      // Create new
      policy = this.policyRepo.create({
        orgId,
        piiCategories: dto.pii_categories ?? DEFAULT_POLICY.piiCategories,
        piiAction: dto.pii_action ?? DEFAULT_POLICY.piiAction,
        injectionDefenseEnabled:
          dto.injection_defense_enabled ?? DEFAULT_POLICY.injectionDefenseEnabled,
        contentFilterCategories:
          dto.content_filter_categories ?? DEFAULT_POLICY.contentFilterCategories,
        bypassRoles: dto.bypass_roles ?? DEFAULT_POLICY.bypassRoles,
        customPiiPatterns: dto.custom_pii_patterns ?? DEFAULT_POLICY.customPiiPatterns,
      });
    }

    const saved = await this.policyRepo.save(policy);

    // Invalidate cache
    await this.redis.del(`${CACHE_PREFIX}${orgId}`);

    return saved;
  }

  private async cachePolicy(orgId: string, policy: SecurityPolicy): Promise<void> {
    try {
      await this.redis.set(
        `${CACHE_PREFIX}${orgId}`,
        JSON.stringify(policy),
        'EX',
        CACHE_TTL,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cache policy for org ${orgId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
