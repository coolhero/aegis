// T019: Cost line chart
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { UsageDataPoint } from '@/types/api';

export function CostLineChart({ data }: { data: UsageDataPoint[] }) {
  return (
    <div className="bg-white rounded-lg border p-6" data-testid="cost-line-chart">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Cost Trend ($)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} />
          <Line type="monotone" dataKey="cost_usd" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
