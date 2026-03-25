import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from './gateway.types';

/**
 * Provider adapter interface.
 * Each LLM provider (OpenAI, Anthropic, etc.) implements this interface.
 */
export interface ProviderAdapter {
  /** Provider type identifier (e.g. 'openai', 'anthropic') */
  readonly providerType: string;

  /**
   * Non-streaming chat completion.
   * Returns the full response at once.
   */
  chat(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl?: string,
  ): Promise<ChatCompletionResponse>;

  /**
   * Streaming chat completion.
   * Yields chunks as they arrive from the provider (token-by-token).
   */
  chatStream(
    request: ChatCompletionRequest,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown>;
}
