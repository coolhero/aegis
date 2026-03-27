// F012 T004: Cost estimator panel
'use client';

import { useTokenCounter } from '@/hooks/use-token-counter';
import { estimateCost, formatCost } from '@/lib/token-counter';
import { ModelInfo } from '@/hooks/use-models';

interface CostEstimatorProps {
  inputText: string;
  model: ModelInfo | undefined;
  maxTokens: number;
  actualUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    responseTimeMs: number;
  } | null;
}

export function CostEstimator({ inputText, model, maxTokens, actualUsage }: CostEstimatorProps) {
  const estimatedInputTokens = useTokenCounter(inputText);

  const estimate = model
    ? estimateCost(
        estimatedInputTokens,
        maxTokens,
        model.inputPricePerToken,
        model.outputPricePerToken,
      )
    : null;

  const actualCost = actualUsage && model
    ? estimateCost(
        actualUsage.prompt_tokens,
        actualUsage.completion_tokens,
        model.inputPricePerToken,
        model.outputPricePerToken,
      )
    : null;

  return (
    <div className="p-3 bg-gray-50 rounded-lg border text-xs space-y-2">
      <div className="font-medium text-gray-700">Cost Estimate</div>

      <div className="flex justify-between text-gray-600">
        <span>Input tokens (est.)</span>
        <span>{estimatedInputTokens.toLocaleString()}</span>
      </div>

      <div className="flex justify-between text-gray-600">
        <span>Max output tokens</span>
        <span>{maxTokens.toLocaleString()}</span>
      </div>

      {estimate && (
        <div className="flex justify-between font-medium text-gray-900 border-t pt-1">
          <span>Est. max cost</span>
          <span>{formatCost(estimate.estimatedCost)}</span>
        </div>
      )}

      {actualUsage && (
        <>
          <div className="border-t pt-2 mt-2">
            <div className="font-medium text-green-700 mb-1">Actual Usage</div>
            <div className="flex justify-between text-gray-600">
              <span>Input tokens</span>
              <span>{actualUsage.prompt_tokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Output tokens</span>
              <span>{actualUsage.completion_tokens.toLocaleString()}</span>
            </div>
            {actualCost && (
              <div className="flex justify-between font-medium text-green-900 border-t pt-1">
                <span>Actual cost</span>
                <span>{formatCost(actualCost.inputCost + actualCost.maxOutputCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>Response time</span>
              <span>{(actualUsage.responseTimeMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
