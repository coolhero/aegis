// T025: Budget edit modal
'use client';

import { useState, FormEvent } from 'react';
import type { Budget, BudgetUpdateRequest } from '@/types/api';

interface BudgetEditModalProps {
  budget: Budget;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: BudgetUpdateRequest) => void;
  isSaving: boolean;
}

export function BudgetEditModal({ budget, isOpen, onClose, onSave, isSaving }: BudgetEditModalProps) {
  const [tokenLimit, setTokenLimit] = useState(budget.token_limit);
  const [costLimit, setCostLimit] = useState(budget.cost_limit_usd);
  const [thresholds, setThresholds] = useState(budget.alert_thresholds.join(', '));
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (tokenLimit < 0 || costLimit < 0) {
      setError('Limits must be positive numbers.');
      return;
    }

    const parsedThresholds = thresholds
      .split(',')
      .map((t) => parseInt(t.trim(), 10))
      .filter((t) => !isNaN(t) && t > 0 && t <= 100);

    onSave({
      token_limit: tokenLimit,
      cost_limit_usd: costLimit,
      alert_thresholds: parsedThresholds,
      enabled: budget.enabled,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="budget-edit-modal">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Edit Budget ({budget.level})</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token Limit</label>
            <input
              type="number"
              value={tokenLimit}
              onChange={(e) => setTokenLimit(Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 border rounded-md text-sm"
              data-testid="token-limit-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Limit ($)</label>
            <input
              type="number"
              value={costLimit}
              onChange={(e) => setCostLimit(Number(e.target.value))}
              min={0}
              step={0.01}
              className="w-full px-3 py-2 border rounded-md text-sm"
              data-testid="cost-limit-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alert Thresholds (%)</label>
            <input
              type="text"
              value={thresholds}
              onChange={(e) => setThresholds(e.target.value)}
              placeholder="80, 90, 100"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              data-testid="budget-save-button"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
