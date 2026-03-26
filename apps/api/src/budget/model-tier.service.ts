import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '@aegis/common/redis/redis.constants';
import { ModelTier, ModelTierMember } from './entities/model-tier.entity';

export interface CreateModelTierDto {
  name: string;
  description?: string;
  model_ids?: string[];
}

export interface UpdateModelTierDto {
  name?: string;
  description?: string;
  add_model_ids?: string[];
  remove_model_ids?: string[];
}

@Injectable()
export class ModelTierService {
  private readonly logger = new Logger(ModelTierService.name);

  constructor(
    @InjectRepository(ModelTier)
    private readonly tierRepo: Repository<ModelTier>,
    @InjectRepository(ModelTierMember)
    private readonly memberRepo: Repository<ModelTierMember>,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  async create(orgId: string, dto: CreateModelTierDto): Promise<ModelTier> {
    const existing = await this.tierRepo.findOne({
      where: { orgId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Model tier "${dto.name}" already exists for this organization`,
      );
    }

    const tier = await this.tierRepo.save(
      this.tierRepo.create({
        orgId,
        name: dto.name,
        description: dto.description ?? null,
      }),
    );

    if (dto.model_ids?.length) {
      await this.addModels(tier.id, dto.model_ids);
    }

    return this.findById(tier.id);
  }

  async findAll(orgId: string): Promise<ModelTier[]> {
    return this.tierRepo.find({
      where: { orgId },
      relations: ['members'],
      order: { name: 'ASC' },
    });
  }

  async findById(tierId: string): Promise<ModelTier> {
    const tier = await this.tierRepo.findOne({
      where: { id: tierId },
      relations: ['members'],
    });
    if (!tier) {
      throw new NotFoundException(`Model tier not found: ${tierId}`);
    }
    return tier;
  }

  async update(tierId: string, dto: UpdateModelTierDto): Promise<ModelTier> {
    const tier = await this.findById(tierId);

    if (dto.name) tier.name = dto.name;
    if (dto.description !== undefined) tier.description = dto.description;
    await this.tierRepo.save(tier);

    if (dto.add_model_ids?.length) {
      await this.addModels(tierId, dto.add_model_ids);
    }
    if (dto.remove_model_ids?.length) {
      await this.removeModels(tierId, dto.remove_model_ids);
    }

    return this.findById(tierId);
  }

  async delete(tierId: string): Promise<void> {
    const tier = await this.findById(tierId);
    // Invalidate Redis cache for all member models
    for (const member of tier.members) {
      await this.redis.del(`model_tier:${member.modelId}`);
    }
    await this.tierRepo.remove(tier);
    this.logger.log(`Deleted model tier: ${tier.name}`);
  }

  async resolveTierForModel(modelNameOrId: string): Promise<string | null> {
    // Check Redis cache first (keyed by model name)
    const cacheKey = `model_tier:${modelNameOrId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached === 'none' ? null : cached;

    // DB lookup: join through models table to match by name or id
    const result = await this.memberRepo
      .createQueryBuilder('mtm')
      .innerJoin('models', 'm', 'm.id = mtm.model_id')
      .where('m.name = :name OR m.id::text = :name', { name: modelNameOrId })
      .select('mtm.tier_id', 'tierId')
      .getRawOne();

    const tierId = result?.tierId ?? null;

    // Cache for 1 hour
    await this.redis.set(cacheKey, tierId ?? 'none', 'EX', 3600);

    return tierId;
  }

  private async addModels(tierId: string, modelIds: string[]): Promise<void> {
    for (const modelId of modelIds) {
      // Check if model is already in another tier
      const existing = await this.memberRepo.findOne({ where: { modelId } });
      if (existing && existing.tierId !== tierId) {
        throw new ConflictException(
          `Model ${modelId} is already assigned to another tier`,
        );
      }
      if (!existing) {
        await this.memberRepo.save(
          this.memberRepo.create({ tierId, modelId }),
        );
        // Invalidate cache
        await this.redis.del(`model_tier:${modelId}`);
      }
    }
  }

  private async removeModels(
    tierId: string,
    modelIds: string[],
  ): Promise<void> {
    for (const modelId of modelIds) {
      await this.memberRepo.delete({ tierId, modelId });
      await this.redis.del(`model_tier:${modelId}`);
    }
  }
}
