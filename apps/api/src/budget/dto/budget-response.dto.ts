export interface BudgetResponseDto {
  id: string;
  level: string;
  target_id: string;
  token_limit: number;
  cost_limit_usd: number;
  alert_thresholds: number[];
  period_type: string;
  webhook_url: string | null;
  enabled: boolean;
  current_period: {
    id: string;
    start_date: string;
    end_date: string;
    total_tokens_used: number;
    total_cost_usd: number;
  } | null;
}

export interface UsageResponseDto {
  budget_id: string;
  level: string;
  target_id: string;
  period: {
    start_date: string;
    end_date: string;
  };
  token_limit: number;
  tokens_used: number;
  tokens_remaining: number;
  token_usage_pct: number;
  cost_limit_usd: number;
  cost_used_usd: number;
  cost_remaining_usd: number;
  cost_usage_pct: number;
}
