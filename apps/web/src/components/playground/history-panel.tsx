// F012 T006: Request/Response history panel
'use client';

import { HistoryEntry } from '@/hooks/use-playground';
import { formatCost } from '@/lib/token-counter';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ history, onSelect }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg border">
        <div className="font-medium text-gray-700 mb-2">History</div>
        <p className="text-sm text-gray-400">No requests yet</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border">
      <div className="font-medium text-gray-700 mb-2">History</div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {history.map((entry) => {
          const firstUserMsg = entry.messages.find((m) => m.role === 'user');
          const preview = firstUserMsg?.content.slice(0, 60) || '(empty)';

          return (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full text-left p-2 rounded-md hover:bg-gray-50 border text-sm transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700 truncate">{entry.model}</span>
                <span className="text-xs text-gray-400">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-500 truncate mt-0.5">{preview}</p>
              <div className="flex gap-3 text-xs text-gray-400 mt-1">
                <span>{entry.inputTokens + entry.outputTokens} tokens</span>
                <span>{formatCost(entry.costUsd)}</span>
                <span>{(entry.responseTimeMs / 1000).toFixed(1)}s</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
