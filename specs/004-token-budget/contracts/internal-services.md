# Internal Service Contracts: F004

## BudgetGuard (NestJS Guard)

F002 GatewayController의 `POST /v1/chat/completions`에 적용.

```typescript
interface BudgetCheckResult {
  allowed: boolean;
  reservationId?: string;
  deniedAt?: 'user' | 'team' | 'org';
  remainingTokens?: number;
  remainingCostUsd?: number;
}

// Guard는 CanActivate 구현
// 예산 초과 시 HttpException(429) throw
// Redis 연결 실패 시 HttpException(503) throw (FR-015, fail-closed)
```

## BudgetEngineService

```typescript
interface ReservationInput {
  userId: string;
  teamId: string | null;
  orgId: string;
  estimatedTokens: number;
  modelId: string;
  idempotencyKey?: string;
}

interface ReservationResult {
  reservationId: string;
  periodIds: { user?: string; team?: string; org?: string };
}

interface ReconcileInput {
  reservationId: string;
  actualInputTokens: number;
  actualOutputTokens: number;
  modelId: string;
}

// Methods:
// reserve(input: ReservationInput): Promise<ReservationResult>
// reconcile(input: ReconcileInput): Promise<void>
// release(reservationId: string): Promise<void>
```

## BudgetAlertService

```typescript
interface AlertPayload {
  budget_id: string;
  level: 'org' | 'team' | 'user';
  target_id: string;
  threshold: number;
  usage_pct: number;
  period: { start: string; end: string };
  tokens_used: number;
  token_limit: number;
  cost_used_usd: number;
  cost_limit_usd: number;
}

// Methods:
// checkAndAlert(budgetId: string): Promise<void>
// sendWebhook(url: string, payload: AlertPayload, retries?: number): Promise<boolean>
//   - 최대 3회 재시도 (exponential backoff: 1s, 2s, 4s) (FR-017)
//   - 최종 실패 시 AlertRecord.webhook_status → 'failed' (SC-015)
```
