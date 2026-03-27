// F012 T004: Token counter using simple estimation
// Uses character-based estimation (4 chars ≈ 1 token) for MVP.
// Can be replaced with gpt-tokenizer for exact counts.

export function countTokens(text: string): number {
  if (!text) return 0;
  // Rough estimation: ~4 characters per token for English text
  // This is a common heuristic used in LLM applications
  return Math.ceil(text.length / 4);
}

export function estimateCost(
  inputTokens: number,
  maxOutputTokens: number,
  inputPricePerToken: number,
  outputPricePerToken: number,
): { estimatedCost: number; inputCost: number; maxOutputCost: number } {
  const inputCost = inputTokens * inputPricePerToken;
  const maxOutputCost = maxOutputTokens * outputPricePerToken;
  return {
    estimatedCost: inputCost + maxOutputCost,
    inputCost,
    maxOutputCost,
  };
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  return `$${cost.toFixed(4)}`;
}
