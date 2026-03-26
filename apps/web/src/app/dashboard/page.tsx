// T014: Main dashboard page — KPI cards
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { CardSkeleton } from '@/components/states/loading-skeleton';
import { ErrorState } from '@/components/states/error-state';
interface UsageSummaryResponse {
  org: {
    token_limit: number;
    tokens_used: number;
    tokens_remaining: number;
    token_usage_pct: number;
    cost_limit_usd: number;
    cost_used_usd: number;
    cost_remaining_usd: number;
    cost_usage_pct: number;
  };
  teams: Array<{ target_id: string; tokens_used: number; cost_used_usd: number }>;
  users: Array<{ target_id: string; tokens_used: number }>;
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-lg border p-6" data-testid="kpi-card">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.usage.summary,
    queryFn: async () => {
      const res = await apiClient.get<UsageSummaryResponse>('/usage/summary');
      return res.data;
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your organization's AI usage" />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && <ErrorState message="Failed to load dashboard data." onRetry={() => refetch()} />}

      {data && data.org && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Tokens Used"
            value={(data.org.tokens_used ?? 0).toLocaleString()}
            subtitle="This period"
          />
          <KpiCard
            title="Total Cost"
            value={`$${(data.org.cost_used_usd ?? 0).toFixed(2)}`}
            subtitle="This period"
          />
          <KpiCard
            title="Token Usage"
            value={`${(data.org.token_usage_pct ?? 0).toFixed(2)}%`}
            subtitle="Of budget"
          />
          <KpiCard
            title="Teams"
            value={(data.teams?.length ?? 0).toString()}
          />
        </div>
      )}
      {data && !data.org && (
        <ErrorState message="Budget data not available. Please set up an organization budget first." />
      )}
    </div>
  );
}
