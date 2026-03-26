// T018: Usage line chart
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { UsageDataPoint } from '@/types/api';

export function UsageLineChart({ data }: { data: UsageDataPoint[] }) {
  return (
    <div className="bg-white rounded-lg border p-6" data-testid="usage-line-chart">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Token Usage Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
