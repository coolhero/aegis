import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { CacheEntry } from './cache-entry.entity';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @InjectRepository(CacheEntry)
    private readonly entryRepo: Repository<CacheEntry>,
  ) {}

  async findSimilar(
    orgId: string,
    model: string,
    embedding: number[],
    threshold: number,
  ): Promise<CacheEntry | null> {
    try {
      // Use pgvector cosine distance: 1 - (a <=> b) = cosine similarity
      const vectorStr = `[${embedding.join(',')}]`;
      const result = await this.entryRepo.query(
        `SELECT *, 1 - (query_vector::vector <=> $1::vector) AS similarity
         FROM cache_entry
         WHERE org_id = $2
           AND model = $3
           AND expires_at > NOW()
           AND 1 - (query_vector::vector <=> $1::vector) >= $4
         ORDER BY similarity DESC
         LIMIT 1`,
        [vectorStr, orgId, model, threshold],
      );

      if (result.length === 0) return null;

      // Update hit count
      await this.entryRepo
        .createQueryBuilder()
        .update(CacheEntry)
        .set({ hitCount: () => '"hit_count" + 1' })
        .where('id = :id', { id: result[0].id })
        .execute();

      return this.mapRow(result[0]);
    } catch (error: any) {
      this.logger.warn(`Cache lookup failed: ${error?.message}`);
      return null; // fail-open
    }
  }

  async findByHash(
    orgId: string,
    model: string,
    queryHash: string,
  ): Promise<CacheEntry | null> {
    return this.entryRepo.findOne({
      where: { orgId, model, queryHash },
    });
  }

  async store(
    orgId: string,
    model: string,
    queryText: string,
    embedding: number[],
    response: Record<string, any>,
    ttl: number,
    tokensSaved: number,
  ): Promise<CacheEntry> {
    const queryHash = createHash('sha256')
      .update(model + ':' + queryText)
      .digest('hex');

    const expiresAt = new Date(Date.now() + ttl * 1000);
    const vectorStr = `[${embedding.join(',')}]`;

    // Use raw query for vector insertion
    const result = await this.entryRepo.query(
      `INSERT INTO cache_entry (org_id, model, query_hash, query_vector, response, tokens_saved, ttl, expires_at)
       VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8)
       RETURNING *`,
      [orgId, model, queryHash, vectorStr, JSON.stringify(response), tokensSaved, ttl, expiresAt],
    );

    return this.mapRow(result[0]);
  }

  async invalidateOrg(orgId: string): Promise<number> {
    const result = await this.entryRepo.delete({ orgId });
    return result.affected || 0;
  }

  async getStats(orgId: string): Promise<{
    hit_count: number;
    miss_count: number;
    hit_rate: number;
    total_tokens_saved: number;
    total_entries: number;
  }> {
    const result = await this.entryRepo
      .createQueryBuilder('c')
      .select('SUM(c.hitCount)', 'totalHits')
      .addSelect('COUNT(*)', 'totalEntries')
      .addSelect('SUM(c.tokensSaved)', 'totalTokensSaved')
      .where('c.orgId = :orgId', { orgId })
      .getRawOne();

    const totalHits = Number(result.totalHits) || 0;
    const totalEntries = Number(result.totalEntries) || 0;
    const totalTokensSaved = Number(result.totalTokensSaved) || 0;

    return {
      hit_count: totalHits,
      miss_count: 0, // tracked separately via interceptor
      hit_rate: 0, // calculated at controller level with miss data
      total_tokens_saved: totalTokensSaved,
      total_entries: totalEntries,
    };
  }

  private mapRow(row: any): CacheEntry {
    const entry = new CacheEntry();
    entry.id = row.id;
    entry.orgId = row.org_id;
    entry.model = row.model;
    entry.queryHash = row.query_hash;
    entry.response = typeof row.response === 'string' ? JSON.parse(row.response) : row.response;
    entry.tokensSaved = Number(row.tokens_saved);
    entry.hitCount = Number(row.hit_count);
    entry.ttl = row.ttl;
    entry.createdAt = row.created_at;
    entry.expiresAt = row.expires_at;
    return entry;
  }
}
