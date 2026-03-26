# Data Model: F005 — Request Logging & Tracing

**Feature**: F005 — Request Logging & Tracing
**Date**: 2026-03-26
**Phase**: 1 (Design)

## Entities

### RequestLog

LLM 요청의 전체 라이프사이클을 기록하는 불변 로그 엔티티. Append-only — 수정/삭제 API 미제공.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | 고유 식별자 |
| `request_id` | UUID | NOT NULL, UNIQUE | 게이트웨이 요청 ID (F002 GatewayRequestContext.requestId). Idempotency key |
| `trace_id` | varchar(64) | NOT NULL | OpenTelemetry trace ID |
| `org_id` | UUID | FK → organizations.id, NOT NULL | 테넌트 (Organization) |
| `user_id` | UUID | FK → users.id, NOT NULL | 요청 사용자 |
| `team_id` | UUID | FK → teams.id, NULLABLE | 소속 팀 (없을 수 있음) |
| `model` | varchar(100) | NOT NULL | 요청된 모델명 (예: `gpt-4o`) |
| `provider` | varchar(50) | NOT NULL | 프로바이더명 (예: `openai`) |
| `input_masked` | text | NULLABLE | 입력 프롬프트 (최대 10KB truncated, F006 전 원본) |
| `output_masked` | text | NULLABLE | 출력 응답 (최대 10KB truncated) |
| `input_tokens` | integer | NOT NULL, default: 0 | 입력 토큰 수 |
| `output_tokens` | integer | NOT NULL, default: 0 | 출력 토큰 수 |
| `cost_usd` | decimal(12,6) | NOT NULL, default: 0 | 비용 (USD) — Model.input_price_per_token × input_tokens + output_price_per_token × output_tokens |
| `latency_ms` | integer | NOT NULL, default: 0 | 응답 지연시간 (ms) |
| `status` | varchar(20) | NOT NULL | 상태: `success` / `error` |
| `error_detail` | text | NULLABLE | 에러 상세 정보 (프로바이더 에러 코드 + 메시지) |
| `cache_hit` | boolean | NOT NULL, default: false | 캐시 히트 여부 (F011 연동 예정) |
| `estimated` | boolean | NOT NULL, default: false | 토큰 수가 추정값인지 (프로바이더가 usage 미포함 시 true) |
| `langfuse_trace_id` | varchar(100) | NULLABLE | Langfuse trace ID (Langfuse 미구성 시 null) |
| `input_size` | integer | NULLABLE | 원본 입력 바이트 수 (truncation 전) |
| `output_size` | integer | NULLABLE | 원본 출력 바이트 수 (truncation 전) |
| `created_at` | timestamp | NOT NULL, auto-set | 로그 생성 시점 |

**TypeORM Entity**:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('request_logs')
@Index('IDX_request_logs_org_created', ['orgId', 'createdAt'])
@Index('IDX_request_logs_model', ['model'])
@Index('IDX_request_logs_user', ['userId'])
@Index('IDX_request_logs_status', ['status'])
export class RequestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id', type: 'uuid', unique: true })
  requestId: string;

  @Column({ name: 'trace_id', length: 64 })
  traceId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ length: 100 })
  model: string;

  @Column({ length: 50 })
  provider: string;

  @Column({ name: 'input_masked', type: 'text', nullable: true })
  inputMasked: string | null;

  @Column({ name: 'output_masked', type: 'text', nullable: true })
  outputMasked: string | null;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens: number;

  @Column({
    name: 'cost_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
    default: 0,
  })
  costUsd: number;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs: number;

  @Column({ length: 20 })
  status: string;

  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail: string | null;

  @Column({ name: 'cache_hit', default: false })
  cacheHit: boolean;

  @Column({ default: false })
  estimated: boolean;

  @Column({ name: 'langfuse_trace_id', length: 100, nullable: true })
  langfuseTraceId: string | null;

  @Column({ name: 'input_size', type: 'int', nullable: true })
  inputSize: number | null;

  @Column({ name: 'output_size', type: 'int', nullable: true })
  outputSize: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## Indexes

| Entity | Index Name | Columns | Type | Purpose |
|--------|-----------|---------|------|---------|
| RequestLog | `UQ_request_logs_request_id` | `(request_id)` | UNIQUE | Idempotency — 중복 로그 방지 |
| RequestLog | `IDX_request_logs_org_created` | `(org_id, created_at DESC)` | COMPOSITE | 테넌트별 최신순 조회 (기본 목록) |
| RequestLog | `IDX_request_logs_model` | `(model)` | INDEX | 모델별 필터링/분석 |
| RequestLog | `IDX_request_logs_user` | `(user_id)` | INDEX | 사용자별 필터링 |
| RequestLog | `IDX_request_logs_status` | `(status)` | INDEX | 상태별 필터링 |

## Relationships

```
Organization (1) ----< (N) RequestLog
  - org_id FK (테넌트 격리의 핵심)
  - Cascade: 없음 (Organization 삭제 시 로그 보존)

User (1) ----< (N) RequestLog
  - user_id FK
  - Cascade: 없음

Team (1) ----< (N) RequestLog
  - team_id FK (nullable)
  - Cascade: 없음
```

> **참고**: Provider, Model과의 FK는 의도적으로 생략. `model`, `provider` 컬럼은 varchar로 저장하여 프로바이더/모델이 삭제되어도 과거 로그의 메타데이터가 보존됨.

## Migration Strategy

- **초기 마이그레이션**: `request_logs` 테이블 생성 (모든 컬럼 + 인덱스 + FK 제약조건)
- **마이그레이션 명령**: `npm run migration:generate -- -n CreateRequestLogs`
- **실행 명령**: `npm run migration:run`
- **보관 정리**: `@Cron('0 3 * * *')` (매일 03:00 UTC) — `created_at < NOW() - retention_days` 레코드 삭제

## Notes

- `input_masked`/`output_masked`는 F006 (Security Guardrails) 구현 전까지 원본 텍스트를 저장. F006 이후 PII 마스킹된 버전 저장
- `cost_usd` 계산: F002 Model 엔티티의 `input_price_per_token` × `input_tokens` + `output_price_per_token` × `output_tokens`
- `estimated` 플래그: 프로바이더 응답에 `usage` 필드가 없으면 토크나이저로 추정 후 true 설정
- `cache_hit` 컬럼은 F011 (Semantic Cache) 연동을 위해 예약. 기본값 false
- Provider/Model은 FK가 아닌 varchar 참조 — 로그 불변성과 히스토리 보존을 위한 설계 결정
