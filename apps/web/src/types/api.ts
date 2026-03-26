// T008: API response types

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  orgId: string;
  teamId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  org_id: string;
  team_id: string | null;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  org_id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface ApiKeyCreateResponse extends ApiKey {
  key: string; // Full key, shown only once
}

export interface Budget {
  id: string;
  level: 'org' | 'team' | 'user';
  target_id: string;
  org_id: string;
  token_limit: number;
  cost_limit_usd: number;
  alert_thresholds: number[];
  period_type: string;
  webhook_url: string | null;
  enabled: boolean;
  current_period: BudgetPeriod;
}

export interface BudgetPeriod {
  id: string;
  start_date: string;
  end_date: string;
  total_tokens_used: number;
  total_cost_usd: number;
}

export interface BudgetUpdateRequest {
  token_limit: number;
  cost_limit_usd: number;
  alert_thresholds: number[];
  webhook_url?: string;
  enabled: boolean;
}

export interface UsageSummary {
  total_tokens: number;
  total_cost_usd: number;
  total_requests: number;
  active_users: number;
}

export interface UsageDataPoint {
  date: string;
  tokens: number;
  cost_usd: number;
  requests: number;
}

export interface ModelBreakdown {
  model: string;
  tokens: number;
  cost_usd: number;
  requests: number;
  percentage: number;
}

export interface TeamBreakdown {
  team_id: string;
  team_name: string;
  cost_usd: number;
  tokens: number;
  rank: number;
}

export interface RequestLogEntry {
  id: string;
  request_id: string;
  trace_id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: 'success' | 'error';
  cache_hit: boolean;
  created_at: string;
}

export interface RequestLogDetail extends RequestLogEntry {
  input_masked: string;
  output_masked: string;
  langfuse_trace_id: string | null;
  user_id: string;
  team_id: string | null;
  error_detail: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SSEEvent {
  type: 'request_completed' | 'budget_alert' | 'ping';
  data: RequestCompletedEvent | BudgetAlertEvent | null;
  timestamp: string;
}

export interface RequestCompletedEvent {
  request_id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: 'success' | 'error';
  user_id: string;
}

export interface BudgetAlertEvent {
  budget_id: string;
  level: 'org' | 'team' | 'user';
  threshold: number;
  usage_pct: number;
}

export interface LogFilters {
  model?: string;
  status?: string;
  userId?: string;
  teamId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
