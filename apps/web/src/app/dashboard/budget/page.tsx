// T026: Budget management page
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { BudgetGauge } from '@/components/budget/budget-gauge';
import { BudgetEditModal } from '@/components/budget/budget-edit-modal';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { ErrorState } from '@/components/states/error-state';
import { useAuth } from '@/hooks/use-auth';
import { useBudget, useUpdateBudget } from '@/hooks/use-budgets';
import type { Budget, Team } from '@/types/api';

export default function BudgetPage() {
  const { user, canEdit } = useAuth();
  const orgId = user?.orgId || '';
  const [editBudget, setEditBudget] = useState<Budget | null>(null);

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const queryClient = useQueryClient();

  const orgBudget = useBudget('org', orgId);
  const updateBudget = useUpdateBudget();

  const createTeam = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await apiClient.post('/teams', { name, slug, orgId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.list });
      setShowCreateTeam(false);
      setNewTeamName('');
    },
  });

  const teams = useQuery({
    queryKey: queryKeys.teams.list,
    queryFn: async () => {
      const res = await apiClient.get<Team[]>('/teams');
      return res.data;
    },
  });

  return (
    <div>
      <PageHeader title="Budget Management" description="Manage token and cost budgets for your organization" />

      {orgBudget.isLoading && <LoadingSkeleton rows={4} />}
      {orgBudget.isError && <ErrorState message="Failed to load budget data." onRetry={() => orgBudget.refetch()} />}

      {orgBudget.data && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Organization Budget</h3>
              {canEdit && (
                <button
                  onClick={() => setEditBudget(orgBudget.data!)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 admin-action"
                  data-testid="edit-org-budget"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BudgetGauge
                used={orgBudget.data.current_period?.total_tokens_used ?? 0}
                total={orgBudget.data.token_limit}
                label="Tokens"
              />
              <BudgetGauge
                used={orgBudget.data.current_period?.total_cost_usd ?? 0}
                total={orgBudget.data.cost_limit_usd}
                label="Cost ($)"
              />
            </div>
          </div>

          {teams.data && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Team Budgets</h3>
                {canEdit && (
                  <button
                    onClick={() => setShowCreateTeam(true)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Team
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {teams.data.map((team) => (
                  <TeamBudgetRow key={team.id} team={team} canEdit={canEdit} onEdit={(b) => setEditBudget(b)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create Team</h3>
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateTeam(false)} className="px-4 py-2 text-sm border rounded-md">Cancel</button>
              <button
                onClick={() => createTeam.mutate(newTeamName)}
                disabled={!newTeamName || createTeam.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
              >
                {createTeam.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editBudget && (
        <BudgetEditModal
          budget={editBudget}
          isOpen={true}
          onClose={() => setEditBudget(null)}
          onSave={(data) => {
            updateBudget.mutate(
              { level: editBudget.level, id: editBudget.target_id, data },
              { onSuccess: () => setEditBudget(null) },
            );
          }}
          isSaving={updateBudget.isPending}
        />
      )}
    </div>
  );
}

function TeamBudgetRow({ team, canEdit, onEdit }: { team: Team; canEdit: boolean; onEdit: (budget: Budget) => void }) {
  const budget = useBudget('team', team.id);

  if (budget.isLoading) return <LoadingSkeleton rows={1} />;
  if (!budget.data) return null;

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
      <span className="text-sm font-medium w-32">{team.name}</span>
      <div className="flex-1">
        <BudgetGauge
          used={budget.data.current_period?.total_tokens_used ?? 0}
          total={budget.data.token_limit}
          label=""
        />
      </div>
      {canEdit && (
        <button
          onClick={() => onEdit(budget.data!)}
          className="text-xs text-blue-600 cursor-pointer hover:underline"
        >
          Edit
        </button>
      )}
    </div>
  );
}
