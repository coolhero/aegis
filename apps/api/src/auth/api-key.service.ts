import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from '@aegis/common';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async create(
    orgId: string,
    userId: string,
    data: { name: string; scopes?: string[]; expiresAt?: string },
  ) {
    // Generate raw key: aegis_ + 32 bytes hex
    const rawKey = 'aegis_' + crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      orgId,
      userId,
      keyHash,
      keyPrefix,
      name: data.name,
      scopes: data.scopes || [],
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    // Return raw key only on creation
    return {
      id: saved.id,
      key: rawKey,
      name: saved.name,
      keyPrefix: saved.keyPrefix,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  async list(orgId: string) {
    return this.apiKeyRepository.find({
      where: { orgId },
      select: [
        'id',
        'name',
        'keyPrefix',
        'scopes',
        'lastUsedAt',
        'expiresAt',
        'revoked',
        'createdAt',
      ],
    });
  }

  async revoke(id: string, orgId: string) {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, orgId },
    });
    if (!apiKey) {
      return null;
    }
    apiKey.revoked = true;
    await this.apiKeyRepository.save(apiKey);
    return { id: apiKey.id, revoked: true, message: 'API key has been revoked' };
  }

  /**
   * Check if the API key's scopes allow the requested model.
   * Empty scopes = all models allowed.
   */
  checkModelScope(apiKey: ApiKey, model: string): void {
    // Empty scopes or wildcard "*" = access to all models
    if (apiKey.scopes.length === 0 || apiKey.scopes.includes('*')) {
      return;
    }
    if (!apiKey.scopes.includes(model)) {
      throw new ForbiddenException(
        `API key does not have access to model: ${model}`,
      );
    }
  }
}
