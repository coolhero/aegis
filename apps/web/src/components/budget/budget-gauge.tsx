// T024: Budget gauge bar
export function BudgetGauge({ used, total, label }: { used: number; total: number; label: string }) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div data-testid="budget-gauge">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{used.toLocaleString()} used</span>
        <span>{total.toLocaleString()} total</span>
      </div>
    </div>
  );
}
