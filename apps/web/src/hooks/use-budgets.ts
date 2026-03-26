// T023: Budget CRUD hooks
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { Budget, BudgetUpdateRequest } from '@/types/api';

export function useBudget(level: string, id: string) {
  return useQuery({
    queryKey: queryKeys.budget.get(level, id),
    queryFn: async () => {
      const res = await apiClient.get<Budget>(`/budgets/${level}/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ level, id, data }: { level: string; id: string; data: BudgetUpdateRequest }) => {
      const res = await apiClient.put<Budget>(`/budgets/${level}/${id}`, data);
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.get(variables.level, variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.list(variables.level) });
    },
  });
}
