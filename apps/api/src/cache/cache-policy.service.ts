import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CachePolicy } from './cache-policy.entity';

const DEFAULT_POLICY = {
  similarityThreshold: 0.95,
  ttlSeconds: 86400,
  enabled: true,
};

@Injectable()
export class CachePolicyService {
  constructor(
    @InjectRepository(CachePolicy)
    private readonly policyRepo: Repository<CachePolicy>,
  ) {}

  async getPolicy(orgId: string): Promise<{
    similarity_threshold: number;
    ttl_seconds: number;
    enabled: boolean;
  }> {
    const policy = await this.policyRepo.findOne({ where: { orgId } });
    if (!policy) {
      return {
        similarity_threshold: DEFAULT_POLICY.similarityThreshold,
        ttl_seconds: DEFAULT_POLICY.ttlSeconds,
        enabled: DEFAULT_POLICY.enabled,
      };
    }
    return {
      similarity_threshold: Number(policy.similarityThreshold),
      ttl_seconds: policy.ttlSeconds,
      enabled: policy.enabled,
    };
  }

  async updatePolicy(
    orgId: string,
    dto: { similarity_threshold?: number; ttl_seconds?: number; enabled?: boolean },
  ): Promise<CachePolicy> {
    let policy = await this.policyRepo.findOne({ where: { orgId } });

    if (!policy) {
      policy = this.policyRepo.create({
        orgId,
        similarityThreshold: dto.similarity_threshold ?? DEFAULT_POLICY.similarityThreshold,
        ttlSeconds: dto.ttl_seconds ?? DEFAULT_POLICY.ttlSeconds,
        enabled: dto.enabled ?? DEFAULT_POLICY.enabled,
      });
    } else {
      if (dto.similarity_threshold !== undefined) {
        policy.similarityThreshold = dto.similarity_threshold;
      }
      if (dto.ttl_seconds !== undefined) {
        policy.ttlSeconds = dto.ttl_seconds;
      }
      if (dto.enabled !== undefined) {
        policy.enabled = dto.enabled;
      }
    }

    return this.policyRepo.save(policy);
  }
}
