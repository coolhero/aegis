// T021: Team cost comparison bar chart
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TeamBreakdown } from '@/types/api';

export function TeamBarChart({ data }: { data: TeamBreakdown[] }) {
  const sorted = [...data].sort((a, b) => b.cost_usd - a.cost_usd);

  return (
    <div className="bg-white rounded-lg border p-6" data-testid="team-bar-chart">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Cost by Team</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="team_name" tick={{ fontSize: 12 }} width={100} />
          <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']} />
          <Bar dataKey="cost_usd" fill="#f59e0b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
