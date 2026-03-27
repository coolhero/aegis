// F012 T002: Model list hook
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  providerName: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
  maxTokens: number;
}

// Static model list for MVP — will be replaced by /models API later
const STATIC_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4',
    name: 'gpt-4',
    displayName: 'GPT-4',
    providerName: 'OpenAI',
    inputPricePerToken: 0.00003,
    outputPricePerToken: 0.00006,
    maxTokens: 8192,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    providerName: 'OpenAI',
    inputPricePerToken: 0.0000005,
    outputPricePerToken: 0.0000015,
    maxTokens: 4096,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    providerName: 'Anthropic',
    inputPricePerToken: 0.000003,
    outputPricePerToken: 0.000015,
    maxTokens: 8192,
  },
];

export function useModels() {
  const [models] = useState<ModelInfo[]>(STATIC_MODELS);
  const [isLoading] = useState(false);

  return { models, isLoading };
}
