import { Injectable, BadRequestException } from '@nestjs/common';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  Usage,
} from '@aegis/common/gateway';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { ProviderRegistry } from './providers/provider.registry';

@Injectable()
export class GatewayService {
  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Non-streaming chat completion.
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const resolved = await this.providerRegistry.resolve(request.model);
    if (!resolved) {
      throw new BadRequestException(
        `Model "${request.model}" not found or not available. Check that the model is registered and the provider is enabled.`,
      );
    }

    this.logger.log(
      `Routing non-streaming request to ${resolved.provider.name} (model: ${request.model})`,
      'GatewayService',
    );

    try {
      const response = await resolved.adapter.chat(
        request,
        resolved.apiKey,
        resolved.baseUrl,
      );

      this.logger.log(
        `Completed: ${response.usage.total_tokens} tokens (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`,
        'GatewayService',
      );

      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.error(
        `Provider error (${resolved.provider.name}): ${message}`,
        'GatewayService',
      );
      throw error;
    }
  }

  /**
   * Streaming chat completion.
   * Returns an async generator that yields SSE-formatted chunks.
   * Also tracks token usage across the stream.
   */
  async *chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    const resolved = await this.providerRegistry.resolve(request.model);
    if (!resolved) {
      throw new BadRequestException(
        `Model "${request.model}" not found or not available. Check that the model is registered and the provider is enabled.`,
      );
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
