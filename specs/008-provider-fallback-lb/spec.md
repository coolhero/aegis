# Feature Specification: F008 — Provider Fallback & Load Balancing

**Feature Branch**: `008-provider-fallback-lb`
**Created**: 2026-03-27
**Status**: Draft
**Input**: 프로바이더 헬스체크, 자동 페일오버, 레이턴시 기반 라우팅, 서킷 브레이커, 최대 2-hop 폴백 제한

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 자동 페일오버 (Priority: P1)

플랫폼 운영자가 AEGIS를 통해 LLM 요청을 보낼 때, 기본 프로바이더(예: OpenAI)가 장애를 일으키면 시스템이 자동으로 다음 프로바이더(예: Anthropic)로 요청을 전환한다. 클라이언트는 장애를 인지하지 못하고 정상 응답을 받는다. 폴백 체인은 최대 2-hop으로 제한되며, 모든 프로바이더가 불가용하면 503 + Retry-After를 반환한다.

**Why this priority**: 프로바이더 장애 시 서비스 연속성이 핵심 가치. 이것이 없으면 단일 장애점(SPOF)이 된다.

**Independent Test**: OpenAI 프로바이더를 비활성화(또는 모킹) → LLM 요청 → Anthropic으로 자동 폴백 → 정상 응답 수신. 모든 프로바이더 비활성화 → 503 응답 확인.

**Acceptance Scenarios**:

1. **Given** OpenAI 프로바이더가 장애(503) 상태, **When** `POST /v1/chat/completions`에 `model: "gpt-4o"` 요청, **Then** 시스템이 Anthropic으로 자동 폴백하여 정상 응답 반환 + 응답 헤더 `X-Fallback-Provider: anthropic` 포함.
2. **Given** 폴백 체인 [OpenAI → Anthropic → 없음], **When** OpenAI + Anthropic 모두 장애, **Then** 503 응답 + `{ "error": "all_providers_unavailable" }` + `Retry-After: 30` 헤더.
3. **Given** 프로바이더 A→B→A 순환 설정 시도, **When** 시스템 기동 또는 설정 변경, **Then** 비순환 검증 실패 경고 + 순환 제거 후 적용.
4. **Given** 1-hop 폴백 성공, **When** 2번째 프로바이더도 장애, **Then** 3번째 프로바이더로 폴백하지 않음 (최대 2-hop) → 503 반환.

---

### User Story 2 — 서킷 브레이커 (Priority: P1)

시스템이 프로바이더별 서킷 브레이커를 유지하여, 연속 실패가 임계치를 초과하면 해당 프로바이더로의 요청을 차단(OPEN)한다. 타임아웃 후 반개방(HALF-OPEN) 상태에서 프로브 요청을 보내 복구를 확인하고, 성공하면 다시 허용(CLOSED)한다.

**Why this priority**: 서킷 브레이커 없이는 장애 프로바이더에 계속 요청 → 전체 레이턴시 증가 + 리소스 낭비. 페일오버의 전제 조건.

**Independent Test**: 프로바이더에 연속 5회 실패 주입 → 서킷 OPEN 확인 → 30초 대기 → HALF-OPEN → 성공 응답 → CLOSED 복귀.

**Acceptance Scenarios**:

1. **Given** 프로바이더가 CLOSED 상태, **When** 연속 5회 요청 실패 (5xx 또는 타임아웃), **Then** 서킷이 OPEN 상태로 전이 + 이후 해당 프로바이더로의 요청은 즉시 폴백으로 전환.
2. **Given** 서킷이 OPEN 상태, **When** 설정된 타임아웃(기본 30초) 경과, **Then** HALF-OPEN 상태로 전이 + 다음 1건의 요청을 해당 프로바이더로 시도(프로브).
3. **Given** HALF-OPEN 상태에서 프로브 요청, **When** 프로바이더가 성공 응답, **Then** CLOSED 상태 복귀 + 이후 요청을 정상적으로 해당 프로바이더로 라우팅.
4. **Given** HALF-OPEN 상태에서 프로브 요청, **When** 프로바이더가 실패 응답, **Then** OPEN 상태로 복귀 + 타임아웃 재시작.
5. **Given** 서킷 상태 변경, **When** 상태가 전이될 때마다, **Then** 로그에 상태 전이 이벤트 기록 (provider, from, to, timestamp, reason).

---

### User Story 3 — 프로바이더 헬스 상태 조회 (Priority: P2)

플랫폼 운영자가 `GET /providers/health` API를 통해 모든 프로바이더의 현재 상태(CLOSED/OPEN/HALF-OPEN), 평균 레이턴시, 최근 에러율을 확인한다. 대시보드(F007)에서 이 데이터를 시각화할 수 있다.

**Why this priority**: 운영 가시성. 장애 상황에서 어떤 프로바이더가 문제인지 파악 필수. 하지만 핵심 폴백 로직(US1, US2) 이후.

**Independent Test**: `GET /providers/health` 호출 → 프로바이더별 상태, 레이턴시, 에러율 JSON 응답 확인.

**Acceptance Scenarios**:

1. **Given** 인증된 사용자, **When** `GET /providers/health`, **Then** 모든 프로바이더의 `{ name, type, circuit_state, avg_latency_ms, error_rate, last_check_at, enabled }` 배열 반환.
2. **Given** 한 프로바이더가 OPEN 상태, **When** 헬스 조회, **Then** 해당 프로바이더의 `circuit_state: "OPEN"`, `error_rate > 0`.
3. **Given** 요청자가 인증되지 않은 상태, **When** `GET /providers/health`, **Then** 401 Unauthorized.

---

### User Story 4 — 레이턴시 기반 라우팅 (Priority: P3)

동일 모델을 제공하는 여러 프로바이더가 있을 때, 시스템이 최근 평균 레이턴시가 가장 낮은 프로바이더를 우선 선택한다. 가중치 설정으로 특정 프로바이더의 우선순위를 조정할 수도 있다.

**Why this priority**: 성능 최적화. 핵심 기능(폴백, 서킷 브레이커) 이후의 부가 가치.

**Independent Test**: 두 프로바이더(A: 100ms, B: 200ms 평균)가 동일 모델 제공 → 요청 시 A 우선 선택 → B의 가중치를 2배로 설정 → B가 더 많이 선택됨.

**Acceptance Scenarios**:

1. **Given** Provider A (avg 100ms), Provider B (avg 200ms) 동일 모델, **When** 요청 10건, **Then** 대부분 Provider A로 라우팅 (레이턴시 우선).
2. **Given** Provider A (weight 1), Provider B (weight 3), **When** 요청 100건, **Then** B가 약 75%, A가 약 25% (가중치 비율).
3. **Given** 레이턴시 측정 윈도우 5분, **When** Provider A의 레이턴시가 500ms로 증가, **Then** 5분 이내에 Provider B로 라우팅 전환.

---

### Edge Cases

- 프로바이더가 1개뿐일 때 장애 → 서킷 OPEN + 즉시 503 (폴백 대상 없음)
- HALF-OPEN 프로브와 일반 요청이 동시 도착 → 프로브만 해당 프로바이더로, 일반 요청은 폴백으로
- 모든 프로바이더 서킷 OPEN → 503 + Retry-After (가장 빠른 HALF-OPEN 예상 시간)
- 스트리밍 요청 중 프로바이더 장애 → 중간 폴백 불가 (이미 스트림 시작), 에러 이벤트로 종료
- Redis 장애 시 서킷 상태 → 인메모리 폴백 (degraded mode)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 프로바이더별 서킷 브레이커를 유지해야 한다. 상태: CLOSED (정상), OPEN (차단), HALF-OPEN (프로브). 상태 전이: 연속 N회 실패 → OPEN, 타임아웃 후 → HALF-OPEN, 프로브 성공 → CLOSED.
- **FR-002**: 시스템은 기본 프로바이더 장애 시 폴백 체인에 따라 자동으로 다음 프로바이더로 요청을 전환해야 한다. 최대 2-hop 제한.
- **FR-003**: 시스템은 폴백 체인의 비순환(acyclic)을 보장해야 한다. 순환 감지 시 설정 거부 또는 경고.
- **FR-004**: 시스템은 모든 프로바이더가 불가용할 때 503 응답 + `Retry-After` 헤더를 반환해야 한다.
- **FR-005**: 시스템은 `GET /providers/health` API를 제공하여 프로바이더별 서킷 상태, 평균 레이턴시, 에러율을 반환해야 한다.
- **FR-006**: 시스템은 레이턴시 기반 라우팅을 지원해야 한다. 최근 N분 평균 레이턴시가 낮은 프로바이더 우선 선택.
- **FR-007**: 시스템은 가중 라운드로빈을 지원해야 한다. 프로바이더별 가중치(weight) 필드 사용.
- **FR-008**: 시스템은 서킷 상태 전이 시 이벤트를 로깅해야 한다 (provider, from_state, to_state, reason, timestamp).
- **FR-009**: 시스템은 폴백 발생 시 응답 헤더 `X-Fallback-Provider`로 실제 처리한 프로바이더를 알려야 한다.
- **FR-010**: 시스템은 Redis 장애 시 인메모리 서킷 상태로 degraded mode 동작해야 한다.

### Key Entities

- **ProviderHealth** (F002 Provider 엔티티 확장): circuit_state (CLOSED/OPEN/HALF-OPEN), failure_count, last_failure_at, avg_latency_ms, error_rate, recovery_timeout, weight
- **FallbackChain** (설정): 모델별 프로바이더 우선순위 리스트

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 프로바이더에 연속 5회 실패 발생 시 서킷이 CLOSED→OPEN으로 전이되고, 이후 해당 프로바이더로의 요청이 즉시 폴백으로 전환된다.
- **SC-002**: 서킷 OPEN 상태에서 30초 타임아웃 후 HALF-OPEN 전이 → 프로브 요청 1건을 해당 프로바이더로 시도한다.
- **SC-003**: HALF-OPEN 프로브 성공 시 CLOSED 복귀, 실패 시 OPEN 복귀 + 타임아웃 재시작.
- **SC-004**: 기본 프로바이더 장애 시 폴백 프로바이더로 자동 전환 → 클라이언트는 정상 응답 + `X-Fallback-Provider` 헤더 수신.
- **SC-005**: 폴백 체인 소진(2-hop 초과 또는 모든 프로바이더 OPEN) 시 503 + `Retry-After` 헤더 반환.
- **SC-006**: `GET /providers/health`가 프로바이더별 circuit_state, avg_latency_ms, error_rate, last_check_at을 포함한 JSON 배열 반환.
- **SC-007**: 레이턴시가 낮은 프로바이더가 우선 선택되며, 가중치 설정 시 가중치 비율에 따라 트래픽이 분산된다.
- **SC-008**: 서킷 상태 전이 시 로그에 이벤트가 기록된다 (provider, from_state, to_state, reason).

## Assumptions

- F002의 Provider, Model 엔티티와 ProviderAdapter 인터페이스가 구현 완료 상태.
- 서킷 브레이커 상태는 Redis에 저장 (멀티 인스턴스 동기화). Redis 장애 시 인메모리 폴백.
- 폴백 체인은 모델별로 설정 가능 (기본: Provider 테이블의 enabled + weight 기반).
- 서킷 브레이커 파라미터: failure_threshold=5, recovery_timeout=30s (설정 가능).
- 레이턴시 측정 윈도우: 최근 5분 (설정 가능).
- 스트리밍 중 폴백은 불가 — 스트림 시작 후 장애 시 에러 이벤트로 종료.
