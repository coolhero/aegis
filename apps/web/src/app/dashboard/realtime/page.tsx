// T035: Realtime monitoring page
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { useSSE } from '@/hooks/use-sse';
import type { RequestCompletedEvent } from '@/types/api';

function StatusIndicator({ status }: { status: string }) {
  const color = status === 'connected' ? 'bg-green-500' : status === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500';
  const label = status === 'connected' ? 'Connected' : status === 'reconnecting' ? 'Reconnecting...' : 'Disconnected';

  return (
    <div className="flex items-center gap-2" data-testid="sse-indicator">
      <div className={`w-2.5 h-2.5 rounded-full ${color} ${status === 'connected' ? '' : 'animate-pulse'}`} />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}

export default function RealtimePage() {
  const { status, feed, isConnected } = useSSE();

  const requestCount = feed.filter((f) => f.type === 'request_completed').length;

  return (
    <div>
      <PageHeader
        title="Realtime Monitoring"
        description="Live LLM request activity"
        action={<StatusIndicator status={status} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Live Requests</p>
          <p className="text-2xl font-bold" data-testid="live-request-count">{requestCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Connection Status</p>
          <p className="text-2xl font-bold">{isConnected ? 'Active' : 'Inactive'}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Feed Items</p>
          <p className="text-2xl font-bold">{feed.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border" data-testid="activity-feed">
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium">Activity Feed</h3>
        </div>
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {feed.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              Waiting for events...
            </div>
          )}
          {feed.map((item, i) => {
            if (item.type === 'request_completed') {
              const data = item.data as RequestCompletedEvent;
              return (
                <div key={i} className="px-4 py-3 flex items-center gap-4 text-sm">
                  <span className={`w-2 h-2 rounded-full ${data.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium w-24">{data.model}</span>
                  <span className="text-gray-500 w-20">{data.input_tokens + data.output_tokens} tok</span>
                  <span className="text-gray-500 w-20">${data.cost_usd.toFixed(4)}</span>
                  <span className="text-gray-500 w-16">{data.latency_ms}ms</span>
                  <span className="text-gray-400 ml-auto text-xs">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
              );
            }
            if (item.type === 'budget_alert') {
              return (
                <div key={i} className="px-4 py-3 flex items-center gap-4 text-sm bg-yellow-50">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="font-medium text-yellow-800">Budget Alert</span>
                  <span className="text-yellow-600">Threshold reached</span>
                  <span className="text-gray-400 ml-auto text-xs">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
