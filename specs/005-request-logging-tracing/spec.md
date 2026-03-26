# Feature Specification: F005 — Request Logging & Tracing

**Feature Branch**: `005-request-logging-tracing`
**Created**: 2026-03-26
**Status**: Draft
**Input**: 모든 LLM 요청의 입출력, 토큰 수, 비용, 레이턴시를 로깅하고 테넌트/사용자별 비용 귀속을 추적한다. Langfuse 통합과 OpenTelemetry 기반 분산 트레이싱을 제공한다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — LLM 요청 자동 로깅 (Priority: P1)

플랫폼 운영자가 AEGIS 게이트웨이를 통해 LLM 요청이 처리될 때마다 해당 요청의 전체 메타데이터(모델, 프로바이더, 토큰 수, 비용, 레이턴시, 상태)가 자동으로 기록되기를 원한다. 로그는 테넌트와 사용자에 귀속되어, 누가 어떤 모델을 얼마나 사용했는지 추적할 수 있어야 한다. 스트리밍과 비스트리밍 요청 모두 정확하게 로깅되어야 한다.

**Why this priority**: 로깅 없이는 비용 귀속, 사용량 분석, 장애 진단이 불가능하다. 게이트웨이 운영의 핵심 기반.

**Independent Test**: API Key로 `POST /v1/chat/completions` 요청을 보내고, 로그 조회 API로 해당 요청의 로그가 모든 필수 필드와 함께 기록되었는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 인증된 사용자가 LLM 요청을 보낸 상태, **When** `POST /v1/chat/completions`에 `stream: false`로 요청을 보내고 성공 응답을 받으면, **Then** RequestLog에 `request_id`, `trace_id`, `tenant_id`, `user_id`, `model`, `provider`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `status: "success"` 필드가 모두 기록된다.

2. **Given** 인증된 사용자가 스트리밍 LLM 요청을 보낸 상태, **When** `POST /v1/chat/completions`에 `stream: true`로 요청을 보내고 전체 스트림이 완료되면, **Then** RequestLog에 스트림 전체의 누적 `input_tokens`, `output_tokens`, `cost_usd`가 정확히 기록되고, `latency_ms`는 첫 번째 청크부터 마지막 청크까지의 전체 시간을 반영한다.

3. **Given** LLM 요청이 프로바이더 에러로 실패한 상태, **When** 프로바이더가 4xx 또는 5xx 에러를 반환하면, **Then** RequestLog에 `status: "error"`와 에러 상세 정보가 기록되고, 부분적으로 전달된 토큰 수(스트리밍 중단 시)가 정확히 반영된다.

4. **Given** 동시에 여러 LLM 요청이 처리되는 상태, **When** 10건의 요청이 동시에 처리되면, **Then** 각 요청이 고유한 `request_id`와 `trace_id`로 독립적으로 로깅되고, 어떤 로그도 누락되지 않는다.

---

### User Story 2 — 로그 조회 및 검색 (Priority: P2)

조직 관리자가 대시보드(F007)에서 LLM 요청 로그를 조회하고, 특정 모델, 사용자, 기간, 상태별로 필터링하여 문제를 진단하거나 사용 패턴을 파악한다. 대량의 로그를 효율적으로 페이지네이션하여 탐색할 수 있어야 한다.

**Why this priority**: 로그가 기록되어도 검색/필터 없이는 운영상 활용 불가. F007 대시보드의 핵심 데이터 소스.

**Independent Test**: 여러 LLM 요청을 보낸 후, `GET /logs`에 다양한 필터(model, userId, status, 날짜 범위)를 적용하여 정확한 결과가 반환되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 다수의 RequestLog가 존재하는 상태, **When** `GET /logs?page=1&limit=20`으로 요청하면, **Then** 최신 순으로 정렬된 20건의 로그 목록과 `total`, `page`, `limit`, `totalPages` 메타데이터가 반환된다.

2. **Given** 다수의 RequestLog가 존재하는 상태, **When** `GET /logs?model=gpt-4o&status=success&startDate=2026-03-01&endDate=2026-03-31`로 필터링하면, **Then** 해당 조건에 매칭되는 로그만 반환된다.

3. **Given** 인증된 사용자가 Organization A에 속한 상태, **When** `GET /logs`를 호출하면, **Then** Organization A의 로그만 반환되고, 다른 Organization의 로그는 절대 포함되지 않는다 (테넌트 격리).

4. **Given** 특정 요청의 `request_id`를 알고 있는 상태, **When** `GET /logs/:id`로 상세 조회하면, **Then** 해당 요청의 전체 정보 — `input_masked`, `output_masked`, 토큰 상세, 비용, Langfuse trace link — 가 반환된다.

---

### User Story 3 — 사용량 및 비용 분석 (Priority: P2)

조직 관리자가 기간별(일/주/월), 모델별, 팀별, 사용자별 LLM 사용량과 비용을 분석하여 예산 계획과 최적화에 활용한다. 집계된 분석 데이터로 어떤 팀이 어떤 모델을 얼마나 사용하고 비용이 얼마인지 한눈에 파악할 수 있어야 한다.

**Why this priority**: 비용 귀속과 사용량 분석은 엔터프라이즈 AI 거버넌스의 핵심. F004 예산 관리와 연계되는 데이터 기반.

**Independent Test**: 여러 요청을 다른 모델/사용자로 보낸 후, `GET /analytics/usage`와 `GET /analytics/cost`에서 정확한 집계 결과를 확인한다.

**Acceptance Scenarios**:

1. **Given** 다수의 RequestLog가 존재하는 상태, **When** `GET /analytics/usage?groupBy=model&period=daily&startDate=2026-03-01&endDate=2026-03-07`로 요청하면, **Then** 모델별 일별 요청 수, 총 토큰 수가 집계되어 반환된다.

2. **Given** 다수의 RequestLog가 존재하는 상태, **When** `GET /analytics/cost?groupBy=team&period=monthly`로 요청하면, **Then** 팀별 월별 총 비용(`cost_usd`)이 집계되어 반환된다.

3. **Given** Organization A에 속한 관리자, **When** 사용량/비용 분석을 요청하면, **Then** Organization A의 데이터만 집계되고, 다른 Organization의 데이터는 포함되지 않는다.

---

### User Story 4 — Langfuse 통합 (Priority: P3)

플랫폼 운영자가 Langfuse 대시보드에서 LLM 요청의 품질(응답 품질, 레이턴시 분포, 에러율)을 분석한다. 각 LLM 요청은 Langfuse에 trace와 span(generation)으로 자동 기록되어, 요청 → 프로바이더 호출 → 응답의 전체 라이프사이클을 시각화할 수 있다.

**Why this priority**: Langfuse 통합은 LLM-specific observability의 핵심이지만, 기본 로깅과 분석이 먼저 동작해야 부가가치가 있다.

**Independent Test**: Langfuse 서버가 실행 중인 상태에서 LLM 요청을 보내고, Langfuse 대시보드에서 해당 trace와 generation이 올바른 메타데이터와 함께 표시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** Langfuse 서버가 구성된 상태, **When** LLM 요청이 처리되면, **Then** Langfuse에 trace가 생성되고, 하위에 generation span이 포함되며, `model`, `input`, `output`, `usage` (token counts), `metadata` (tenant_id, user_id)가 기록된다.

2. **Given** Langfuse 서버가 구성된 상태, **When** 스트리밍 LLM 요청이 완료되면, **Then** Langfuse generation에 전체 누적 토큰과 완성된 응답이 기록된다.

3. **Given** Langfuse 서버에 연결할 수 없는 상태, **When** LLM 요청이 처리되면, **Then** 요청 처리는 정상적으로 완료되고(Langfuse 장애가 요청 처리를 차단하지 않음), 로컬 RequestLog에는 정상 기록되며, Langfuse 전송 실패가 경고 로그로 기록된다.

---

### User Story 5 — 비동기 로깅 및 성능 격리 (Priority: P3)

플랫폼 운영자가 로깅 시스템이 LLM 요청의 응답 시간에 영향을 미치지 않기를 원한다. 로그 기록은 BullMQ 큐를 통해 비동기적으로 처리되어, 로깅 지연이나 실패가 사용자의 API 응답 시간을 증가시키지 않아야 한다.

**Why this priority**: 로깅이 응답 지연을 유발하면 게이트웨이의 핵심 가치가 훼손된다. 성능 격리는 프로덕션 안정성의 기반.

**Independent Test**: 로깅 큐를 의도적으로 느리게 만든 상태에서 LLM 요청의 응답 시간이 로깅 없을 때와 유사한지 확인한다.

**Acceptance Scenarios**:

1. **Given** BullMQ 로깅 큐가 정상 동작하는 상태, **When** LLM 요청이 처리되면, **Then** 로그 데이터가 큐에 즉시 enqueue되고, API 응답은 로그 DB 쓰기 완료를 기다리지 않고 반환된다.

2. **Given** 로깅 큐 처리가 지연되는 상태 (Redis 부하), **When** LLM 요청이 처리되면, **Then** API 응답 시간은 큐 지연의 영향을 받지 않고, 로그는 큐 복구 후 정상 기록된다.

3. **Given** 로깅 큐 워커가 처리 중 에러를 만난 상태, **When** 로그 기록이 실패하면, **Then** 실패한 로그 작업이 최대 3회 재시도되고, 재시도 실패 시 dead letter queue에 저장된다.

---

### User Story 6 — 로그 불변성 및 보관 정책 (Priority: P4)

컴플라이언스 담당자가 LLM 요청 로그가 변조 없이 보존되고, 보관 기간이 지난 로그는 자동으로 정리되기를 원한다. 로그는 append-only로 수정/삭제가 불가능하며, 테넌트별로 커스텀 보관 기간을 설정할 수 있다.

**Why this priority**: 컴플라이언스 요구사항이지만, 기본 로깅과 분석 기능이 먼저 동작해야 의미가 있다.

**Independent Test**: 로그 수정/삭제 시도 시 거부되는지 확인하고, 보관 기간이 지난 로그가 자동 정리되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 기록된 RequestLog가 존재하는 상태, **When** 로그 수정 또는 삭제를 시도하면 (UPDATE/DELETE SQL 또는 API), **Then** 작업이 거부되고 로그는 변경되지 않는다 (API 레벨에서 수정/삭제 엔드포인트 미제공).

2. **Given** 기본 보관 정책(90일)이 적용된 상태, **When** 90일이 경과한 로그가 존재하면, **Then** 정리 작업이 해당 로그를 자동 삭제한다.

3. **Given** Organization A에 커스텀 보관 기간(180일)이 설정된 상태, **When** 정리 작업이 실행되면, **Then** Organization A의 로그는 180일 기준으로 정리되고, 기본 정책의 다른 Organization 로그는 90일 기준으로 정리된다.

---

### Edge Cases

- 스트리밍 중간에 클라이언트가 연결을 끊은 경우: 부분 토큰까지의 로그가 정확히 기록되어야 한다
- 프로바이더가 토큰 사용량을 응답에 포함하지 않는 경우: 토크나이저 기반 추정값을 기록하고 `estimated: true` 플래그 설정
- 동일 요청에 대한 중복 로그 방지: `request_id` 기반 idempotency
- Langfuse 서버가 응답하지 않을 때: fire-and-forget 방식으로 요청 처리에 영향 없음
- 매우 긴 프롬프트/응답 (100K+ tokens): 로그에 저장할 input/output 최대 크기 제한 (기본 10KB, 전체는 별도 스토리지)
- BullMQ Redis 연결 끊김 시: 인메모리 폴백 버퍼링 후 재연결 시 flush

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 모든 LLM 요청(`POST /v1/chat/completions`)에 대해 RequestLog를 자동 생성해야 한다. 필수 기록 필드: `request_id`, `trace_id`, `tenant_id`, `user_id`, `model`, `provider`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `status`, `cache_hit`, `created_at`.
- **FR-002**: 시스템은 스트리밍 요청에 대해 전체 스트림 완료 후 누적 토큰 수와 비용을 정확히 계산하여 기록해야 한다. 스트림 중단 시 부분 토큰까지 정확히 반영해야 한다.
- **FR-003**: 시스템은 각 로그를 TenantContext 기반으로 `tenant_id`, `user_id`, `team_id`에 귀속시켜야 한다.
- **FR-004**: 시스템은 로그의 `input_masked`와 `output_masked` 필드에 프롬프트/응답 내용을 저장해야 한다. F006(Security Guardrails) 활성화 전에는 원본을 저장하고, F006 활성화 후에는 PII 마스킹된 버전을 저장해야 한다.
- **FR-005**: 시스템은 Langfuse SDK를 통해 LLM 요청을 trace + generation으로 자동 기록해야 한다. Langfuse가 미구성이거나 연결 불가 시에도 요청 처리가 차단되어서는 안 된다.
- **FR-006**: 시스템은 OpenTelemetry trace context를 전파하여 요청별 고유 `trace_id`를 부여하고, 외부 트레이싱 시스템과 연동 가능해야 한다.
- **FR-007**: 시스템은 `GET /logs` API로 로그 목록 조회를 제공해야 한다. 지원 필터: `model`, `provider`, `userId`, `teamId`, `status`, `startDate`, `endDate`, `minCost`, `maxCost`. 페이지네이션(`page`, `limit`) 및 최신순 정렬 지원.
- **FR-008**: 시스템은 `GET /logs/:id` API로 단건 로그 상세 조회를 제공해야 한다.
- **FR-009**: 시스템은 `GET /analytics/usage` API로 사용량 집계를 제공해야 한다. 지원: `groupBy` (model, team, user), `period` (daily, weekly, monthly), 날짜 범위 필터.
- **FR-010**: 시스템은 `GET /analytics/cost` API로 비용 집계를 제공해야 한다. 지원: `groupBy` (model, team, user), `period` (daily, weekly, monthly), 날짜 범위 필터.
- **FR-011**: 시스템은 로그 기록을 BullMQ 큐를 통해 비동기로 처리해야 한다. 로그 기록이 API 응답 시간에 영향을 미쳐서는 안 된다.
- **FR-012**: 시스템은 RequestLog에 대해 수정/삭제 API를 제공하지 않아야 한다 (append-only 불변성).
- **FR-013**: 시스템은 테넌트별 로그 보관 기간을 설정할 수 있어야 한다. 기본 보관 기간은 90일이며, Organization별로 커스텀 기간을 설정할 수 있다.
- **FR-014**: 시스템은 보관 기간이 경과한 로그를 자동으로 정리하는 스케줄 작업을 제공해야 한다.
- **FR-015**: 모든 로그 조회/분석 API는 AuthGuard와 TenantContext를 통해 테넌트 격리를 보장해야 한다. 사용자는 자신이 속한 Organization의 로그만 조회할 수 있다.

### Key Entities

- **RequestLog**: LLM 요청 로그 레코드. request_id, trace_id, tenant_id(org_id), user_id, team_id, model, provider, input_masked, output_masked, input_tokens, output_tokens, cost_usd, latency_ms, status, cache_hit, langfuse_trace_id, created_at. Append-only, 수정/삭제 불가.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `POST /v1/chat/completions` 비스트리밍 요청 시, RequestLog에 모든 필수 필드(request_id, trace_id, tenant_id, user_id, model, provider, input_tokens, output_tokens, cost_usd, latency_ms, status)가 기록된다.
- **SC-002**: `POST /v1/chat/completions` 스트리밍 요청 완료 시, RequestLog에 누적 `input_tokens`, `output_tokens`, `cost_usd`가 정확히 기록된다. 스트림 중단 시 부분 토큰이 반영된다.
- **SC-003**: Langfuse 서버가 구성된 상태에서 LLM 요청 시, Langfuse에 trace + generation이 생성되고 model, usage, metadata가 기록된다.
- **SC-004**: Langfuse 서버가 연결 불가인 상태에서 LLM 요청 시, 요청 처리가 정상 완료되고 로컬 RequestLog는 기록된다 (Langfuse 장애 격리).
- **SC-005**: `GET /logs?model=gpt-4o&status=success&page=1&limit=10` 요청 시, 필터 조건에 매칭되는 로그 목록과 페이지네이션 메타데이터가 반환된다.
- **SC-006**: `GET /logs/:id` 요청 시, 해당 요청의 전체 상세 정보(input_masked, output_masked, 토큰, 비용, Langfuse trace ID 포함)가 반환된다.
- **SC-007**: `GET /analytics/usage?groupBy=model&period=daily` 요청 시, 모델별 일별 요청 수와 토큰 합계가 반환된다.
- **SC-008**: `GET /analytics/cost?groupBy=team&period=monthly` 요청 시, 팀별 월별 비용 합계가 반환된다.
- **SC-009**: Organization A의 사용자가 `GET /logs`를 호출하면 Organization A의 로그만 반환되고, Organization B의 로그는 절대 포함되지 않는다.
- **SC-010**: RequestLog에 대한 수정/삭제 API가 존재하지 않으며, 직접 데이터 변경 시도가 API 레벨에서 차단된다.
- **SC-011**: LLM 요청 처리 시 로그 데이터가 BullMQ 큐에 enqueue되고, API 응답은 로그 DB 쓰기 완료를 기다리지 않고 즉시 반환된다.
- **SC-012**: 보관 기간(기본 90일)이 경과한 로그가 정리 작업에 의해 자동 삭제된다. 테넌트별 커스텀 보관 기간이 적용된다.
- **SC-013**: 프로바이더가 토큰 사용량을 응답에 포함하지 않는 경우, 시스템이 토크나이저 기반 추정값을 기록하고 RequestLog에 `estimated: true` 플래그가 설정된다.
- **SC-014**: 동일한 `request_id`를 가진 요청이 중복 로깅되지 않는다. 기존 로그가 존재하면 새 로그가 생성되지 않는다 (idempotency).
- **SC-015**: 100KB 이상의 입력/출력 콘텐츠에 대해 `input_masked`/`output_masked` 필드가 최대 10KB로 truncate되어 저장된다. 원본 전체 크기는 별도 필드에 기록된다.
- **SC-016**: BullMQ Redis 연결이 끊긴 상태에서 LLM 요청이 처리되면, 로그 데이터가 인메모리 버퍼에 임시 저장되고, Redis 재연결 시 버퍼의 로그가 큐로 flush되어 최종 기록된다.

## Assumptions

- Langfuse는 Docker Compose로 셀프호스팅된 인스턴스를 사용한다 (F001 인프라에 추가)
- F006(Security Guardrails) 구현 전까지 `input_masked`/`output_masked`에는 원본 텍스트가 저장된다
- 비용 계산은 F002 Model 엔티티의 `input_price_per_token`/`output_price_per_token`을 사용한다
- BullMQ는 기존 F001 Redis 인스턴스를 공유한다
- 로그 보관 정리 작업은 NestJS `@Cron` 스케줄러로 일 1회 실행한다
- 대용량 프롬프트/응답은 로그에 최대 10KB까지 저장하고, 초과분은 truncate한다
- Admin과 Member 역할의 사용자만 로그를 조회할 수 있다 (Viewer는 조회 불가)
