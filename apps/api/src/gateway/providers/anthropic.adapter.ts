import Anthropic from '@anthropic-ai/sdk';
import {
  ProviderAdapter,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  Message,
} from '@aegis/common/gateway';

/**
 * Anthropic provider adapter.
 * Converts OpenAI-compatible requests to Anthropic Messages API format
 * and converts Anthropic responses back to OpenAI format.
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly providerType = 'anthropic';

  async chat(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl?: string,
  ): Promise<ChatCompletionResponse> {
    const client = this.createClient(apiKey, baseUrl);
    const { system, messages } = this.convertMessages(request.messages);

    const response = await client.messages.create({
      model: request.model,
      max_tokens: request.max_tokens ?? 4096,
      messages,
      ...(system ? { system } : {}),
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
      ...(request.stop
        ? { stop_sequences: Array.isArray(request.stop) ? request.stop : [request.stop] }
        : {}),
    });

    const contentText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const finishReason = this.mapStopReason(response.stop_reason);

    return {
      id: `chatcmpl-${response.id}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: contentText,
          },
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *chatStream(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const client = this.createClient(apiKey, baseUrl);
    const { system, messages } = this.convertMessages(request.messages);

    const stream = client.messages.stream({
      model: request.model,
      max_tokens: request.max_tokens ?? 4096,
      messages,
      ...(system ? { system } : {}),
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
      ...(request.stop
        ? { stop_sequences: Array.isArray(request.stop) ? request.stop : [request.stop] }
        : {}),
    });

    const chunkId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    let inputTokens = 0;
    let outputTokens = 0;

    // Initial chunk with role
    yield {
      id: chunkId,
      object: 'chat.completion.chunk',
      created,
      model: request.model,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        },
      ],
    };

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield {
            id: chunkId,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [
              {
                index: 0,
                delta: { content: delta.text },
                finish_reason: null,
              },
            ],
          };
        }
      } else if (event.type === 'message_delta') {
        const stopReason = this.mapStopReason(
          event.delta.stop_reason ?? null,
        );
        outputTokens = event.usage.output_tokens;

        yield {
          id: chunkId,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: stopReason,
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        };
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      }
    }
  }

  /**
   * Convert OpenAI-format messages to Anthropic format.
   * Extracts system message separately (Anthropic uses top-level system param).
   */
  private convertMessages(
    messages: Message[],
  ): {
    system: string | undefined;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic takes system as a separate parameter
        system = system ? `${system}\n\n${msg.content}` : msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return { system, messages: anthropicMessages };
  }

  private mapStopReason(
    reason: string | null,
  ): 'stop' | 'length' | 'content_filter' | null {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return null;
    }
  }

  private createClient(apiKey: string, baseUrl?: string): Anthropic {
    return new Anthropic({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }
}
