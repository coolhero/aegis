import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplate } from './prompt-template.entity';
import { PromptVersion } from './prompt-version.entity';
import { PromptUsageStat } from './prompt-usage-stat.entity';
import { VariableParserService } from './variable-parser.service';
import { AbTestService } from './ab-test.service';

@Injectable()
export class PromptResolverService {
  constructor(
    @InjectRepository(PromptTemplate)
    private readonly templateRepo: Repository<PromptTemplate>,
    @InjectRepository(PromptVersion)
    private readonly versionRepo: Repository<PromptVersion>,
    @InjectRepository(PromptUsageStat)
    private readonly statRepo: Repository<PromptUsageStat>,
    private readonly variableParser: VariableParserService,
    private readonly abTestService: AbTestService,
  ) {}

  async resolve(
    templateId: string,
    orgId: string,
    variables: Record<string, string>,
  ): Promise<{ text: string; version_id: string; variant_id: string | null }> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId, orgId },
    });
    if (!template) throw new NotFoundException();

    if (template.status !== 'published') {
      throw new BadRequestException({ error: 'prompt_not_published' });
    }

    let selectedVersionId = template.activeVersionId!;
    let variantId: string | null = null;

    // Check active A/B test
    const abTest = await this.abTestService.findActive(templateId);
    if (abTest) {
      const variant = this.abTestService.selectVariant(abTest.variants);
      selectedVersionId = variant.versionId;
      variantId = variant.id;

      // Record variant usage (async, non-blocking)
      this.abTestService.recordVariantUsage(variant.id, 0).catch(() => {});
    }

    const version = await this.versionRepo.findOne({
      where: { id: selectedVersionId },
    });
    if (!version) throw new NotFoundException('Active version not found');

    const text = this.variableParser.resolve(version.content, variables);

    // Record usage stat
    await this.statRepo
      .createQueryBuilder()
      .update(PromptUsageStat)
      .set({
        callCount: () => '"call_count" + 1',
        lastUsedAt: new Date(),
      })
      .where('template_id = :templateId', { templateId })
      .execute();

    return { text, version_id: version.id, variant_id: variantId };
  }
}
