# Feature Specification: Token Budget Management

**Feature Branch**: `004-token-budget`
**Created**: 2026-03-26
**Status**: Draft (re-specified)
**Input**: User description: "Hierarchical budget (Org>Team>User), token+cost dual tracking, Redis atomic ops, alerts"
**Re-specified**: 2026-03-26 — Domain rule compliance 강화, SC/US 일관성 수정, 누락 edge case 보완

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 예산 설정 및 배분 (Priority: P1)

조직 관리자(Org Admin)가 Org 전체의 월간 토큰/비용 예산을 설정하고, Team별·User별로 예산을 배분한다. 이를 통해 LLM 사용을 계층적으로 통제한다.

**Why this priority**: 예산 설정 없이는 차감·차단·알림 모두 불가능. 전체 기능의 전제 조건.

**Independent Test**: Org Admin이 API로 Org 예산 설정 → Team 예산 배분 → User 예산 배분 → 각 레벨 예산 조회 확인

**Acceptance Scenarios**:

1. **Given** 인증된 Org Admin, **When** `PUT /budgets/org/:orgId`로 월간 예산 1,000,000 토큰 / $100 설정, **Then** 200 응답 + Budget 엔티티 생성, 현재 기간(BudgetPeriod) 자동 생성, 사용량 0
2. **Given** Org 예산 설정 완료, **When** `PUT /budgets/team/:teamId`로 Team A에 600,000 토큰 / $60 배분, **Then** 200 응답 + Team Budget 생성
3. **Given** Team 예산 설정 완료, **When** `PUT /budgets/user/:userId`로 User에 100,000 토큰 / $10 배분, **Then** 200 응답 + User Budget 생성
4. **Given** 예산이 설정된 상태, **When** `GET /budgets/org/:orgId` 조회, **Then** 총 예산, 현재 사용량, 잔여량, 사용률(%) 반환
5. **Given** 일반 사용자(MEMBER), **When** `PUT /budgets/org/:orgId` 시도, **Then** 403 Forbidden (RBAC 적용)

---

### User Story 2 - LLM 요청 시 예산 검증 및 차감 (Priority: P1)

사용자가 `/v1/chat/completions` 요청 시, BudgetGuard가 계층 전체(User→Team→Org)의 예산을 원자적으로 검증하고 예약(reservation)한다. 요청 완료 후 프로바이더 실제 usage로 정산(reconciliation)한다.

**Why this priority**: 예산 설정과 함께 핵심. 차감/차단 없으면 예산이 무의미.

**Independent Test**: 예산 설정 → LLM 요청 → 예약 → 완료 → 정산 → 잔여 예산 정확 반영 확인

**Acceptance Scenarios**:

1. **Given** User 잔여 50,000 토큰, **When** 추정 3,000 토큰 요청, **Then** 3,000 토큰 예약 → 요청 실행 → 프로바이더 실제 2,500 토큰 → 500 해제 → 잔여 47,500
2. **Given** User 잔여 1,000 토큰, **When** 추정 3,000 토큰 요청, **Then** 429 응답 + `{ error: "budget_exceeded", level: "user", remaining_tokens: 1000 }`
3. **Given** User 충분 but Team 잔여 500 토큰, **When** 추정 3,000 토큰 요청, **Then** 429 응답 + `{ error: "budget_exceeded", level: "team" }`
4. **Given** 예약 후 프로바이더 오류(500), **When** 요청 실패, **Then** 예약된 3,000 토큰 전액 해제, UsageRecord 상태 `released`
5. **Given** 동시 100개 요청, 잔여 예산 50개 요청분, **When** 100개 동시 도착, **Then** 총 차감량 ≤ 예산 + 단일 요청 마진 (원자적 처리)

---

### User Story 3 - 예산 알림 (Priority: P2)

예산 사용률이 임계값(기본: 80%, 90%, 100%)에 도달하면 웹훅으로 알림을 전달한다.

**Why this priority**: 예산 소진 전 사전 대응을 위한 운영 기능. 핵심 차감/차단 이후 구현 가능.

**Independent Test**: 예산 80% 사용 → 웹훅 알림 수신 확인 → 90% → 추가 알림 → 100% → 최종 알림

**Acceptance Scenarios**:

1. **Given** Org 예산 사용률 79%, **When** 요청 처리 후 81%, **Then** 80% 임계값 웹훅 알림 발생 (Org Admin 대상)
2. **Given** Team 예산 사용률 89%, **When** 요청 처리 후 92%, **Then** 90% 임계값 웹훅 알림 발생
3. **Given** 80% 알림 이미 발생, **When** 여전히 80~89%, **Then** 동일 기간 내 중복 알림 없음
4. **Given** 알림 웹훅 URL 설정, **When** 임계값 도달, **Then** POST webhook with `{ budget_id, level, threshold, usage_pct, period }`

---

### User Story 4 - 예산 자동 초기화 (Priority: P2)

설정된 주기(기본: 월간)에 따라 예산이 자동 초기화되어 새 기간이 시작된다.

**Why this priority**: 연속 운영 필수. 단, 수동 초기화로 MVP 운영 가능.

**Independent Test**: 월간 예산 → 기간 종료 → 자동 초기화 → 새 기간 사용량 0 → 이전 기록 보존

**Acceptance Scenarios**:

1. **Given** 월간 초기화 설정, **When** 매월 1일 00:00 UTC 도달, **Then** 새 BudgetPeriod 생성, 사용량 0, 이전 기간 보존
2. **Given** 초기화 시점에 진행 중인 LLM 요청, **When** 초기화 실행, **Then** 진행 중 요청은 원래 기간에 정산 (period_id 기반)
3. **Given** 이전 기간 미사용 예산, **When** 초기화, **Then** 미사용분 이월 없음 (zero-carryover)

---

### User Story 5 - 예산 사용 현황 조회 (Priority: P3)

관리자와 사용자가 예산 사용 현황을 조회한다. RBAC에 따라 범위가 제한된다.

**Why this priority**: 운영 가시성. F007 Admin Dashboard와 연계.

**Independent Test**: 관리자가 Org 전체 사용 현황 조회 → 팀별 → 사용자별 drill-down

**Acceptance Scenarios**:

1. **Given** Org Admin, **When** `GET /usage/org/:orgId`, **Then** Org/Team/User 계층별 사용량·잔여량·사용률 반환
2. **Given** 일반 사용자, **When** `GET /usage/user/:userId`, **Then** 자신의 사용량만 반환 (타인 정보 비노출)
3. **Given** 이전 기간 데이터 존재, **When** `GET /usage/summary?period=2026-02`, **Then** 해당 기간 사용 현황 반환

---

### User Story 6 - 모델 티어별 예산 관리 (Priority: P2)

조직 관리자가 LLM 모델을 비용 등급(premium/standard/economy)으로 그룹화하고, 각 등급별로 별도의 예산 한도를 설정한다. 이를 통해 비싼 모델(GPT-4o, Claude Opus)의 사용량을 제한하면서, 저렴한 모델(GPT-3.5, Claude Haiku)은 여유롭게 사용할 수 있다.

**Why this priority**: 모델별 토큰당 비용 차이가 10~100배. 전체 예산만으로는 비싼 모델 남용을 방지할 수 없음. 단, 기본 계층 예산이 먼저 구현되어야 함.

**Independent Test**: premium 티어 생성 → GPT-4o 할당 → premium 예산 $30 설정 → GPT-4o 요청 → premium 예산 차감 확인 → premium 소진 시 GPT-4o 429 but GPT-3.5 허용

**Acceptance Scenarios**:

1. **Given** Org Admin, **When** `POST /model-tiers`로 premium 티어 생성 + GPT-4o·Claude Opus 할당, **Then** 201 + ModelTier 생성
2. **Given** premium 티어 존재, **When** `PUT /budgets/user/:userId`로 `model_tier_id: <premium-id>`, token_limit: 50000 설정, **Then** 200 + 티어별 Budget 생성
3. **Given** User에 전체 예산 200,000 + premium 예산 50,000, **When** GPT-4o(premium) 요청, **Then** premium 예산 + 전체 예산 동시 차감
4. **Given** premium 예산 소진 + 전체 예산 잔여, **When** GPT-4o 요청, **Then** 429 + `level: "user", tier: "premium"`
5. **Given** premium 예산 소진 + 전체 예산 잔여, **When** GPT-3.5(standard) 요청, **Then** 200 성공 (premium 예산 미적용)

---

### Edge Cases

- **예산 미설정 엔티티의 LLM 요청**: 예산 미설정 시 무제한(unlimited) 취급. 단, 상위 레벨 예산이 있으면 그 범위 내 운영
- **스트리밍 응답 토큰 카운트**: 프로바이더 최종 `usage` 필드를 기준으로 정산. 실시간 chunk 카운팅은 표시용 (TB-003 대응)
- **기간 중 예산 변경**: 현재 기간에 즉시 반영. 이미 사용된 금액 유지, 잔여분만 조정
- **팀/사용자 예산 합계 > 상위 예산**: 설정 시 경고 but 차단하지 않음(over-subscription 허용). 런타임에 상위 레벨 검사로 차단
- **사용자 팀 이동**: 이전 팀 사용 기록 유지. 새 팀에서 새 예산, 사용량 0
- **동시 요청 경합(race condition)**: 원자적 check-and-reserve로 처리 (Redis Lua script) (TB-001 대응)
- **재시도 이중 과금**: 멱등성 키(idempotency key)로 동일 논리 요청의 재시도는 동일 예약 재사용 (TB-002 대응)
- **예산 초기화 중 진행 요청**: 요청 시작 시 기록된 period_id로 원래 기간에 정산 (TB-004 대응)
- **Redis 비가용 시 예산 체크**: Redis 연결 실패 시 요청 거부(fail-closed). 예산 우회 허용하지 않음. 503 Service Unavailable 반환
- **웹훅 전달 실패**: 최대 3회 재시도(exponential backoff). 최종 실패 시 AlertRecord에 `webhook_status: failed` 기록. 알림 실패가 예산 차단에 영향 없음
- **비용 계산 시 소수점 정밀도**: USD 비용은 소수점 6자리까지 추적 (마이크로달러 수준). 누적 시 반올림 오차 방지
- **모델이 어떤 티어에도 속하지 않을 때**: 티어별 예산 미적용, 전체(global) 예산만 차감. 티어 미할당 모델은 자유롭게 사용 가능
- **모델이 여러 티어에 중복 할당**: 허용하지 않음 (1 모델 = 최대 1 티어). 설정 시 409 Conflict
- **티어 삭제 시 기존 예산**: 해당 티어의 Budget은 비활성화(enabled=false). 진행 중 요청은 원래 예산에서 정산
- **새 모델 추가 시 티어 할당**: 수동 할당 필요. 미할당 모델은 global 예산만 적용

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 Org > Team > User 3계층 예산 구조를 지원해야 한다. 각 레벨에서 독립 설정 가능
- **FR-002**: 각 예산은 토큰 수(input+output 합산)와 비용(USD) 두 지표를 동시 추적해야 한다. 둘 중 하나 한도 도달 시 차단
- **FR-003**: LLM 요청 전 BudgetGuard가 계층 전체(User→Team→Org 순)를 원자적으로 검증해야 한다. 최하위 레벨부터 검사하여 가장 제한적인 레벨에서 먼저 차단
- **FR-004**: 예산 검증과 예약(reservation)은 원자적으로 처리해야 한다. 동시 요청 간 경합 조건 방지 (Redis Lua script)
- **FR-005**: 요청 완료 후 프로바이더 반환 실제 토큰 사용량으로 정산(reconciliation)해야 한다. reservation 해시에 저장된 Redis 키 경로(user/team/org key prefix)를 사용하여 해당 레벨의 Redis 카운터를 (실제값 - 추정값) 차이만큼 보정해야 한다
- **FR-006**: 요청 실패 시 예약된 토큰 전액 해제해야 한다. 실패 요청에 과금 금지
- **FR-007**: 예산 사용률 임계값(기본: 80%, 90%, 100%) 도달 시 웹훅 알림을 발생해야 한다
- **FR-008**: 동일 기간 내 동일 임계값 중복 알림을 방지해야 한다 (AlertRecord로 추적)
- **FR-009**: 설정된 주기(기본: 월간)에 따라 예산을 자동 초기화해야 한다. 이전 기간 기록 보존
- **FR-010**: 초기화 시점 진행 중 요청은 원래 기간에 정산해야 한다 (period_id 기반 추적)
- **FR-011**: 관리자는 계층별 예산 사용 현황을 조회할 수 있어야 한다. RBAC 적용 (Admin: 전체, Member: 자신만)
- **FR-012**: 비용 계산은 Model 엔티티의 `input_price_per_token`, `output_price_per_token`을 기반으로 input/output 분리 계산해야 한다
- **FR-013**: 예산 미설정 엔티티는 무제한(unlimited) 취급한다. 상위 레벨 예산이 있으면 그 범위 내 운영
- **FR-014**: 재시도 시 멱등성 키(idempotency key)로 동일 논리 요청의 이중 과금을 방지해야 한다
- **FR-015**: Redis 비가용 시 예산 체크는 fail-closed 정책으로 요청을 거부해야 한다 (503 반환). 예산 우회 허용 불가
- **FR-016**: 토큰 예약(reservation)은 요청 전 pessimistic estimation으로 수행해야 한다. 추정 항목: (1) input tokens — 메시지 content 길이를 보수적 비율(~3 chars/token, 한국어 대응)로 계산 + 메시지당 overhead ~4 tokens(role/delimiter), (2) output tokens — `max_tokens` 파라미터 사용, 미지정 시 모델별 기본값(기본 256). 정산은 프로바이더 최종 `usage` 필드(input_tokens + output_tokens 실제값)로 수행해야 한다
- **FR-017**: 웹훅 알림 전달 실패 시 최대 3회 재시도(exponential backoff)하고, 최종 실패 시 AlertRecord에 실패 상태를 기록해야 한다
- **FR-018**: 시스템은 조직별 모델 티어(ModelTier)를 정의할 수 있어야 한다. 티어는 이름(premium/standard/economy 등)과 소속 모델 목록으로 구성
- **FR-019**: 각 Budget에 선택적 `model_tier_id`를 지정할 수 있어야 한다. 미지정(NULL) 시 전체 모델 대상(global), 지정 시 해당 티어 모델에만 적용
- **FR-020**: LLM 요청 시 BudgetGuard는 모델의 티어를 확인하고, 티어별 예산 + 전체(global) 예산을 동시에 검증해야 한다. 둘 중 하나라도 초과 시 차단
- **FR-021**: 모델 티어 CRUD API를 제공해야 한다 (`POST /model-tiers`, `GET /model-tiers`, `PUT /model-tiers/:id`, `DELETE /model-tiers/:id`). Admin 전용
- **FR-022**: Budget의 Unique Constraint를 `(level, target_id, model_tier_id)`로 확장하여 동일 엔티티에 전체 예산 + 티어별 예산을 각각 설정할 수 있어야 한다

### Key Entities

- **Budget**: 특정 계층(org/team/user)의 예산 정의. 토큰 한도, 비용 한도(USD), 소프트/하드 한도 비율, 초기화 주기, 대상 엔티티 ID. Org/Team/User와 1:1 관계
- **BudgetPeriod**: Budget의 시간 구간. 시작일, 종료일, 해당 기간 사용량(토큰/비용). 초기화 시 새 기간 생성, 이전 보존
- **UsageRecord**: 개별 LLM 요청의 토큰 사용 기록. Budget·Period 참조, input/output 토큰, 비용, 예약/정산 상태(reserved/reconciled/released)
- **AlertRecord**: 발생한 예산 알림 기록. Budget·Period·임계값·발생 시각. 중복 방지용
- **ModelTier**: 조직별 모델 등급 정의. 이름(premium/standard/economy), 설명, 소속 조직. Org와 N:1 관계
- **ModelTierMember**: 모델 티어 소속 모델 매핑. ModelTier와 Model의 N:M 중간 테이블 (1 모델 = 최대 1 티어)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `PUT /budgets/org/:orgId`로 Org 예산 설정 → 200 응답 + Budget 엔티티 생성 + BudgetPeriod 자동 생성 확인
- **SC-002**: `PUT /budgets/team/:teamId`, `PUT /budgets/user/:userId`로 하위 계층 예산 설정 → 200 응답 + Budget 생성 확인
- **SC-003**: 충분한 예산 + `POST /v1/chat/completions` → 200 응답 + UsageRecord 생성 + reservation(추정값) 후 reconciliation(실제값) 완료 시 잔여 예산 정확 반영 확인
- **SC-004**: 부족한 예산 + `POST /v1/chat/completions` → 429 응답 + `budget_exceeded` 에러 + 차단 레벨(user/team/org) 명시
- **SC-005**: User 충분 but Team 소진 → 429 + `level: "team"` 확인 (계층 검증 순서 User→Team→Org)
- **SC-006**: 동시 100개 요청이 예산 경계 도달 시 총 차감량 ≤ 예산 + 1 요청 마진 (원자성 검증)
- **SC-007**: 프로바이더 오류로 요청 실패 시 예약된 토큰 전액 해제 + UsageRecord 상태 `released` 확인
- **SC-008**: 예산 사용률 80% 도달 시 60초 이내 웹훅 알림 전달 확인
- **SC-009**: 동일 기간 내 80% 알림 후 재차 80~89% 범위 → 중복 알림 없음 확인
- **SC-010**: 월간 초기화 → 새 BudgetPeriod 생성 + 사용량 0 + 이전 기간 보존 확인
- **SC-011**: `GET /budgets/org/:orgId` → Org/Team/User 계층 사용량·잔여량·사용률 반환 확인
- **SC-012**: MEMBER 사용자가 `PUT /budgets/org/:orgId` 시도 → 403 반환 확인
- **SC-013**: Redis 연결 실패 상태에서 `POST /v1/chat/completions` → 503 Service Unavailable 반환 확인 (fail-closed)
- **SC-014**: LLM 응답 완료 후 프로바이더 `usage` 필드 기준 정산 → (1) 추정값에 output tokens + message overhead가 포함되어 있는지 확인, (2) reconciliation이 Redis 카운터(user/team/org 각 레벨)를 (실제값 - 추정값) 차이만큼 실제 보정하는지 확인, (3) 보정 후 잔여 예산이 실제 사용량 기준으로 정확한지 확인
- **SC-015**: 웹훅 알림 전달 실패(타임아웃/4xx/5xx) → 최대 3회 재시도 후 AlertRecord에 `webhook_status: failed` 기록 확인
- **SC-016**: `POST /model-tiers`로 premium 티어 생성 + GPT-4o 모델 할당 → 201 + ModelTier 엔티티 생성 확인
- **SC-017**: User에 전체 예산 200,000 토큰 + premium 예산 50,000 토큰 설정 → 두 Budget이 독립 존재 확인
- **SC-018**: premium 모델(GPT-4o) 요청 시 premium 예산 + 전체 예산 동시 차감 확인
- **SC-019**: premium 예산 소진 + 전체 예산 잔여 → premium 모델 요청 429 + `tier: "premium"`, standard 모델 요청 200 성공
- **SC-020**: 모델 티어에 속하지 않는 모델 요청 시 전체(global) 예산만 차감 확인

## Assumptions

- F003 Auth & Multi-tenancy의 Org > Team > User 계층 구조와 RBAC (Admin/Member/Viewer)가 구현됨
- F002 LLM Gateway Core의 프로바이더 응답에 `usage` 필드(input/output 토큰)가 포함됨
- F002 Model 엔티티에 `input_price_per_token`, `output_price_per_token` 필드가 있어 비용 계산 기준으로 사용
- Redis가 인프라에 구성됨 (F001 Foundation에서 Docker Compose 설정 완료)
- 비용 단가는 Model 엔티티에 사전 등록됨 (프로바이더 API 자동 조회는 범위 밖)
- 예산 초기화 기본 주기는 월간(monthly). 일간/주간 커스텀 주기는 v2 범위
- 미사용 예산 이월(carryover) 없음 (zero-carryover 기본 정책)
- 알림 전달은 웹훅까지. 이메일/Slack 등 외부 서비스 연동은 웹훅 소비자 책임
- 토큰 추정은 pessimistic reservation 방식: input(content/3 + overhead 4/msg) + output(max_tokens 또는 기본 256). tiktoken 수준 정밀도는 v2. reconciliation이 실제값으로 보정하므로 추정 오차는 허용
