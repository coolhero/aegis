import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbTest } from './ab-test.entity';
import { AbTestVariant } from './ab-test-variant.entity';

@Injectable()
export class AbTestService {
  constructor(
    @InjectRepository(AbTest)
    private readonly abTestRepo: Repository<AbTest>,
    @InjectRepository(AbTestVariant)
    private readonly variantRepo: Repository<AbTestVariant>,
  ) {}

  async create(templateId: string, variants: Array<{ version_id: string; weight: number }>) {
    // Validate weight sum
    const weightSum = variants.reduce((sum, v) => sum + v.weight, 0);
    if (weightSum !== 100) {
      throw new BadRequestException({
        error: 'invalid_weight_sum',
        expected: 100,
        actual: weightSum,
      });
    }

    // Check no active test
    const existing = await this.findActive(templateId);
    if (existing) {
      throw new ConflictException('An active A/B test already exists for this prompt');
    }

    const abTest = await this.abTestRepo.save(
      this.abTestRepo.create({ templateId, status: 'active' }),
    );

    const savedVariants = await Promise.all(
      variants.map((v) =>
        this.variantRepo.save(
          this.variantRepo.create({
            abTestId: abTest.id,
            versionId: v.version_id,
            weight: v.weight,
          }),
        ),
      ),
    );

    return { ...abTest, variants: savedVariants };
  }

  async findActive(templateId: string): Promise<(AbTest & { variants: AbTestVariant[] }) | null> {
    const test = await this.abTestRepo.findOne({
      where: { templateId, status: 'active' },
    });
    if (!test) return null;

    const variants = await this.variantRepo.find({
      where: { abTestId: test.id },
    });

    return { ...test, variants };
  }

  async endTest(templateId: string) {
    const test = await this.abTestRepo.findOne({
      where: { templateId, status: 'active' },
    });
    if (!test) return;

    test.status = 'completed';
    test.endedAt = new Date();
    await this.abTestRepo.save(test);
  }

  async getStats(templateId: string) {
    const test = await this.findActive(templateId);
    if (!test) throw new NotFoundException('No active A/B test found');

    return {
      ab_test_id: test.id,
      status: test.status,
      variants: test.variants.map((v) => ({
        variant_id: v.id,
        version_id: v.versionId,
        weight: v.weight,
        call_count: v.callCount,
        total_tokens: Number(v.totalTokens),
      })),
    };
  }

  async recordVariantUsage(variantId: string, tokens: number) {
    await this.variantRepo
      .createQueryBuilder()
      .update(AbTestVariant)
      .set({
        callCount: () => '"call_count" + 1',
        totalTokens: () => `"total_tokens" + ${tokens}`,
      })
      .where('id = :id', { id: variantId })
      .execute();
  }

  selectVariant(variants: AbTestVariant[]): AbTestVariant {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (rand < cumulative) {
        return variant;
      }
    }
    return variants[variants.length - 1];
  }
}
