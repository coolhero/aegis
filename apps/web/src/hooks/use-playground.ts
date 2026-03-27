// F012 T002: Playground state management
'use client';

import { useState, useCallback, createContext, useContext } from 'react';

export interface PlaygroundMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface PlaygroundParams {
  temperature: number;
  max_tokens: number;
  top_p: number;
}

export interface HistoryEntry {
  id: string;
  model: string;
  messages: PlaygroundMessage[];
  params: PlaygroundParams;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  responseTimeMs: number;
  timestamp: Date;
}

const DEFAULT_PARAMS: PlaygroundParams = {
  temperature: 0.7,
  max_tokens: 1024,
  top_p: 1.0,
};

export function usePlayground() {
  const [model, setModel] = useState('gpt-4');
  const [params, setParams] = useState<PlaygroundParams>(DEFAULT_PARAMS);
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);

  const addMessage = useCallback((msg: PlaygroundMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const addToHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    setHistory((prev) => [
      {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
      ...prev,
    ]);
  }, []);

  const selectFromHistory = useCallback((entry: HistoryEntry) => {
    setModel(entry.model);
    setParams(entry.params);
    setMessages(entry.messages.filter((m) => m.role === 'user'));
  }, []);

  const updateParam = useCallback(<K extends keyof PlaygroundParams>(key: K, value: PlaygroundParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    model,
    setModel,
    params,
    setParams,
    updateParam,
    messages,
    addMessage,
    clearMessages,
    setMessages,
    history,
    addToHistory,
    selectFromHistory,
    isStreaming,
    setIsStreaming,
    compareModels,
    setCompareModels,
  };
}
