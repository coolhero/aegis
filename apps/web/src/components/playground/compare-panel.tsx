// F012 T007: Model comparison — side-by-side streaming
'use client';

import { useState, useCallback } from 'react';
import { ModelInfo } from '@/hooks/use-models';
import { PlaygroundParams } from '@/hooks/use-playground';
import { useStreaming } from '@/hooks/use-streaming';
import { formatCost, estimateCost } from '@/lib/token-counter';

interface CompareResult {
  model: string;
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  responseTimeMs?: number;
  error?: string;
  isStreaming: boolean;
}

interface ComparePanelProps {
  models: ModelInfo[];
  params: PlaygroundParams;
  token?: string | null;
}

export function ComparePanel({ models, params, token }: ComparePanelProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<CompareResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  function toggleModel(modelId: string) {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) return prev.filter((m) => m !== modelId);
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, modelId];
    });
  }

  async function handleCompare() {
    if (!prompt.trim() || selectedModels.length < 2) return;

    setIsComparing(true);
    const initialResults = selectedModels.map((m) => ({
      model: m,
      content: '',
      isStreaming: true,
    }));
    setResults(initialResults);

    const promises = selectedModels.map(async (modelId, index) => {
      const startTime = Date.now();
      const baseURL = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
        : 'http://localhost:3000';

      try {
        const response = await fetch(`${baseURL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: params.temperature,
            max_tokens: params.max_tokens,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          setResults((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], error: `Error ${response.status}: ${errText}`, isStreaming: false };
            return updated;
          });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                setResults((prev) => {
                  const updated = [...prev];
                  updated[index] = { ...updated[index], content: updated[index].content + delta };
                  return updated;
                });
              }
              if (parsed.usage) {
                totalPromptTokens = parsed.usage.prompt_tokens || 0;
                totalCompletionTokens = parsed.usage.completion_tokens || 0;
              }
            } catch {}
          }
        }

        const responseTimeMs = Date.now() - startTime;
        setResults((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens },
            responseTimeMs,
            isStreaming: false,
          };
          return updated;
        });
      } catch (error: any) {
        setResults((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], error: error?.message || 'Connection failed', isStreaming: false };
          return updated;
        });
      }
    });

    await Promise.allSettled(promises);
    setIsComparing(false);
  }

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div className="p-4 bg-white rounded-lg border">
        <div className="font-medium text-gray-700 mb-2">
          Select Models (2-3)
          {selectedModels.length >= 3 && <span className="text-xs text-amber-600 ml-2">Max 3 models</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleModel(m.id)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                selectedModels.includes(m.id)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="flex gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt to compare..."
          rows={2}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
        />
        <button
          onClick={handleCompare}
          disabled={!prompt.trim() || selectedModels.length < 2 || isComparing}
          className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          Compare
        </button>
      </div>

      {/* Results side-by-side */}
      {results.length > 0 && (
        <div className={`grid gap-4 ${results.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {results.map((result, i) => {
            const modelInfo = models.find((m) => m.id === result.model);
            return (
              <div key={i} className="bg-white rounded-lg border p-4">
                <div className="font-medium text-gray-700 mb-2">
                  {modelInfo?.displayName || result.model}
                  {result.isStreaming && <span className="ml-2 text-xs text-blue-500 animate-pulse">streaming...</span>}
                </div>

                {result.error ? (
                  <div className="text-red-600 text-sm">{result.error}</div>
                ) : (
                  <div className="text-sm text-gray-800 whitespace-pre-wrap min-h-[100px]">
                    {result.content || (result.isStreaming ? '...' : '')}
                  </div>
                )}

                {result.usage && modelInfo && (
                  <div className="mt-3 pt-2 border-t text-xs text-gray-500 space-y-0.5">
                    <div>Tokens: {result.usage.prompt_tokens} in / {result.usage.completion_tokens} out</div>
                    <div>
                      Cost: {formatCost(
                        result.usage.prompt_tokens * modelInfo.inputPricePerToken +
                        result.usage.completion_tokens * modelInfo.outputPricePerToken
                      )}
                    </div>
                    {result.responseTimeMs && (
                      <div>Time: {(result.responseTimeMs / 1000).toFixed(1)}s</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
