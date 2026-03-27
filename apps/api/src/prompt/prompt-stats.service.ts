import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptUsageStat } from './prompt-usage-stat.entity';

@Injectable()
export class PromptStatsService {
  constructor(
    @InjectRepository(PromptUsageStat)
    private readonly statRepo: Repository<PromptUsageStat>,
  ) {}

  async getStats(templateId: string) {
    const stat = await this.statRepo.findOne({
      where: { templateId },
    });

    return {
      template_id: templateId,
      call_count: stat?.callCount || 0,
      total_tokens: Number(stat?.totalTokens || 0),
      last_used_at: stat?.lastUsedAt || null,
    };
  }
}
