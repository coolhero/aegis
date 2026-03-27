import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class CacheStatsService {
  // In-memory miss counter per org (resets on restart — acceptable per Assumptions)
  private missCounters = new Map<string, number>();

  constructor(private readonly cacheService: CacheService) {}

  recordMiss(orgId: string) {
    const current = this.missCounters.get(orgId) || 0;
    this.missCounters.set(orgId, current + 1);
  }

  async getStats(orgId: string) {
    const dbStats = await this.cacheService.getStats(orgId);
    const missCount = this.missCounters.get(orgId) || 0;
    const totalRequests = dbStats.hit_count + missCount;
    const hitRate = totalRequests > 0 ? dbStats.hit_count / totalRequests : 0;

    return {
      hit_count: dbStats.hit_count,
      miss_count: missCount,
      hit_rate: Math.round(hitRate * 100) / 100,
      total_tokens_saved: dbStats.total_tokens_saved,
      total_entries: dbStats.total_entries,
    };
  }
}
