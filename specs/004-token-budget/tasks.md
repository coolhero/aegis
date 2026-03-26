# Tasks: F004 — Token Budget Management

**Feature**: F004 — Token Budget Management
**Branch**: `004-token-budget`
**Date**: 2026-03-26
**Re-tasked**: 2026-03-26 — FR-015~017 반영, FR-018~022(ModelTier) 3차 반영

## Task List

### T001: Budget 엔티티 + 마이그레이션

**Priority**: P0 (Foundation)
**Dependencies**: None
**SC Coverage**: SC-001, SC-002 기반

- `Budget`, `BudgetPeriod`, `UsageRecord`, `AlertRecord` TypeORM 엔티티 생성
- 마이그레이션 파일 생성 + 실행
- 인덱스, FK, Unique Constraint 포함
- `BudgetLevel`, `UsageRecordStatus` enum 정의

**Acceptance**: 마이그레이션 성공, 4개 테이블 생성 확인

---

### T002: BudgetModule + BudgetService (CRUD)

**Priority**: P0
**Dependencies**: T001
**SC Coverage**: SC-001, SC-002, SC-011, SC-012

- `BudgetModule` NestJS 모듈 생성
- `BudgetService`: Budget CRUD (set, get, list)
- `BudgetController`: REST endpoints (`PUT /budgets/:level/:id`, `GET /budgets/:level/:id`)
- DTO 정의 (`SetBudgetDto`, `BudgetResponseDto`)
- BudgetPeriod 자동 생성 (Budget 생성 시)
- RBAC 적용 (Admin only for PUT, Member+ for GET)
- `app.module.ts`에 BudgetModule import 추가

**Acceptance**: Budget 설정/조회 API 동작, RBAC 403 검증

---

### T003: Redis Lua check-and-reserve

**Priority**: P0 (핵심)
**Dependencies**: T001, T002
**SC Coverage**: SC-003, SC-004, SC-005, SC-006

- Redis Lua script (`check-and-reserve.lua`) 작성
  - User→Team→Org 3레벨 원자적 검사
  - 모든 레벨 통과 시 INCRBY + reservation HASH 생성
  - 실패 시 차단 레벨 반환
- `BudgetEngineService` 구현
  - `reserve()`: Lua script 실행 + ReservationResult 반환
  - `reconcile()`: 실제 usage 기반 Redis 보정 + UsageRecord INSERT
  - `release()`: 예약 해제 + Redis DECRBY + UsageRecord 상태 변경
- Redis 키 초기화 헬퍼 (Budget 생성/수정 시 Redis 동기화)
- 예산 미설정 엔티티 unlimited 처리

**Acceptance**: 동시 100 요청 테스트 통과, 원자성 검증

---

### T004: BudgetGuard (NestJS Guard)

**Priority**: P0 (핵심)
**Dependencies**: T003
**SC Coverage**: SC-003, SC-004, SC-005, SC-007, SC-013, SC-014

- `BudgetGuard` 구현 (CanActivate)
  - Redis 연결 상태 확인 (`redis.status === 'ready'`) (FR-015)
  - Redis 비가용 시 503 Service Unavailable 즉시 반환 (fail-closed, SC-013)
  - 토큰 추정 (input 메시지 길이 기반) (FR-016)
  - `BudgetEngineService.reserve()` 호출
  - 성공: reservation_id를 request context에 저장
  - 실패: 429 HttpException + budget_exceeded 상세
- `GatewayController`에 BudgetGuard 적용
- 정산/해제 인터셉터 구현
  - 성공 응답 후: `reconcile()` — 프로바이더 최종 SSE `usage` 필드 기준 정산 (FR-016, SC-014)
  - streaming: 마지막 `data:` chunk에서 `usage` 추출
  - non-streaming: 응답 body `usage` 필드 추출
  - estimated_tokens와 actual_tokens 차이만큼 Redis 카운터 보정
  - 에러 발생 시: `release()`
- 멱등성 키 지원 (idempotency_key 헤더)

**Acceptance**: LLM 요청 → 예산 차감 → 정산 전체 흐름 동작, Redis 다운 시 503 반환

---

### T005: Usage 조회 API

**Priority**: P1
**Dependencies**: T002, T003
**SC Coverage**: SC-011

- `GET /usage/:level/:id` 엔드포인트
- `GET /usage/summary` 엔드포인트 (Org 전체 drill-down)
- Redis 실시간 카운터 기반 조회 (DB fallback)
- 기간별 조회 (`?period=YYYY-MM`)
- RBAC: Admin → 전체, Member → 자신만

**Acceptance**: 사용량 조회 API 정확한 데이터 반환

---

### T006: Budget Alert (웹훅 알림)

**Priority**: P1
**Dependencies**: T003
**SC Coverage**: SC-008, SC-009, SC-015

- `BudgetAlertService` 구현
  - 정산 후 사용률 체크
  - Redis `alert:{budget_id}:{period_id}:{threshold}` 중복 체크
  - AlertRecord 생성 (webhook_status: 'pending') + 웹훅 POST
  - 최대 3회 재시도 (exponential backoff: 1s, 2s, 4s) (FR-017)
  - 성공 시 AlertRecord.webhook_status → 'sent'
  - 최종 실패 시 AlertRecord.webhook_status → 'failed' (SC-015)
  - 알림 실패는 예산 차단에 영향 없음 (독립 처리)
- 중복 알림 방지 (AlertRecord unique constraint + Redis EXISTS)

**Acceptance**: 80% 도달 → 웹훅 전달, 동일 기간 중복 없음, 웹훅 실패 시 3회 재시도 + 상태 기록

---

### T007: Budget Reset (월간 초기화)

**Priority**: P1
**Dependencies**: T002, T003
**SC Coverage**: SC-010

- `BudgetResetProcessor` (BullMQ)
  - Repeatable Job: 매월 1일 00:00 UTC
  - 새 BudgetPeriod 생성
  - Budget.currentPeriodId 업데이트
  - Redis 카운터 리셋
  - 이전 기간 `is_active = false`
- 진행 중 요청의 period_id 보존 로직

**Acceptance**: 초기화 후 새 기간 생성, 이전 기록 보존, 진행 요청 원래 기간 정산

---

### T008: 통합 테스트 + Seed Data

**Priority**: P2
**Dependencies**: T001~T007
**SC Coverage**: 전체

- 통합 테스트 (Jest + Supertest)
  - 예산 설정 → LLM 요청 → 차감 → 조회 E2E 흐름
  - 예산 초과 → 429 응답
  - 동시성 테스트 (Promise.all)
  - RBAC 403 테스트
  - Redis 다운 시 503 응답 테스트 (SC-013)
  - 스트리밍 정산 정확도 테스트 (SC-014)
  - 웹훅 실패 재시도 + 상태 기록 테스트 (SC-015)
- Seed data: demo org/team/user에 예산 추가
- Demo script: `demos/F004-token-budget.sh`

**Acceptance**: SC-001~SC-015 전체 테스트 통과, 데모 스크립트 실행 성공

---

### T009: ModelTier 엔티티 + CRUD API

**Priority**: P1
**Dependencies**: T001, T002
**SC Coverage**: SC-016, SC-017

- `ModelTier`, `ModelTierMember` TypeORM 엔티티 생성
- 마이그레이션: `model_tiers`, `model_tier_members` 테이블 생성
- Budget 엔티티에 nullable `model_tier_id` FK 추가
- Budget Unique Constraint 변경: `(level, target_id)` → `(level, target_id, model_tier_id)`
- `ModelTierController`: CRUD endpoints (`POST/GET/PUT/DELETE /model-tiers`)
- `ModelTierService`: 생성, 조회, 수정(모델 추가/제거), 삭제
- Admin 전용 RBAC 적용
- 모델 중복 할당 방지 (1 모델 = 최대 1 티어, UNIQUE 제약)

**Acceptance**: ModelTier CRUD 동작, 모델 중복 할당 시 409 반환

---

### T010: BudgetGuard 티어별 예산 검증 확장

**Priority**: P1 (핵심)
**Dependencies**: T003, T004, T009
**SC Coverage**: SC-018, SC-019, SC-020

- 모델→티어 Lookup 구현 (Redis 캐시: `model_tier:{model_name}` → tier_id, TTL 1시간)
- Redis Lua script 확장: tier별 + global 동시 검증/예약
  - Redis 키 확장: `budget:{level}:{id}:{tier_id}:tokens/cost`
- BudgetGuard에 티어별 검증 로직 추가
  - 티어 존재 시: 티어별 예산 체크 + global 예산 체크 (둘 다 통과 필수)
  - 티어 없는 모델: global 예산만 체크 (기존 동작)
- 정산/해제 시 tier별 + global 동시 처리
- 429 응답에 `tier` 필드 추가

**Acceptance**: premium 모델 → 티어+global 동시 차감, premium 소진 → 429 but standard 허용

---

### T011: ModelTier 통합 테스트

**Priority**: P2
**Dependencies**: T009, T010, T008
**SC Coverage**: SC-016~SC-020

- ModelTier CRUD 테스트
- 티어별 예산 → LLM 요청 → 동시 차감 E2E
- 티어 예산 소진 → 해당 티어 모델 429, 다른 티어 모델 허용
- Seed data: premium(GPT-4o, Claude Opus), standard(GPT-3.5, Claude Haiku)

**Acceptance**: SC-016~SC-020 전체 통과

---

## Dependency Graph

```
T001 (Entities)
 ├── T002 (CRUD + Controller)
 │    ├── T005 (Usage API)
 │    └── T007 (Reset)
 └── T003 (Redis Lua Engine)
      ├── T004 (BudgetGuard)
      ├── T005 (Usage API)
      ├── T006 (Alert)
      └── T007 (Reset)

T008 (Integration) ← T001~T007
T009 (ModelTier) ← T001, T002
T010 (Tier Guard) ← T003, T004, T009
T011 (Tier Tests) ← T009, T010, T008
```

## Parallel Execution Plan

| Phase | Tasks | 비고 |
|-------|-------|------|
| Phase 1 | T001 | 엔티티 + 마이그레이션 |
| Phase 2 | T002, T003 | CRUD와 Redis 엔진 병렬 |
| Phase 3 | T004, T005, T006, T007, T009 | Guard, API, Alert, Reset, ModelTier 병렬 |
| Phase 4 | T008, T010 | 통합 테스트 + Tier Guard 확장 |
| Phase 5 | T011 | ModelTier 통합 테스트 |
