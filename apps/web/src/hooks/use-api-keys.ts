// T027: API Key management hooks
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { ApiKey, ApiKeyCreateResponse } from '@/types/api';

export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys.list,
    queryFn: async () => {
      const res = await apiClient.get<ApiKey[]>('/api-keys');
      return res.data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; scopes: string[] }) => {
      const res = await apiClient.post<ApiKeyCreateResponse>('/api-keys', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      await apiClient.delete(`/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list });
    },
  });
}
