# Implementation Plan: Token Budget Management

**Branch**: `004-token-budget` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-token-budget/spec.md`
**Re-planned**: 2026-03-26 — FR-015~017 반영, FR-018~022(ModelTier 모델별 예산) 3차 반영

## Summary

Org>Team>User 3계층 토큰/비용 예산 시스템. Redis Lua script로 원자적 check-and-reserve, 프로바이더 응답 기반 정산, BullMQ 기반 주기적 초기화, 웹훅 알림을 구현한다.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: NestJS, TypeORM, ioredis, BullMQ
**Storage**: PostgreSQL (예산 정의 + 기록), Redis (실시간 예산 카운터 + 원자적 연산)
**Testing**: Jest + Supertest (unit + integration)
**Target Platform**: Linux server (Docker)
**Project Type**: web-service (NestJS monorepo)
**Performance Goals**: 예산 check-and-reserve < 50ms 추가 지연
**Constraints**: 동시 100 요청 원자성 보장, 예산 정확도 100%

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Tenant Data Isolation | ✅ | Budget은 org_id 기반 격리 |
| Streaming-First | ✅ | 스트리밍 응답 최종 usage로 정산 |
| Model Agnosticism | ✅ | Model 엔티티 가격 참조, 프로바이더 무관 |
| Start Simple (YAGNI) | ✅ | MVP: 월간 초기화만, 커스텀 주기 v2 |
| Test-First | ✅ | 모든 SC에 테스트 작성 |

## Project Structure

### Documentation (this feature)

```text
specs/004-token-budget/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── budget-api.md
│   └── internal-services.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/src/
├── budget/
│   ├── budget.module.ts              # NestJS 모듈 정의
│   ├── budget.controller.ts          # REST API endpoints
│   ├── budget.service.ts             # 비즈니스 로직 (CRUD, 조회)
│   ├── budget-engine.service.ts      # 핵심 엔진 (check, reserve, reconcile, release)
│   ├── budget-alert.service.ts       # 알림 임계값 감지 + 웹훅 전송
│   ├── budget-reset.processor.ts     # BullMQ 프로세서 (월간 초기화)
│   ├── budget.guard.ts               # BudgetGuard (NestJS Guard)
│   ├── entities/
│   │   ├── budget.entity.ts
│   │   ├── budget-period.entity.ts
│   │   ├── usage-record.entity.ts
│   │   └── alert-record.entity.ts
│   ├── dto/
│   │   ├── set-budget.dto.ts
│   │   └── budget-response.dto.ts
│   └── lua/
│       └── check-and-reserve.lua     # Redis Lua script
├── app.module.ts                     # BudgetModule import 추가
└── ...
```

**Structure Decision**: NestJS module-per-domain 패턴. `budget/` 모듈에 모든 예산 관련 코드 집중. Redis Lua script는 `lua/` 하위 디렉토리에 관리.

## Architecture

### 핵심 흐름: Budget Check → Reserve → Execute → Reconcile

```
Client → POST /v1/chat/completions
  │
  ├─ AuthGuard (F003) → TenantContext 설정
  │
  ├─ BudgetGuard (F004)
  │   ├─ 0. Redis 연결 확인 (fail-closed: 연결 실패 시 503 반환)
  │   ├─ 1. 토큰 추정 (input 메시지 길이 기반, FR-016)
  │   ├─ 2. Redis Lua: check-and-reserve (User→Team→Org 원자적)
  │   │   ├─ 성공 → reservation_id 발급, 요청 진행
  │   │   ├─ 실패 → 429 + budget_exceeded + 차단 레벨
  │   │   └─ Redis 오류 → 503 Service Unavailable (FR-015)
  │   └─ 3. reservation_id를 request context에 저장
  │
  ├─ GatewayService (F002) → LLM 호출 + 스트리밍
  │
  └─ BudgetReconciler (응답 완료 후)
      ├─ 성공: provider usage 기반 정산 (Redis + DB)
      │   ├─ Redis: estimated → actual 차이 보정
      │   └─ DB: UsageRecord INSERT (reconciled)
      └─ 실패: 예약 해제 (Redis + DB)
          ├─ Redis: 예약된 토큰 전액 반환
          └─ DB: UsageRecord INSERT (released)
```

### Redis 데이터 구조

```
# 예산 카운터 (실시간)
budget:{level}:{id}:tokens    → 현재 기간 사용 토큰 (INCRBY/DECRBY)
budget:{level}:{id}:cost      → 현재 기간 사용 비용 (INCRBYFLOAT)
budget:{level}:{id}:period    → 현재 기간 ID (STRING)

# 예약 추적
reservation:{reservation_id}  → { tokens, cost, user_id, team_id, org_id, period_id } (HASH, TTL 5분)

# 알림 추적
alert:{budget_id}:{period_id}:{threshold}  → 1 (EXISTS 체크, 중복 방지)
```

### Redis Lua Script: check-and-reserve

원자적으로 User→Team→Org 3레벨 검사 + 예약:
1. 각 레벨의 `budget:{level}:{id}:tokens`와 한도를 비교
2. 모든 레벨 통과 시 INCRBY로 동시 예약
3. 하나라도 초과 시 어떤 레벨에서 실패했는지 반환
4. reservation HASH 생성 (TTL 5분 — 미정산 예약 자동 해제)

### 비용 계산

```
cost = (input_tokens × model.input_price_per_token)
     + (output_tokens × model.output_price_per_token)
```

Model 엔티티(F002)의 `input_price_per_token`, `output_price_per_token` 참조.

### 예산 초기화 (BullMQ)

- BullMQ Repeatable Job: 매월 1일 00:00 UTC 실행
- 새 BudgetPeriod 생성 (PostgreSQL)
- Redis 카운터 리셋 (`budget:{level}:{id}:tokens` → 0)
- 진행 중 요청은 reservation의 period_id로 원래 기간에 정산

### 알림 흐름

정산 후 사용률 체크 → 임계값 초과 시:
1. `alert:{budget_id}:{period_id}:{threshold}` EXISTS 체크 (중복 방지)
2. 미발송 시 AlertRecord INSERT (webhook_status: 'pending') + 웹훅 POST
3. 웹훅 실패 시 최대 3회 재시도 (exponential backoff: 1s, 2s, 4s) (FR-017)
4. 최종 실패 시 AlertRecord.webhook_status → 'failed' (SC-015)
5. 알림 전달 실패는 예산 차단에 영향 없음 (독립 처리)

### Redis Fail-Closed 정책 (FR-015)

BudgetGuard에서 Redis 연결 실패 감지 시:
1. `ioredis` 연결 상태 확인 (`redis.status === 'ready'`)
2. 연결 실패 시 즉시 `503 Service Unavailable` 반환
3. 에러 메시지: `{ statusCode: 503, error: "service_unavailable", message: "Budget service temporarily unavailable" }`
4. 예산 우회(fail-open) 절대 불가 — 보안 원칙

### 스트리밍 토큰 정산 시점 (FR-016)

1. **예약 시점**: `POST /v1/chat/completions` 수신 즉시, input 메시지 길이 기반 토큰 추정
2. **정산 시점**: 프로바이더 최종 SSE 이벤트의 `usage` 필드 수신 후
   - streaming: 마지막 `data:` chunk에서 `usage` 추출
   - non-streaming: 응답 body의 `usage` 필드 추출
3. **보정**: estimated_tokens와 actual_tokens 차이만큼 Redis 카운터 조정

### Model Tier 아키텍처 (FR-018~022)

#### 엔티티 설계

```
ModelTier (조직별 모델 등급)
  - id: UUID PK
  - org_id: UUID FK -> organizations
  - name: varchar(50) — "premium", "standard", "economy"
  - description: text
  - created_at, updated_at

ModelTierMember (티어↔모델 매핑)
  - id: UUID PK
  - tier_id: UUID FK -> model_tiers
  - model_id: UUID FK -> models
  - UNIQUE(model_id) — 1 모델 = 최대 1 티어
```

#### Budget 확장

기존 Budget 엔티티에 nullable `model_tier_id` 추가:
```
Budget 변경:
  + model_tier_id: UUID FK -> model_tiers, NULLABLE
  Unique Constraint 변경: (level, target_id) → (level, target_id, model_tier_id)
```

- `model_tier_id = NULL`: 전체 모델 대상 (global 예산, 기존 동작 유지)
- `model_tier_id = <uuid>`: 해당 티어 모델에만 적용

#### 예산 검증 흐름 (확장)

```
Client → POST /v1/chat/completions (model: "gpt-4o")
  │
  ├─ BudgetGuard
  │   ├─ 1. 모델 → 티어 Lookup (Redis 캐시: model_tier:{model_name} → tier_id)
  │   ├─ 2. 티어별 예산 체크 (tier_id가 있는 경우)
  │   │   └─ User→Team→Org 계층 × tier_id — 티어별 예산 초과 시 429 + tier 정보
  │   ├─ 3. 전체(global) 예산 체크 (기존 로직)
  │   │   └─ User→Team→Org 계층 × model_tier_id=NULL
  │   └─ 4. 두 체크 모두 통과 시 예약 (tier별 + global 동시 예약)
  │
  └─ 정산 시: tier별 + global 동시 정산
```

#### Redis 키 구조 (확장)

```
# 기존 (global 예산)
budget:{level}:{id}:*:tokens   → 전체 모델 사용량
budget:{level}:{id}:*:cost     → 전체 모델 비용

# 신규 (tier별 예산)
budget:{level}:{id}:{tier_id}:tokens → 해당 티어 모델 사용량
budget:{level}:{id}:{tier_id}:cost   → 해당 티어 모델 비용

# 모델→티어 캐시
model_tier:{model_name} → tier_id (TTL 1시간)
```

#### API

```
POST   /model-tiers         — 티어 생성 (Admin)
GET    /model-tiers         — 티어 목록 조회
PUT    /model-tiers/:id     — 티어 수정 (모델 추가/제거 포함)
DELETE /model-tiers/:id     — 티어 삭제 (소속 Budget 비활성화)
```
