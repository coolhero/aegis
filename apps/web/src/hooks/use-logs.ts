// T036: Log query hooks
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { RequestLogEntry, RequestLogDetail, PaginatedResponse, LogFilters } from '@/types/api';

export function useLogs(filters: LogFilters) {
  return useQuery({
    queryKey: queryKeys.logs.list(filters),
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const res = await apiClient.get<PaginatedResponse<RequestLogEntry>>('/logs', { params });
      return res.data;
    },
  });
}

export function useLogDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.logs.detail(id || ''),
    queryFn: async () => {
      const res = await apiClient.get<RequestLogDetail>(`/logs/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}
