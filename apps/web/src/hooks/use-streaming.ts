// F012 T003: SSE streaming hook
'use client';

import { useRef, useCallback, useState } from 'react';
interface StreamingOptions {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  token?: string | null;
  onToken: (token: string) => void;
  onComplete: (usage: { prompt_tokens: number; completion_tokens: number }) => void;
  onError: (error: string) => void;
}

export function useStreaming() {
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const send = useCallback(async (options: StreamingOptions) => {
    const { model, messages, temperature, max_tokens, top_p, onToken, onComplete, onError } = options;

    abortRef.current = new AbortController();
    setIsStreaming(true);

    try {
      const baseURL = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
        : 'http://localhost:3000';

      const response = await fetch(`${baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens ?? 1024,
          top_p: top_p ?? 1.0,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = `Error ${response.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.message || parsed.error?.message || errorMsg;
        } catch {
          errorMsg = errorBody || errorMsg;
        }

        if (response.status === 429) {
          onError('Budget exceeded. Your organization has reached its token/cost limit.');
        } else {
          onError(errorMsg);
        }
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response stream available');
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onComplete({ prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens });
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              onToken(delta);
            }
            if (parsed.usage) {
              totalPromptTokens = parsed.usage.prompt_tokens || 0;
              totalCompletionTokens = parsed.usage.completion_tokens || 0;
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      onComplete({ prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // User stopped streaming
      } else {
        onError(error?.message || 'Connection lost');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { send, stop, isStreaming };
}
