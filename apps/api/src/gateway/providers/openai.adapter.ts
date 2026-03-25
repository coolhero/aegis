import OpenAI from 'openai';
import {
  ProviderAdapter,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from '@aegis/common/gateway';

export class OpenAIAdapter implements ProviderAdapter {
  readonly providerType = 'openai';

  async chat(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl?: string,
  ): Promise<ChatCompletionResponse> {
    const client = this.createClient(apiKey, baseUrl);

    const response = await client.chat.completions.create({
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      top_p: request.top_p,
      max_tokens: request.max_tokens,
      stop: request.stop,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      user: request.user,
      stream: false,
    });

    return {
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map((c, i) => ({
        index: i,
        message: {
          role: 'assistant' as const,
          content: c.message.content ?? '',
        },
        finish_reason: c.finish_reason as 'stop' | 'length' | 'content_filter' | null,
      })),
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  async *chatStream(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const client = this.createClient(apiKey, baseUrl);

    const stream = await client.chat.completions.create({
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      top_p: request.top_p,
      max_tokens: request.max_tokens,
      stop: request.stop,
      presence_penalty: request.presence_penalty,
      frequency_penalty: request.frequency_penalty,
      user: request.user,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const mapped: ChatCompletionChunk = {
        id: chunk.id,
        object: 'chat.completion.chunk',
        created: chunk.created,
        model: chunk.model,
        choices: chunk.choices.map((c, i) => ({
          index: i,
          delta: {
            role: c.delta.role as 'assistant' | undefined,
            content: c.delta.content ?? undefined,
          },
          finish_reason: c.finish_reason as 'stop' | 'length' | 'content_filter' | null,
        })),
        usage: chunk.usage
          ? {
              prompt_tokens: chunk.usage.prompt_tokens,
              completion_tokens: chunk.usage.completion_tokens,
              total_tokens: chunk.usage.total_tokens,
            }
          : null,
      };

      yield mapped;
    }
  }

  private createClient(apiKey: string, baseUrl?: string): OpenAI {
    return new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }
}
