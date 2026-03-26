# Data Model: F007 — Admin Dashboard

> F007은 프론트엔드 전용 Feature로 새 DB 엔티티를 소유하지 않는다.
> 아래는 프론트엔드 TypeScript 타입 정의와 SSE 이벤트 백엔드 타입이다.

## Frontend TypeScript Types

### Auth Types

```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  orgId: string;
  teamId: string | null;
}
```

### Budget Types

```typescript
interface Budget {
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

interface BudgetPeriod {
  id: string;
  start_date: string;
  end_date: string;
  total_tokens_used: number;
  total_cost_usd: number;
}

interface BudgetUpdateRequest {
  token_limit: number;
  cost_limit_usd: number;
  alert_thresholds: number[];
  webhook_url?: string;
  enabled: boolean;
}
```

### Usage & Analytics Types

```typescript
interface UsageSummary {
  total_tokens: number;
  total_cost_usd: number;
  total_requests: number;
  period: string;
}

interface UsageDataPoint {
  date: string;
  tokens: number;
  cost_usd: number;
  requests: number;
}

interface ModelBreakdown {
  model: string;
  tokens: number;
  cost_usd: number;
  requests: number;
  percentage: number;
}

interface TeamBreakdown {
  team_id: string;
  team_name: string;
  cost_usd: number;
  tokens: number;
  rank: number;
}
```

### Log Types

```typescript
interface RequestLogEntry {
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

interface RequestLogDetail extends RequestLogEntry {
  input_masked: string;
  output_masked: string;
  langfuse_trace_id: string | null;
  user_id: string;
  team_id: string | null;
  error_detail: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### SSE Event Types

```typescript
interface SSEEvent {
  type: 'request_completed' | 'budget_alert' | 'ping';
  data: RequestCompletedEvent | BudgetAlertEvent | null;
  timestamp: string;
}

interface RequestCompletedEvent {
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

interface BudgetAlertEvent {
  budget_id: string;
  level: 'org' | 'team' | 'user';
  threshold: number;
  usage_pct: number;
}
```

## Backend — SSE Events Module (NestJS)

### EventConnection (in-memory)

SSE 연결 관리를 위한 인메모리 구조. DB 엔티티 아님.

```typescript
interface EventConnection {
  orgId: string;         // 테넌트 격리 키
  userId: string;        // 연결 사용자
  response: Response;    // SSE response stream
  connectedAt: Date;
  lastPingAt: Date;
}
```

- `connections: Map<string, EventConnection[]>` — orgId별 연결 그룹
- 연결/해제 시 Map 업데이트
- 30초 간격 heartbeat ping
