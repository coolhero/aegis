// T020: Model breakdown bar chart
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ModelBreakdown } from '@/types/api';

export function ModelBarChart({ data }: { data: ModelBreakdown[] }) {
  return (
    <div className="bg-white rounded-lg border p-6" data-testid="model-bar-chart">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Usage by Model</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="model" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Tokens']} />
          <Bar dataKey="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
