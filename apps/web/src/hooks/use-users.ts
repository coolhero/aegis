// T027: User management hooks
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { User } from '@/types/api';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list,
    queryFn: async () => {
      const res = await apiClient.get<User[]>('/users');
      return res.data;
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role, teamId }: { userId: string; role: string; teamId?: string }) => {
      const body: Record<string, unknown> = { role };
      if (teamId !== undefined) body.teamId = teamId || null;
      const res = await apiClient.patch(`/users/${userId}`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; name: string; role: string; password?: string; teamId?: string }) => {
      const res = await apiClient.post('/users', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list });
    },
  });
}
