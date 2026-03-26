# Tasks: F005 — Request Logging & Tracing

**Input**: Design documents from `/specs/005-request-logging-tracing/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/logs.contract.md, research.md

**Tests**: Test-First (TDD) ACTIVE — 각 User Story에서 테스트를 먼저 작성

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: F005 모듈 기초 구조 + 의존성 설치

- [ ] T001 Install langfuse-node and @opentelemetry/api dependencies via `npm install langfuse-node @opentelemetry/api`
- [ ] T002 Create logging module directory structure: `apps/api/src/logging/`, `entities/`, `dto/`
- [ ] T003 [P] Create logging constants file `apps/api/src/logging/logging.constants.ts` (queue name, default retention days, max content size)
- [ ] T004 [P] Create RequestLog TypeORM entity in `apps/api/src/logging/entities/request-log.entity.ts` per data-model.md
- [ ] T005 Create LoggingModule in `apps/api/src/logging/logging.module.ts` (TypeORM, BullMQ registration, imports)
- [ ] T006 Register LoggingModule in `apps/api/src/app.module.ts`
- [ ] T007 Generate and run database migration for `request_logs` table: `npm run migration:generate -- -n CreateRequestLogs && npm run migration:run`

**Checkpoint**: RequestLog 엔티티와 테이블 생성 완료. 로깅 모듈 등록 완료.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: BullMQ 큐 설정 + Langfuse 서비스 — 모든 User Story가 의존

- [ ] T008 Test: LangfuseService unit test in `apps/api/src/logging/langfuse.service.spec.ts` — createTrace+generation 호출 검증, 연결 실패 시 예외 미전파 검증
- [ ] T009 Implement LangfuseService in `apps/api/src/logging/langfuse.service.ts` — langfuse-node SDK 래퍼, fire-and-forget, 연결 실패 시 warn 로그만
- [ ] T010 Test: LoggingQueueProcessor unit test in `apps/api/src/logging/logging-queue.processor.spec.ts` — DB 저장 검증, Langfuse 호출 검증, 실패 재시도 검증
- [ ] T011 Implement LoggingQueueProcessor in `apps/api/src/logging/logging-queue.processor.ts` — BullMQ @Processor('request-log'), DB 쓰기 + Langfuse 전송, 3회 재시도 + DLQ

**Checkpoint**: BullMQ 워커 + Langfuse 서비스 준비 완료. 비동기 로깅 파이프라인 기반.

---

## Phase 3: User Story 1 — LLM 요청 자동 로깅 (Priority: P1) 🎯 MVP

**Goal**: POST /v1/chat/completions 요청 시 RequestLog가 자동 생성 (비스트리밍 + 스트리밍 + 에러)

**Independent Test**: API Key로 LLM 요청 → GET /logs로 로그 확인 → 모든 필수 필드 기록 검증

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Test: RequestLoggerInterceptor unit test in `apps/api/src/logging/request-logger.interceptor.spec.ts` — 비스트리밍 요청 캡처, 스트리밍 요청 누적 토큰, 에러 요청 캡처, BullMQ enqueue 호출 검증, 비용 계산 검증
- [ ] T013 [P] [US1] Test: 인메모리 폴백 버퍼 unit test (interceptor 내) — Redis 끊김 시 버퍼 저장, 재연결 시 flush 검증

### Implementation for User Story 1

- [ ] T014 [US1] Implement RequestLoggerInterceptor in `apps/api/src/logging/request-logger.interceptor.ts` — NestInterceptor, 요청 전후 타이밍, 응답/에러 캡처, BullMQ enqueue (비동기), 인메모리 폴백 버퍼, 비용 계산 (Model.inputPricePerToken), 토큰 추정 폴백 (estimated: true), content truncation (10KB)
- [ ] T015 [US1] Apply RequestLoggerInterceptor to GatewayController in `apps/api/src/gateway/gateway.controller.ts` — `@UseInterceptors(RequestLoggerInterceptor)`
- [ ] T016 [US1] Add trace_id extraction via @opentelemetry/api in interceptor — `trace.getActiveSpan()?.spanContext().traceId` or UUID fallback

**Checkpoint**: LLM 요청 시 RequestLog 자동 생성 (SC-001, SC-002, SC-011, SC-013, SC-014, SC-015, SC-016)

---

## Phase 4: User Story 2 — 로그 조회 및 검색 (Priority: P2)

**Goal**: GET /logs (필터+페이지네이션), GET /logs/:id (상세) API 제공

**Independent Test**: 여러 LLM 요청 후 GET /logs에 필터 적용하여 정확한 결과 반환 검증

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T017 [P] [US2] Test: LoggingService unit test in `apps/api/src/logging/logging.service.spec.ts` — findAll (필터, 페이지네이션), findById, 테넌트 격리 검증
- [ ] T018 [P] [US2] Test: LoggingController unit test in `apps/api/src/logging/logging.controller.spec.ts` — GET /logs, GET /logs/:id 응답 형식 검증

### Implementation for User Story 2

- [ ] T019 [P] [US2] Create LogQueryDto in `apps/api/src/logging/dto/log-query.dto.ts` — page, limit, model, provider, userId, teamId, status, startDate, endDate, minCost, maxCost (class-validator)
- [ ] T020 [US2] Implement LoggingService in `apps/api/src/logging/logging.service.ts` — findAll (QueryBuilder + 동적 where + 페이지네이션), findById (org_id 필터 포함), 테넌트 격리 자동 적용
- [ ] T021 [US2] Implement LoggingController in `apps/api/src/logging/logging.controller.ts` — `GET /logs` (AuthGuard, @Query LogQueryDto), `GET /logs/:id` (AuthGuard), TenantContext에서 org_id 추출

**Checkpoint**: 로그 조회/검색 API 완료 (SC-005, SC-006, SC-009, SC-010)

---

## Phase 5: User Story 3 — 사용량 및 비용 분석 (Priority: P2)

**Goal**: GET /analytics/usage, GET /analytics/cost — 집계 API 제공

**Independent Test**: 다양한 모델/사용자 요청 후 groupBy+period 집계 결과 검증

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T022 [P] [US3] Test: AnalyticsController unit test in `apps/api/src/logging/analytics.controller.spec.ts` — usage/cost 집계 응답 형식 검증
- [ ] T023 [P] [US3] Test: LoggingService 분석 메서드 unit test — getUsageAnalytics, getCostAnalytics (GROUP BY + DATE_TRUNC) 검증

### Implementation for User Story 3

- [ ] T024 [P] [US3] Create AnalyticsQueryDto in `apps/api/src/logging/dto/analytics-query.dto.ts` — groupBy (model/team/user), period (daily/weekly/monthly), startDate, endDate
- [ ] T025 [US3] Implement analytics methods in LoggingService — getUsageAnalytics (GROUP BY + DATE_TRUNC, 요청 수/토큰 합계), getCostAnalytics (비용 합계), 테넌트 격리
- [ ] T026 [US3] Implement AnalyticsController in `apps/api/src/logging/analytics.controller.ts` — `GET /analytics/usage`, `GET /analytics/cost` (AuthGuard)

**Checkpoint**: 분석 API 완료 (SC-007, SC-008)

---

## Phase 6: User Story 4 — Langfuse 통합 (Priority: P3)

**Goal**: LLM 요청 시 Langfuse에 trace + generation 자동 기록, 장애 격리

**Independent Test**: Langfuse 서버 실행 중 LLM 요청 → Langfuse 대시보드에서 trace/generation 확인

### Tests for User Story 4

- [ ] T027 [US4] Test: LangfuseService 통합 동작 보완 테스트 — trace+generation 메타데이터 (model, usage, tenant_id, user_id) 검증, 스트리밍 완료 후 누적 토큰 기록 검증

### Implementation for User Story 4

- [ ] T028 [US4] Enhance LangfuseService in `apps/api/src/logging/langfuse.service.ts` — trace 생성 시 metadata (org_id, user_id) 포함, generation에 model/usage/input/output 기록, 스트리밍 완료 후 update generation
- [ ] T029 [US4] Enhance LoggingQueueProcessor — Langfuse 전송 시 langfuse_trace_id를 RequestLog에 역참조 저장

**Checkpoint**: Langfuse 통합 완료 (SC-003, SC-004)

---

## Phase 7: User Story 5 — 비동기 로깅 + User Story 6 — 보관 정책 (Priority: P3-P4)

**Goal**: BullMQ 성능 격리 검증 + 보관 기간 경과 로그 자동 정리

### Tests

- [ ] T030 [P] [US5] Test: 비동기 성능 격리 검증 테스트 in `apps/api/src/logging/request-logger.interceptor.spec.ts` — enqueue 후 즉시 응답 반환, 큐 지연이 응답 시간에 미영향 검증
- [ ] T031 [P] [US6] Test: LogRetentionService unit test in `apps/api/src/logging/log-retention.service.spec.ts` — 기본 90일 정리, Org별 커스텀 기간 정리, 배치 삭제 검증

### Implementation

- [ ] T032 [US6] Implement LogRetentionService in `apps/api/src/logging/log-retention.service.ts` — @Cron('0 3 * * *'), Organization.settings.logRetentionDays 조회, 기본 90일, 배치 삭제 (1000건 단위)

**Checkpoint**: 비동기 격리 + 보관 정리 완료 (SC-011, SC-012)

---

## Phase 8: Polish & Demo

**Purpose**: 데모 스크립트 + 통합 정리

- [ ] T033 Create demo data fixtures: seed RequestLog records for demo in `apps/api/src/logging/logging.seed.ts`
- [ ] T034 Create executable demo script `demos/F005-logging.sh` — 서버 시작, LLM 요청 전송, 로그 조회, 분석 API 호출 결과 출력, --ci 모드 지원
- [ ] T035 Run build + lint + test validation: `npm run build && npm run lint && npm test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 — 자동 로깅)**: Depends on Phase 2. MVP 핵심.
- **Phase 4 (US2 — 조회/검색)**: Depends on Phase 2. Phase 3과 독립 가능하나 테스트 데이터를 위해 순차 권장.
- **Phase 5 (US3 — 분석)**: Depends on Phase 2. LoggingService 확장이므로 Phase 4 이후 권장.
- **Phase 6 (US4 — Langfuse)**: Depends on Phase 2 (LangfuseService). Phase 3 이후.
- **Phase 7 (US5+US6 — 비동기+보관)**: Depends on Phase 2, 3.
- **Phase 8 (Demo)**: Depends on all phases

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- DTO/Entity before Service
- Service before Controller
- Controller before Integration

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup → Phase 2: Foundational
2. Phase 3: US1 (자동 로깅) — LLM 요청 시 RequestLog 자동 기록
3. **STOP and VALIDATE**: API Key로 LLM 요청 → GET /logs로 확인
4. Deploy/Demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (자동 로깅) → MVP 🎯
3. US2 (조회/검색) → 운영 활용 가능
4. US3 (분석) → 비즈니스 인사이트
5. US4 (Langfuse) → LLM observability
6. US5+US6 (비동기+보관) → 프로덕션 안정성
7. Demo → 최종 검증

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- TDD: 각 Story의 테스트를 먼저 작성하고 실패 확인 후 구현
- 총 태스크: 35개 (Setup 7, Foundation 4, US1 5, US2 5, US3 5, US4 3, US5+US6 3, Demo 3)
