// F012 T002: Model selector + parameter panel
'use client';

import { ModelInfo } from '@/hooks/use-models';
import { PlaygroundParams } from '@/hooks/use-playground';

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  params: PlaygroundParams;
  onParamChange: <K extends keyof PlaygroundParams>(key: K, value: PlaygroundParams[K]) => void;
}

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  params,
  onParamChange,
}: ModelSelectorProps) {
  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName} ({m.providerName})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Temperature: {params.temperature}
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={params.temperature}
          onChange={(e) => onParamChange('temperature', Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Max Tokens: {params.max_tokens}
        </label>
        <input
          type="range"
          min={1}
          max={4096}
          step={1}
          value={params.max_tokens}
          onChange={(e) => onParamChange('max_tokens', Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Top P: {params.top_p}
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={params.top_p}
          onChange={(e) => onParamChange('top_p', Number(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
