// F012: Playground main page — chat, prompt editor, compare, cost estimation
'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ModelSelector } from '@/components/playground/model-selector';
import { ChatPanel } from '@/components/playground/chat-panel';
import { CostEstimator } from '@/components/playground/cost-estimator';
import { PromptEditor } from '@/components/playground/prompt-editor';
import { HistoryPanel } from '@/components/playground/history-panel';
import { ComparePanel } from '@/components/playground/compare-panel';
import { usePlayground, PlaygroundMessage } from '@/hooks/use-playground';
import { useModels } from '@/hooks/use-models';
import { useAuthContext } from '@/lib/auth';
import { estimateCost } from '@/lib/token-counter';

type Tab = 'chat' | 'prompt' | 'compare';

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [actualUsage, setActualUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
    responseTimeMs: number;
  } | null>(null);

  const playground = usePlayground();
  const { models } = useModels();
  const auth = useAuthContext();

  const selectedModel = models.find((m) => m.id === playground.model);

  const inputText = playground.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');

  const handleComplete = useCallback(
    (usage: { prompt_tokens: number; completion_tokens: number; responseTimeMs: number }) => {
      setActualUsage(usage);

      if (selectedModel) {
        const cost = usage.prompt_tokens * selectedModel.inputPricePerToken +
          usage.completion_tokens * selectedModel.outputPricePerToken;

        playground.addToHistory({
          model: playground.model,
          messages: playground.messages,
          params: playground.params,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          costUsd: cost,
          responseTimeMs: usage.responseTimeMs,
        });
      }
    },
    [playground, selectedModel],
  );

  const handleSendFromEditor = useCallback(
    (prompt: string) => {
      playground.clearMessages();
      setActualUsage(null);
      const msg: PlaygroundMessage = { role: 'user', content: prompt, timestamp: new Date() };
      playground.addMessage(msg);
      setActiveTab('chat');
    },
    [playground],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'prompt', label: 'Prompt Editor' },
    { id: 'compare', label: 'Compare' },
  ];

  return (
    <div>
      <PageHeader title="Playground" description="Test LLM models, estimate costs, and explore APIs" />

      {/* Tabs */}
      <div className="mt-4 border-b">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        {/* Left: Main content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'chat' && (
            <ChatPanel
              model={playground.model}
              params={playground.params}
              messages={playground.messages}
              onAddMessage={playground.addMessage}
              onSetMessages={playground.setMessages}
              isStreaming={playground.isStreaming}
              onStreamingChange={playground.setIsStreaming}
              onComplete={handleComplete}
            />
          )}

          {activeTab === 'prompt' && (
            <PromptEditor
              onSendPrompt={handleSendFromEditor}
              disabled={playground.isStreaming}
            />
          )}

          {activeTab === 'compare' && (
            <ComparePanel
              models={models}
              params={playground.params}
              token={auth.accessToken}
            />
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <ModelSelector
            models={models}
            selectedModel={playground.model}
            onModelChange={playground.setModel}
            params={playground.params}
            onParamChange={playground.updateParam}
          />

          <CostEstimator
            inputText={inputText}
            model={selectedModel}
            maxTokens={playground.params.max_tokens}
            actualUsage={actualUsage}
          />

          <HistoryPanel
            history={playground.history}
            onSelect={(entry) => {
              playground.selectFromHistory(entry);
              setActualUsage(null);
              setActiveTab('chat');
            }}
          />
        </div>
      </div>
    </div>
  );
}
