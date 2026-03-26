import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  Usage,
} from '@aegis/common/gateway';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { ProviderRegistry, ResolvedProvider } from './providers/provider.registry';
import { CircuitBreakerService } from './circuit-breaker.service';
import { LatencyTrackerService } from './latency-tracker.service';

const MAX_FALLBACK_HOPS = 2;

@Injectable()
export class GatewayService {
  private lastFallbackProvider: string | null = null;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly logger: LoggerService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly latencyTracker: LatencyTrackerService,
  ) {}

  getLastFallbackProvider(): string | null {
    return this.lastFallbackProvider;
  }

  /**
   * Non-streaming chat completion.
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.lastFallbackProvider = null;
    const candidates = await this.providerRegistry.resolveAll(request.model);
    if (!candidates || candidates.length === 0) {
      throw new BadRequestException(
        `Model "${request.model}" not found or not available. Check that the model is registered and the provider is enabled.`,
      );
    }

    // Filter out providers with OPEN circuits and sort by latency/weight
    const available: ResolvedProvider[] = [];
    for (const candidate of candidates) {
      const isOpen = await this.circuitBreaker.isOpen(candidate.provider.id);
      if (!isOpen) {
        available.push(candidate);
      }
    }

    if (available.length === 0) {
      throw new ServiceUnavailableException({
        error: 'all_providers_unavailable',
        message: 'All providers are currently unavailable. Please retry later.',
        retryAfter: 30,
      });
    }

    // Sort by avg latency (ascending), then by weight (descending)
    const sorted = await this.sortByLatencyAndWeight(available);

    // Try providers with fallback (max 2 hops)
    const tried = new Set<string>();
    let hop = 0;

    for (const resolved of sorted) {
      if (hop >= MAX_FALLBACK_HOPS) break;
      if (tried.has(resolved.provider.id)) continue; // Prevent cycles
      tried.add(resolved.provider.id);

      this.logger.log(
        `Routing request to ${resolved.provider.name} (model: ${request.model}, hop: ${hop})`,
        'GatewayService',
      );

      const startTime = Date.now();
      try {
        const response = await resolved.adapter.chat(
          request,
          resolved.apiKey,
          resolved.baseUrl,
        );

        const latency = Date.now() - startTime;
        await this.circuitBreaker.recordSuccess(resolved.provider.id);
        await this.latencyTracker.recordLatency(resolved.provider.id, latency);

        if (hop > 0) {
          this.lastFallbackProvider = resolved.provider.name;
        }

        this.logger.log(
          `Completed: ${response.usage.total_tokens} tokens (${resolved.provider.name}, ${latency}ms)`,
          'GatewayService',
        );

        return response;
      } catch (error) {
        await this.circuitBreaker.recordFailure(resolved.provider.id);
        await this.latencyTracker.recordError(resolved.provider.id);

        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Provider error (${resolved.provider.name}, hop ${hop}): ${message}`,
          'GatewayService',
        );
        hop++;
      }
    }

    // All providers failed
    throw new ServiceUnavailableException({
      error: 'all_providers_unavailable',
      message: 'All providers failed after fallback attempts.',
      retryAfter: 30,
    });
  }

  /**
   * Streaming chat completion.
   * Returns an async generator that yields SSE-formatted chunks.
   * Also tracks token usage across the stream.
   */
  async *chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    // For streaming, select the best available provider (no mid-stream fallback)
    const resolved = await this.selectBestProvider(request.model);
    if (!resolved) {
      throw new ServiceUnavailableException({
        error: 'all_providers_unavailable',
        message: 'No available provider for streaming request.',
        retryAfter: 30,
      });
    }

    this.logger.log(
      `Routing streaming request to ${resolved.provider.name} (model: ${request.model})`,
      'GatewayService',
    );

    const usage: Usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    let chunkCount = 0;

    try {
      const stream = resolved.adapter.chatStream(
        request,
        resolved.apiKey,
        resolved.baseUrl,
      );

      for await (const chunk of stream) {
        chunkCount++;

        // Track token usage from chunks
        this.accumulateUsage(usage, chunk);

        // Yield SSE-formatted data
        yield `data: ${JSON.stringify(chunk)}\n\n`;
      }

      // Send [DONE] marker
      yield 'data: [DONE]\n\n';

      this.logger.log(
        `Stream completed: ${chunkCount} chunks, ${usage.total_tokens} tokens (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`,
        'GatewayService',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.error(
        `Stream error after ${chunkCount} chunks (${resolved.provider.name}): ${message}`,
        'GatewayService',
      );

      // Send error event via SSE
      const errorPayload = {
        error: {
          message: `Provider error: ${message}`,
          type: 'provider_error',
          code: 'stream_error',
          param: null,
        },
      };
      yield `event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`;
      yield 'data: [DONE]\n\n';
    }
  }

  /**
   * Accumulate usage data from streaming chunks.
   * Provider's final usage (in the last chunk) is treated as ground truth.
   */
  private async selectBestProvider(modelName: string): Promise<ResolvedProvider | null> {
    const candidates = await this.providerRegistry.resolveAll(modelName);
    if (!candidates || candidates.length === 0) return null;

    const available: ResolvedProvider[] = [];
    for (const candidate of candidates) {
      const isOpen = await this.circuitBreaker.isOpen(candidate.provider.id);
      if (!isOpen) {
        available.push(candidate);
      }
    }

    if (available.length === 0) return null;

    const sorted = await this.sortByLatencyAndWeight(available);
    return sorted[0] || null;
  }

  private async sortByLatencyAndWeight(providers: ResolvedProvider[]): Promise<ResolvedProvider[]> {
    const withMetrics = await Promise.all(
      providers.map(async (p) => ({
        provider: p,
        avgLatency: await this.latencyTracker.getAvgLatency(p.provider.id),
        weight: p.provider.weight || 1,
      })),
    );

    // Sort: lower latency first, then higher weight
    return withMetrics
      .sort((a, b) => {
        if (a.avgLatency === 0 && b.avgLatency === 0) {
          return b.weight - a.weight; // No latency data — use weight
        }
        if (a.avgLatency === 0) return 1; // No data goes last
        if (b.avgLatency === 0) return -1;
        return a.avgLatency - b.avgLatency;
      })
      .map((m) => m.provider);
  }

  private accumulateUsage(usage: Usage, chunk: ChatCompletionChunk): void {
    if (chunk.usage) {
      // Provider reported final usage — use as ground truth
      usage.prompt_tokens = chunk.usage.prompt_tokens;
      usage.completion_tokens = chunk.usage.completion_tokens;
      usage.total_tokens = chunk.usage.total_tokens;
    } else {
      // Estimate: count content characters as rough token proxy
      for (const choice of chunk.choices) {
        if (choice.delta.content) {
          // Rough estimate: ~4 chars per token. Provider usage reconciles later.
          usage.completion_tokens += Math.max(
            1,
            Math.ceil(choice.delta.content.length / 4),
          );
          usage.total_tokens =
            usage.prompt_tokens + usage.completion_tokens;
        }
      }
    }
  }
}
