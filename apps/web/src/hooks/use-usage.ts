// T017: Usage data hooks
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { UsageDataPoint, ModelBreakdown, TeamBreakdown } from '@/types/api';

// Map frontend period names to API-expected values
const periodMap: Record<string, string> = {
  last7d: 'daily',
  thisMonth: 'daily',
  last3m: 'monthly',
};

export function useUsageChart(period: string) {
  return useQuery({
    queryKey: queryKeys.usage.chart(period),
    queryFn: async () => {
      const res = await apiClient.get<UsageDataPoint[]>('/analytics/usage', {
        params: { period: periodMap[period] || 'daily', groupBy: 'model' },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 60 * 1000,
  });
}

export function useModelBreakdown(period: string) {
  return useQuery({
    queryKey: queryKeys.usage.modelBreakdown(period),
    queryFn: async () => {
      const res = await apiClient.get<ModelBreakdown[]>('/analytics/usage', {
        params: { period: periodMap[period] || 'daily', groupBy: 'model' },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useTeamBreakdown(period: string) {
  return useQuery({
    queryKey: queryKeys.usage.teamBreakdown(period),
    queryFn: async () => {
      const res = await apiClient.get<TeamBreakdown[]>('/analytics/cost', {
        params: { period: periodMap[period] || 'daily', groupBy: 'team' },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}
