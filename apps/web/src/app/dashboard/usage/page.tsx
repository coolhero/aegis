// T022: Usage page
'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { UsageLineChart } from '@/components/charts/usage-line-chart';
import { CostLineChart } from '@/components/charts/cost-line-chart';
import { ModelBarChart } from '@/components/charts/model-bar-chart';
import { TeamBarChart } from '@/components/charts/team-bar-chart';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { ErrorState } from '@/components/states/error-state';
import { EmptyState } from '@/components/states/empty-state';
import { useUsageChart, useModelBreakdown, useTeamBreakdown } from '@/hooks/use-usage';

const periods = [
  { value: 'last7d', label: 'Last 7 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'last3m', label: 'Last 3 Months' },
];

const tabs = ['Overview', 'Model Breakdown', 'Team Breakdown'] as const;

export default function UsagePage() {
  const [period, setPeriod] = useState('last7d');
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview');

  const usageChart = useUsageChart(period);
  const modelBreakdown = useModelBreakdown(period);
  const teamBreakdown = useTeamBreakdown(period);

  return (
    <div>
      <PageHeader title="Usage & Cost" description="Monitor your organization's LLM usage and costs" />

      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md ${
                period === p.value ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto bg-gray-100 rounded-md p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md ${
                activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' && (
        <>
          {usageChart.isLoading && <LoadingSkeleton rows={6} />}
          {usageChart.isError && <ErrorState message="Failed to load usage data." onRetry={() => usageChart.refetch()} />}
          {usageChart.data && usageChart.data.length === 0 && (
            <EmptyState
              title="No usage data yet"
              description="Start making LLM requests through the API to see usage data here."
            />
          )}
          {usageChart.data && usageChart.data.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UsageLineChart data={usageChart.data} />
              <CostLineChart data={usageChart.data} />
            </div>
          )}
        </>
      )}

      {activeTab === 'Model Breakdown' && (
        <>
          {modelBreakdown.isLoading && <LoadingSkeleton rows={6} />}
          {modelBreakdown.isError && <ErrorState message="Failed to load model data." onRetry={() => modelBreakdown.refetch()} />}
          {modelBreakdown.data && modelBreakdown.data.length > 0 && <ModelBarChart data={modelBreakdown.data} />}
        </>
      )}

      {activeTab === 'Team Breakdown' && (
        <>
          {teamBreakdown.isLoading && <LoadingSkeleton rows={6} />}
          {teamBreakdown.isError && <ErrorState message="Failed to load team data." onRetry={() => teamBreakdown.refetch()} />}
          {teamBreakdown.data && teamBreakdown.data.length > 0 && <TeamBarChart data={teamBreakdown.data} />}
        </>
      )}
    </div>
  );
}
