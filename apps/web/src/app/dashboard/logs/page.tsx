// T037: Logs page
'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { ErrorState } from '@/components/states/error-state';
import { EmptyState } from '@/components/states/empty-state';
import { useLogs, useLogDetail } from '@/hooks/use-logs';
import type { RequestLogEntry, LogFilters } from '@/types/api';

export default function LogsPage() {
  const [filters, setFilters] = useState<LogFilters>({ page: 1, limit: 20 });
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useLogs(filters);
  const logDetail = useLogDetail(selectedLogId);

  const columns = [
    { key: 'createdAt', header: 'Time', render: (l: any) => new Date(l.createdAt).toLocaleString() },
    { key: 'model', header: 'Model' },
    { key: 'provider', header: 'Provider' },
    { key: 'inputTokens', header: 'In Tokens', render: (l: any) => (l.inputTokens ?? 0).toLocaleString() },
    { key: 'outputTokens', header: 'Out Tokens', render: (l: any) => (l.outputTokens ?? 0).toLocaleString() },
    { key: 'costUsd', header: 'Cost', render: (l: any) => `$${Number(l.costUsd ?? 0).toFixed(4)}` },
    { key: 'latencyMs', header: 'Latency', render: (l: any) => `${l.latencyMs ?? 0}ms` },
    {
      key: 'status',
      header: 'Status',
      render: (l: any) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${l.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {l.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Request Logs" description="Browse and search LLM request logs" />

      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filters.model || ''}
          onChange={(e) => setFilters({ ...filters, model: e.target.value || undefined, page: 1 })}
          className="px-3 py-1.5 text-sm border rounded-md"
        >
          <option value="">All Models</option>
          <option value="gpt-4o">gpt-4o</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
        </select>

        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
          className="px-3 py-1.5 text-sm border rounded-md"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>

        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined, page: 1 })}
          className="px-3 py-1.5 text-sm border rounded-md"
          placeholder="Start Date"
        />
        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined, page: 1 })}
          className="px-3 py-1.5 text-sm border rounded-md"
          placeholder="End Date"
        />
      </div>

      {isLoading && <LoadingSkeleton rows={8} />}
      {isError && <ErrorState message="Failed to load logs." onRetry={() => refetch()} />}
      {data && data.data.length === 0 && <EmptyState title="No logs found" description="Adjust filters or make some API requests." />}
      {data && data.data.length > 0 && (
        <DataTable
          columns={columns}
          data={data.data}
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          onPageChange={(p) => setFilters({ ...filters, page: p })}
          onRowClick={(item) => setSelectedLogId(item.id)}
        />
      )}

      {selectedLogId && logDetail.data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Log Detail</h3>
              <button onClick={() => setSelectedLogId(null)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Request ID:</span> <span className="font-mono">{logDetail.data.request_id}</span></div>
                <div><span className="text-gray-500">Trace ID:</span> <span className="font-mono">{logDetail.data.trace_id}</span></div>
                <div><span className="text-gray-500">Model:</span> {logDetail.data.model}</div>
                <div><span className="text-gray-500">Provider:</span> {logDetail.data.provider}</div>
                <div><span className="text-gray-500">Tokens:</span> {logDetail.data.input_tokens} in / {logDetail.data.output_tokens} out</div>
                <div><span className="text-gray-500">Cost:</span> ${logDetail.data.cost_usd.toFixed(4)}</div>
                <div><span className="text-gray-500">Latency:</span> {logDetail.data.latency_ms}ms</div>
                <div><span className="text-gray-500">Status:</span> {logDetail.data.status}</div>
              </div>
              {logDetail.data.input_masked && (
                <div>
                  <h4 className="font-medium mb-1">Input (masked)</h4>
                  <pre className="bg-gray-50 p-3 rounded-md text-xs whitespace-pre-wrap">{logDetail.data.input_masked}</pre>
                </div>
              )}
              {logDetail.data.output_masked && (
                <div>
                  <h4 className="font-medium mb-1">Output (masked)</h4>
                  <pre className="bg-gray-50 p-3 rounded-md text-xs whitespace-pre-wrap">{logDetail.data.output_masked}</pre>
                </div>
              )}
              {logDetail.data.langfuse_trace_id && (
                <div>
                  <span className="text-gray-500">Langfuse Trace:</span>{' '}
                  <a href="#" className="text-blue-600 hover:underline">{logDetail.data.langfuse_trace_id}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
