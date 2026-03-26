# Data Model: F004 — Token Budget Management

**Feature**: F004 — Token Budget Management
**Date**: 2026-03-26
**Phase**: 1 (Design)

## Entities

### Budget

특정 계층(org/team/user)의 예산 정의. 토큰 한도와 비용 한도를 포함.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `level` | enum | NOT NULL | 예산 레벨: `'org'` \| `'team'` \| `'user'` |
| `target_id` | UUID | NOT NULL | 대상 엔티티 ID (org/team/user의 id) |
| `org_id` | UUID | FK -> `organizations.id`, NOT NULL | 소속 조직 (테넌트 격리) |
| `token_limit` | bigint | NOT NULL | 기간별 토큰 한도 |
| `cost_limit_usd` | decimal(12,4) | NOT NULL | 기간별 비용 한도 (USD) |
| `alert_thresholds` | jsonb | NOT NULL, default: `'[80, 90, 100]'` | 알림 임계값 배열 (%) |
| `period_type` | varchar(20) | NOT NULL, default: `'monthly'` | 초기화 주기 |
| `webhook_url` | varchar(500) | NULLABLE | 알림 웹훅 URL |
| `enabled` | boolean | NOT NULL, default: `true` | 예산 활성화 여부 |
| `current_period_id` | UUID | FK -> `budget_periods.id`, NULLABLE | 현재 활성 기간 |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |
| `updated_at` | timestamp | NOT NULL, auto-set | 수정일 |

**Unique Constraint**: `(level, target_id)` — 하나의 엔티티에 하나의 예산

**TypeORM Entity**:

```typescript
export enum BudgetLevel {
  ORG = 'org',
  TEAM = 'team',
  USER = 'user',
}

@Entity('budgets')
@Unique(['level', 'targetId'])
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BudgetLevel })
  level: BudgetLevel;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'token_limit', type: 'bigint' })
  tokenLimit: number;

  @Column({ name: 'cost_limit_usd', type: 'decimal', precision: 12, scale: 4 })
  costLimitUsd: number;

  @Column({ name: 'alert_thresholds', type: 'jsonb', default: '[80, 90, 100]' })
  alertThresholds: number[];

  @Column({ name: 'period_type', length: 20, default: 'monthly' })
  periodType: string;

  @Column({ name: 'webhook_url', length: 500, nullable: true })
  webhookUrl: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'current_period_id', type: 'uuid', nullable: true })
  currentPeriodId: string;

  @OneToMany(() => BudgetPeriod, (period) => period.budget)
  periods: BudgetPeriod[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### BudgetPeriod

Budget의 시간 구간. 초기화 시 새 기간 생성, 이전 보존.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `budget_id` | UUID | FK -> `budgets.id`, NOT NULL | 소속 Budget |
| `start_date` | timestamp | NOT NULL | 기간 시작일 |
| `end_date` | timestamp | NOT NULL | 기간 종료일 |
| `total_tokens_used` | bigint | NOT NULL, default: `0` | 기간 사용 토큰 합계 |
| `total_cost_usd` | decimal(12,4) | NOT NULL, default: `0` | 기간 사용 비용 합계 |
| `is_active` | boolean | NOT NULL, default: `true` | 현재 활성 기간 여부 |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |

**TypeORM Entity**:

```typescript
@Entity('budget_periods')
export class BudgetPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => Budget, (budget) => budget.periods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'total_tokens_used', type: 'bigint', default: 0 })
  totalTokensUsed: number;

  @Column({ name: 'total_cost_usd', type: 'decimal', precision: 12, scale: 4, default: 0 })
  totalCostUsd: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

### UsageRecord

개별 LLM 요청의 토큰 사용 기록. 비용 추적 및 감사 추적 기반.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `budget_id` | UUID | FK -> `budgets.id`, NOT NULL | 소속 Budget |
| `period_id` | UUID | FK -> `budget_periods.id`, NOT NULL | 소속 기간 |
| `request_id` | UUID | NOT NULL | LLM 요청 ID (GatewayRequest 참조) |
| `idempotency_key` | varchar(255) | NULLABLE, UNIQUE | 멱등성 키 (재시도 이중 과금 방지) |
| `model_id` | UUID | FK -> `models.id`, NOT NULL | 사용 모델 |
| `input_tokens` | integer | NOT NULL, default: `0` | Input 토큰 수 |
| `output_tokens` | integer | NOT NULL, default: `0` | Output 토큰 수 |
| `estimated_tokens` | integer | NOT NULL, default: `0` | 사전 추정 토큰 수 |
| `cost_usd` | decimal(12,6) | NOT NULL, default: `0` | 계산된 비용 (USD) |
| `status` | enum | NOT NULL, default: `'reserved'` | 상태: `'reserved'` \| `'reconciled'` \| `'released'` |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |
| `reconciled_at` | timestamp | NULLABLE | 정산 시각 |

**TypeORM Entity**:

```typescript
export enum UsageRecordStatus {
  RESERVED = 'reserved',
  RECONCILED = 'reconciled',
  RELEASED = 'released',
}

@Entity('usage_records')
export class UsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => BudgetPeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'period_id' })
  period: BudgetPeriod;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ name: 'idempotency_key', length: 255, nullable: true, unique: true })
  idempotencyKey: string;

  @Column({ name: 'model_id', type: 'uuid' })
  modelId: string;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens: number;

  @Column({ name: 'estimated_tokens', type: 'int', default: 0 })
  estimatedTokens: number;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 12, scale: 6, default: 0 })
  costUsd: number;

  @Column({ type: 'enum', enum: UsageRecordStatus, default: UsageRecordStatus.RESERVED })
  status: UsageRecordStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'reconciled_at', type: 'timestamp', nullable: true })
  reconciledAt: Date;
}
```

---

### AlertRecord

발생한 예산 알림 기록. 중복 알림 방지용.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `budget_id` | UUID | FK -> `budgets.id`, NOT NULL | 대상 Budget |
| `period_id` | UUID | FK -> `budget_periods.id`, NOT NULL | 대상 기간 |
| `threshold` | integer | NOT NULL | 발생 임계값 (80, 90, 100) |
| `usage_pct` | decimal(5,2) | NOT NULL | 알림 시점 실제 사용률 |
| `webhook_status` | varchar(20) | NOT NULL, default: `'pending'` | 전송 상태: pending/sent/failed |
| `created_at` | timestamp | NOT NULL, auto-set | 발생 시각 |

**Unique Constraint**: `(budget_id, period_id, threshold)` — 동일 기간 내 동일 임계값 중복 방지

**TypeORM Entity**:

```typescript
@Entity('alert_records')
@Unique(['budgetId', 'periodId', 'threshold'])
export class AlertRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => BudgetPeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'period_id' })
  period: BudgetPeriod;

  @Column({ type: 'int' })
  threshold: number;

  @Column({ name: 'usage_pct', type: 'decimal', precision: 5, scale: 2 })
  usagePct: number;

  @Column({ name: 'webhook_status', length: 20, default: 'pending' })
  webhookStatus: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## Indexes

| Entity | Index Name | Columns | Type | Purpose |
|--------|-----------|---------|------|---------|
| Budget | `UQ_budgets_level_target` | `(level, target_id)` | UNIQUE | 엔티티당 하나의 예산 |
| Budget | `IDX_budgets_org_id` | `(org_id)` | INDEX | 조직별 예산 조회 |
| Budget | `IDX_budgets_target` | `(level, target_id)` | INDEX | 레벨+대상 빠른 조회 |
| BudgetPeriod | `IDX_periods_budget_active` | `(budget_id, is_active)` | INDEX | 활성 기간 빠른 조회 |
| UsageRecord | `IDX_usage_budget_period` | `(budget_id, period_id)` | INDEX | 기간별 사용량 집계 |
| UsageRecord | `IDX_usage_request` | `(request_id)` | INDEX | 요청별 사용 기록 조회 |
| UsageRecord | `UQ_usage_idempotency` | `(idempotency_key)` | UNIQUE | 멱등성 보장 (WHERE NOT NULL) |
| AlertRecord | `UQ_alert_dedup` | `(budget_id, period_id, threshold)` | UNIQUE | 중복 알림 방지 |

## Relationships

```
Organization (1) ----< (N) Budget
  - FK: budgets.org_id -> organizations.id, CASCADE DELETE

Budget (1) ----< (N) BudgetPeriod
  - FK: budget_periods.budget_id -> budgets.id, CASCADE DELETE

Budget (1) ----< (N) UsageRecord
  - FK: usage_records.budget_id -> budgets.id, CASCADE DELETE

BudgetPeriod (1) ----< (N) UsageRecord
  - FK: usage_records.period_id -> budget_periods.id, CASCADE DELETE

Budget (1) ----< (N) AlertRecord
  - FK: alert_records.budget_id -> budgets.id, CASCADE DELETE

BudgetPeriod (1) ----< (N) AlertRecord
  - FK: alert_records.period_id -> budget_periods.id, CASCADE DELETE

Model (1) ----< (N) UsageRecord
  - FK: usage_records.model_id -> models.id (referenced from F002)
```

## Seed Data

```typescript
// Budget seeds (after F003 seed org/team/user exist)
const seedBudgets = [
  {
    level: BudgetLevel.ORG,
    targetId: '<demo-org-id>',
    orgId: '<demo-org-id>',
    tokenLimit: 1000000,
    costLimitUsd: 100.00,
    alertThresholds: [80, 90, 100],
    periodType: 'monthly',
  },
  {
    level: BudgetLevel.TEAM,
    targetId: '<backend-team-id>',
    orgId: '<demo-org-id>',
    tokenLimit: 600000,
    costLimitUsd: 60.00,
  },
  {
    level: BudgetLevel.USER,
    targetId: '<admin-user-id>',
    orgId: '<demo-org-id>',
    tokenLimit: 200000,
    costLimitUsd: 20.00,
  },
];
```

---

### ModelTier

조직별 모델 등급 정의. 비용 수준에 따라 모델을 그룹화.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `org_id` | UUID | FK -> `organizations.id`, NOT NULL | 소속 조직 |
| `name` | varchar(50) | NOT NULL | 티어 이름 (premium, standard, economy) |
| `description` | text | NULLABLE | 설명 |
| `created_at` | timestamp | NOT NULL, auto-set | 생성일 |
| `updated_at` | timestamp | NOT NULL, auto-set | 수정일 |

**Unique Constraint**: `(org_id, name)` — 조직 내 동일 이름 티어 중복 방지

---

### ModelTierMember

모델↔티어 매핑. 1 모델 = 최대 1 티어.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `tier_id` | UUID | FK -> `model_tiers.id`, NOT NULL, CASCADE DELETE | 소속 티어 |
| `model_id` | UUID | FK -> `models.id`, NOT NULL | 대상 모델 |

**Unique Constraint**: `(model_id)` — 1 모델 = 최대 1 티어

---

### Budget 확장

기존 Budget에 nullable `model_tier_id` 추가:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `model_tier_id` | UUID | FK -> `model_tiers.id`, NULLABLE | 대상 모델 티어. NULL = 전체 모델(global) |

**Unique Constraint 변경**: `(level, target_id)` → `(level, target_id, model_tier_id)`

## Migration Strategy

- **Initial migration**: Creates `budgets`, `budget_periods`, `usage_records`, `alert_records` tables
- **ModelTier migration**: Creates `model_tiers`, `model_tier_members` tables. Adds `model_tier_id` to `budgets`. Updates unique constraint.
- **Seed migration**: Inserts demo budget for existing demo org/team/user + demo model tiers (premium, standard)
- **Redis**: 초기화 스크립트로 seed budget의 Redis 카운터 설정
- **Migration command**: `npm run migration:generate -- -n CreateBudgetEntities`
