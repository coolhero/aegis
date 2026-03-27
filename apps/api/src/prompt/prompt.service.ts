import { Injectable, NotFoundException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplate } from './prompt-template.entity';
import { PromptVersion } from './prompt-version.entity';
import { PromptUsageStat } from './prompt-usage-stat.entity';
import { VariableParserService } from './variable-parser.service';

const MAX_CONTENT_LENGTH = 100_000;

@Injectable()
export class PromptService {
  constructor(
    @InjectRepository(PromptTemplate)
    private readonly templateRepo: Repository<PromptTemplate>,
    @InjectRepository(PromptVersion)
    private readonly versionRepo: Repository<PromptVersion>,
    @InjectRepository(PromptUsageStat)
    private readonly statRepo: Repository<PromptUsageStat>,
    private readonly variableParser: VariableParserService,
  ) {}

  async create(orgId: string, userId: string, dto: { name: string; description?: string; content: string }) {
    if (dto.content.length > MAX_CONTENT_LENGTH) {
      throw new PayloadTooLargeException(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }

    const variables = this.variableParser.extract(dto.content);

    const template = this.templateRepo.create({
      orgId,
      name: dto.name,
      description: dto.description || null,
      variables,
      status: 'draft',
      createdBy: userId,
    });

    const saved = await this.templateRepo.save(template);

    // Create initial version (v1)
    const version = this.versionRepo.create({
      templateId: saved.id,
      versionNumber: 1,
      content: dto.content,
      changeNote: 'Initial version',
      createdBy: userId,
    });
    const savedVersion = await this.versionRepo.save(version);

    // Set active version
    saved.activeVersionId = savedVersion.id;
    await this.templateRepo.save(saved);

    // Create usage stat
    await this.statRepo.save(
      this.statRepo.create({ templateId: saved.id }),
    );

    return { ...saved, activeVersion: savedVersion };
  }

  async findAll(orgId: string, query: { page?: number; limit?: number; sort?: string; order?: string; status?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const sort = query.sort || 'createdAt';
    const order = (query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';

    const qb = this.templateRepo.createQueryBuilder('t')
      .where('t.orgId = :orgId', { orgId });

    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }

    // Join usage stats for call_count sorting
    if (sort === 'call_count') {
      qb.leftJoin('prompt_usage_stat', 's', 's.template_id = t.id')
        .orderBy('s.call_count', order);
    } else {
      const sortField = sort === 'name' ? 't.name' : 't.createdAt';
      qb.orderBy(sortField, order);
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string, orgId: string) {
    const template = await this.templateRepo.findOne({
      where: { id, orgId },
    });
    if (!template) throw new NotFoundException();
    return template;
  }

  async update(id: string, orgId: string, userId: string, dto: { content: string; changeNote?: string }) {
    if (dto.content.length > MAX_CONTENT_LENGTH) {
      throw new PayloadTooLargeException(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }

    const template = await this.findOne(id, orgId);
    const variables = this.variableParser.extract(dto.content);

    // Get next version number
    const maxVersion = await this.versionRepo
      .createQueryBuilder('v')
      .select('MAX(v.versionNumber)', 'max')
      .where('v.templateId = :templateId', { templateId: id })
      .getRawOne();
    const nextVersion = (maxVersion?.max || 0) + 1;

    const version = await this.versionRepo.save(
      this.versionRepo.create({
        templateId: id,
        versionNumber: nextVersion,
        content: dto.content,
        changeNote: dto.changeNote || null,
        createdBy: userId,
      }),
    );

    template.variables = variables;
    template.updatedAt = new Date();
    await this.templateRepo.save(template);

    return { ...template, newVersion: version };
  }

  async delete(id: string, orgId: string) {
    const template = await this.findOne(id, orgId);
    await this.templateRepo.remove(template);
    return { message: 'Prompt deleted' };
  }

  async findVersions(id: string, orgId: string) {
    await this.findOne(id, orgId); // verify ownership
    return this.versionRepo.find({
      where: { templateId: id },
      order: { versionNumber: 'DESC' },
    });
  }

  async publish(id: string, orgId: string, versionNumber: number) {
    const template = await this.findOne(id, orgId);
    const version = await this.versionRepo.findOne({
      where: { templateId: id, versionNumber },
    });
    if (!version) throw new NotFoundException('Version not found');

    template.activeVersionId = version.id;
    template.status = 'published';
    return this.templateRepo.save(template);
  }

  async rollback(id: string, orgId: string, targetVersion: number, endAbTest: (templateId: string) => Promise<void>) {
    const template = await this.findOne(id, orgId);
    const version = await this.versionRepo.findOne({
      where: { templateId: id, versionNumber: targetVersion },
    });
    if (!version) throw new NotFoundException('Target version not found');

    template.activeVersionId = version.id;
    await this.templateRepo.save(template);

    // Auto-end active A/B test
    await endAbTest(id);

    return template;
  }
}
