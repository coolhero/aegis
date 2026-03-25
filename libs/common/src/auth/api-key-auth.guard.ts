import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from './api-key.entity';
import { TenantContext } from './auth.types';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'] as string;

    if (!apiKeyHeader) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const keyHash = crypto
      .createHash('sha256')
      .update(apiKeyHeader)
      .digest('hex');

    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.revoked) {
      throw new UnauthorizedException('API key has been revoked');
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Update last_used_at (fire and forget)
    this.apiKeyRepository.update(apiKey.id, { lastUsedAt: new Date() });

    // Set tenant context on request
    const tenantContext: TenantContext = {
      orgId: apiKey.orgId,
      userId: apiKey.userId,
      role: null, // API key auth doesn't carry a role; use scopes instead
    };
    request.tenantContext = tenantContext;
    request.apiKey = apiKey;

    return true;
  }
}
