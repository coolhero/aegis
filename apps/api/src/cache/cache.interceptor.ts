import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { CachePolicyService } from './cache-policy.service';
import { CacheStatsService } from './cache-stats.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly policyService: CachePolicyService,
    private readonly statsService: CacheStatsService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Only intercept POST /v1/chat/completions
    if (request.method !== 'POST' || !request.url?.includes('/v1/chat/completions')) {
      return next.handle();
    }

    const orgId = request.user?.tenantContext?.orgId;
    if (!orgId) return next.handle();

    try {
      // Check cache policy
      const policy = await this.policyService.getPolicy(orgId);
      if (!policy.enabled) {
        return next.handle();
      }

      // Extract query text from messages
      const messages = request.body?.messages;
      if (!messages || messages.length === 0) {
        return next.handle();
      }

      const queryText = messages
        .map((m: any) => m.content || '')
        .join('\n')
        .trim();

      if (!queryText) return next.handle();

      const model = request.body?.model || 'unknown';

      // Generate embedding (fail-open)
      const embedding = await this.embeddingService.embed(queryText);
      if (!embedding) {
        this.logger.debug('Embedding generation failed, skipping cache');
        return next.handle().pipe(
          tap(() => {
            response.setHeader('X-Cache', 'MISS');
            this.statsService.recordMiss(orgId);
          }),
        );
      }

      // Search cache
      const cached = await this.cacheService.findSimilar(
        orgId,
        model,
        embedding,
        policy.similarity_threshold,
      );

      if (cached) {
        this.logger.debug(`Cache HIT for org ${orgId}`);
        response.setHeader('X-Cache', 'HIT');
        request.cacheHit = true;
        return of(cached.response);
      }

      // Cache MISS — proceed to LLM
      this.statsService.recordMiss(orgId);

      return next.handle().pipe(
        tap((llmResponse) => {
          response.setHeader('X-Cache', 'MISS');

          // Store in cache (async, non-blocking)
          const tokensSaved = this.estimateTokens(llmResponse);
          this.cacheService
            .store(orgId, model, queryText, embedding, llmResponse, policy.ttl_seconds, tokensSaved)
            .catch((err) => this.logger.warn(`Cache store failed: ${err.message}`));
        }),
      );
    } catch (error: any) {
      // Fail-open: any error → skip cache, proceed to LLM
      this.logger.warn(`CacheInterceptor error: ${error?.message}`);
      return next.handle();
    }
  }

  private estimateTokens(response: any): number {
    try {
      const usage = response?.usage;
      if (usage) {
        return (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      }
      // Rough estimation from response content
      const content = response?.choices?.[0]?.message?.content || '';
      return Math.ceil(content.length / 4);
    } catch {
      return 0;
    }
  }
}
