# Feature Specification: F010 — Prompt Management

**Feature Branch**: `010-prompt-management`
**Created**: 2026-03-27
**Status**: Draft
**Input**: Git 스타일 프롬프트 버전 관리, 변수 치환 템플릿 시스템, 트래픽 분할 기반 A/B 테스팅을 제공하는 프롬프트 관리 플랫폼

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 프롬프트 템플릿 생성 및 버전 관리 (Priority: P1)

프롬프트 엔지니어가 LLM 호출에 사용할 프롬프트 템플릿을 생성하고, 수정할 때마다 새 버전이 자동으로 기록된다. 각 버전은 변경 사유(change_note)와 함께 이력에 남으며, 문제가 발생하면 이전 버전으로 즉시 롤백할 수 있다. 프롬프트는 draft → published → archived 라이프사이클을 따른다.

**Why this priority**: 프롬프트 버전 관리는 모든 하위 기능(A/B 테스트, 해결 로직)의 전제 조건. 이것 없이는 다른 기능이 무의미.

**Independent Test**: 프롬프트 생성 → 수정(v2) → 배포 → 문제 발견 → v1 롤백 → 정상 동작 확인.

**Acceptance Scenarios**:

1. **Given** 인증된 admin 사용자, **When** `POST /prompts`에 `{ name, description, content }` 전송, **Then** 프롬프트 생성 + 초기 버전(v1) 자동 생성 + `status: 'draft'` + 201 응답.
2. **Given** 기존 프롬프트(id=1), **When** `PUT /prompts/1`에 새 content + change_note 전송, **Then** 새 버전(v2) 자동 생성 + `version_number` 자동 증가 + 기존 버전 보존.
3. **Given** 프롬프트(id=1)에 v1, v2, v3 존재, **When** `GET /prompts/1/versions`, **Then** 모든 버전 목록 반환 (version_number, content, change_note, created_by, created_at).
4. **Given** 프롬프트(id=1)의 active_version이 v3, **When** `POST /prompts/1/rollback { target_version: 1 }`, **Then** active_version이 v1으로 변경 + 활성 A/B 테스트 자동 종료 + status 유지.
5. **Given** 프롬프트(id=1)이 draft 상태, **When** `POST /prompts/1/publish { version: 2 }`, **Then** active_version = v2 + `status: 'published'`.
6. **Given** 프롬프트(id=1), **When** `DELETE /prompts/1`, **Then** 프롬프트 + 관련 버전 + A/B 테스트 데이터 cascade 삭제.
7. **Given** 인증된 사용자, **When** `GET /prompts`, **Then** 해당 org의 프롬프트 목록 (name, status, active_version, created_at) + 페이지네이션.

---

### User Story 2 — 변수 치환 템플릿 시스템 (Priority: P1)

개발자가 `{{variable}}` 패턴으로 변수를 포함한 프롬프트 템플릿을 작성하면, 런타임에 실제 값으로 치환된다. 변수에 기본값을 지정할 수 있고(`{{name|default_value}}`), 필수 변수가 누락되면 명확한 에러 메시지를 반환한다.

**Why this priority**: 변수 치환은 프롬프트 재사용성의 핵심. 정적 프롬프트만으로는 동적 컨텍스트 주입이 불가.

**Independent Test**: 변수 포함 프롬프트 생성 → 변수 값 전달하여 해결 → 치환 결과 확인. 필수 변수 누락 → 에러 확인.

**Acceptance Scenarios**:

1. **Given** 프롬프트 content = `"{{role}}님, {{topic}}에 대해 설명해주세요"`, **When** 해결 요청 `{ variables: { role: "전문가", topic: "AI 보안" } }`, **Then** `"전문가님, AI 보안에 대해 설명해주세요"` 반환.
2. **Given** 프롬프트에 `{{lang|한국어}}` 기본값 변수, **When** 해결 요청 시 `lang` 미전달, **Then** 기본값 `"한국어"`로 치환.
3. **Given** 프롬프트에 `{{name}}` 필수 변수, **When** 해결 요청 시 `name` 미전달, **Then** 400 + `{ error: "missing_variables", details: ["name"] }`.
4. **Given** 프롬프트 생성/수정 시, **When** content에서 `{{variable}}` 패턴 파싱, **Then** `variables` 필드에 변수 목록 자동 추출 (name, required, default_value).

---

### User Story 3 — A/B 테스팅 (Priority: P2)

팀 리더가 프롬프트의 여러 변형을 정의하고 트래픽 분할 비율을 설정하여, LLM 요청 시 확률적으로 다른 프롬프트 변형이 선택된다. 각 변형의 호출 수와 성과(토큰 사용량)를 추적하여 최적 프롬프트를 결정한다.

**Why this priority**: A/B 테스트는 프롬프트 최적화의 핵심이지만, 기본 버전 관리와 변수 치환이 선행되어야 함.

**Independent Test**: A/B 테스트 설정 → 100회 해결 요청 → 분할 비율에 근사한 변형 선택 분포 확인 → 통계 조회.

**Acceptance Scenarios**:

1. **Given** published 프롬프트(id=1), **When** `POST /prompts/1/ab-test { variants: [{ version_id: 2, weight: 70 }, { version_id: 3, weight: 30 }] }`, **Then** A/B 테스트 활성화 + 변형 등록. 가중치 합계 = 100 검증.
2. **Given** 활성 A/B 테스트(70:30), **When** 프롬프트 해결 100회 요청, **Then** 변형 선택이 70:30 비율에 근사 (±15% 허용 범위).
3. **Given** 가중치 합계 ≠ 100, **When** A/B 테스트 설정 시도, **Then** 400 + `{ error: "invalid_weight_sum", expected: 100, actual: [합계] }`.
4. **Given** 활성 A/B 테스트, **When** `GET /prompts/1/ab-test/stats`, **Then** 변형별 `{ variant_id, call_count, total_tokens }` 반환.
5. **Given** 활성 A/B 테스트, **When** `DELETE /prompts/1/ab-test`, **Then** A/B 테스트 종료 + 기존 active_version으로 복귀.

---

### User Story 4 — 프롬프트 해결(Resolution) 및 게이트웨이 통합 (Priority: P2)

개발자가 LLM 요청 시 프롬프트 ID를 지정하면, 시스템이 활성 버전(또는 A/B 테스트 변형)을 자동 선택하고 변수를 치환하여 최종 프롬프트를 반환한다. 이 해결된 프롬프트는 F002 GatewayRequest 파이프라인에 주입될 수 있다.

**Why this priority**: 프롬프트 해결은 다른 Feature들과의 통합 지점. 독립적으로도 가치가 있지만 게이트웨이 통합이 완전한 가치.

**Independent Test**: 프롬프트 ID + 변수 → 해결 API → 최종 치환된 프롬프트 텍스트 반환.

**Acceptance Scenarios**:

1. **Given** published 프롬프트(id=1, active_version=v2), **When** `POST /prompts/1/resolve { variables: {...} }`, **Then** v2 content + 변수 치환된 최종 텍스트 반환 + 사용 통계 증가.
2. **Given** A/B 테스트 활성(70:30), **When** `POST /prompts/1/resolve`, **Then** 가중치에 따라 변형 선택 + 선택된 변형의 content 반환 + `X-Prompt-Variant` 응답 헤더.
3. **Given** draft 상태 프롬프트, **When** resolve 시도, **Then** 400 + `{ error: "prompt_not_published" }`.
4. **Given** 존재하지 않는 프롬프트 ID, **When** resolve 시도, **Then** 404.

---

### User Story 5 — 프롬프트 사용 통계 (Priority: P3)

관리자가 프롬프트별 사용 현황(호출 수, 토큰 사용량, 마지막 사용 시간)을 조회하여 프롬프트 라이브러리를 관리한다. 사용되지 않는 프롬프트를 식별하여 archived로 전환할 수 있다.

**Why this priority**: 운영 가시성. 핵심 기능 이후의 부가 기능.

**Independent Test**: 프롬프트 사용 → 통계 조회 → 호출 수/토큰량 확인.

**Acceptance Scenarios**:

1. **Given** 프롬프트(id=1)이 10회 호출됨, **When** `GET /prompts/1/stats`, **Then** `{ call_count: 10, total_tokens: N, last_used_at: "..." }`.
2. **Given** admin, **When** `GET /prompts?sort=call_count&order=desc`, **Then** 호출 수 기준 내림차순 정렬된 프롬프트 목록.

---

### Edge Cases

- **롤백 시 A/B 테스트**: 활성 A/B 테스트가 있는 프롬프트를 롤백하면, A/B 테스트가 자동 종료된다 (변형 참조 무효화 방지).
- **중첩 변수**: `{{{{var}}}}` 같은 중첩 패턴은 외부 `{{` `}}` 쌍만 인식. 내부 `{{`, `}}`는 리터럴 텍스트로 처리.
- **빈 변수 값**: `variables: { name: "" }` → 빈 문자열로 치환 (누락과 다름).
- **동시 수정**: 같은 프롬프트에 동시 PUT → version_number는 DB sequence로 충돌 방지.
- **대용량 프롬프트**: content 최대 100,000자 (약 25,000 토큰). 초과 시 413 Payload Too Large.
- **archived 프롬프트**: archived 상태에서는 resolve 불가 (400). 새 버전 생성은 가능 (재활성화 경로).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 프롬프트 템플릿 CRUD — 생성(`POST /prompts`), 목록 조회(`GET /prompts`, 페이지네이션+정렬), 상세 조회(`GET /prompts/:id`), 삭제(`DELETE /prompts/:id`, cascade)
- **FR-002**: Git 스타일 버전 관리 — 수정 시 새 버전 자동 생성, version_number 자동 증가, 모든 버전 이력 보존
- **FR-003**: 버전 라이프사이클 — `draft` → `published` → `archived` 상태 전이. publish 시 active_version 설정. archived에서 새 버전 생성으로 재활성화 가능
- **FR-004**: 버전 롤백 — 지정 버전으로 active_version 변경. 활성 A/B 테스트 자동 종료
- **FR-005**: 변수 치환 — `{{variable}}` 패턴 인식, 런타임 값 치환. 기본값 지원 (`{{var|default}}`). content 파싱 시 variables 필드 자동 추출
- **FR-006**: 변수 유효성 검증 — 필수 변수(기본값 없는 변수) 누락 시 400 에러 + 누락 변수 목록 반환
- **FR-007**: A/B 테스트 설정 — 변형(variant) 등록 + 트래픽 가중치 할당. 가중치 합계 100% 검증. published 프롬프트에서만 가능
- **FR-008**: A/B 테스트 통계 — 변형별 호출 수, 토큰 사용량 추적
- **FR-009**: A/B 테스트 종료 — 수동 종료 또는 롤백 시 자동 종료
- **FR-010**: 프롬프트 해결(resolve) — 프롬프트 ID + 변수로 최종 치환 텍스트 반환. A/B 활성 시 가중치 기반 변형 선택. draft/archived 거부
- **FR-011**: 테넌트 격리 — 모든 프롬프트는 org_id로 스코핑. 타 org 접근 시 404 반환
- **FR-012**: 프롬프트 사용 통계 — 호출 수, 토큰 사용량, 마지막 사용 시간 추적
- **FR-013**: 프롬프트 크기 제한 — content 최대 100,000자. 초과 시 413 반환
- **FR-014**: RBAC — admin/member는 CRUD 가능, viewer는 조회+resolve만 가능

### Key Entities

- **PromptTemplate**: 프롬프트 템플릿. org_id, name, description, variables (자동 추출된 변수 메타데이터), active_version_id, status (draft/published/archived)
- **PromptVersion**: 버전 이력. template_id, version_number, content, change_note, created_by
- **AbTest**: A/B 테스트 설정. template_id, status (active/completed), created_at, ended_at
- **AbTestVariant**: A/B 변형. ab_test_id, version_id, weight, call_count, total_tokens
- **PromptUsageStat**: 사용 통계. template_id, call_count, total_tokens, last_used_at

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `POST /prompts` → 201 + 프롬프트 + 초기 버전(v1) + status='draft'. 인증 필수, org_id 자동 설정.
- **SC-002**: `PUT /prompts/:id` → 200 + 새 버전 자동 생성 + version_number 증가 + change_note 기록.
- **SC-003**: `POST /prompts/:id/publish { version: N }` → 200 + active_version = vN + status = 'published'.
- **SC-004**: `POST /prompts/:id/rollback { target_version: M }` → 200 + active_version = vM + 활성 A/B 테스트 자동 종료.
- **SC-005**: 변수 치환 — `{{name}}` + `{ name: "AEGIS" }` → 정확한 치환 결과. 기본값 `{{lang|ko}}` 미전달 → 'ko' 적용.
- **SC-006**: 필수 변수 누락 → 400 + `missing_variables` + 누락된 변수 이름 배열.
- **SC-007**: `POST /prompts/:id/ab-test` → A/B 테스트 활성화 + 가중치 합계 100 검증. ≠100 → 400.
- **SC-008**: A/B 활성 상태에서 resolve 100회 → 변형 선택 분포가 설정 비율 ±15% 이내.
- **SC-009**: 타 org 프롬프트 `GET /prompts/:id` → 404 (테넌트 격리).
- **SC-010**: `GET /prompts/:id/stats` → call_count, total_tokens, last_used_at 반환.
- **SC-011**: `POST /prompts/:id/resolve` → 치환된 최종 텍스트 + A/B 변형 시 `X-Prompt-Variant` 헤더.
- **SC-012**: viewer 역할 `POST /prompts` → 403 Forbidden. viewer `POST /prompts/:id/resolve` → 200 (resolve는 허용).
- **SC-013**: content > 100,000자 → 413 Payload Too Large.
- **SC-014**: draft/archived 프롬프트 resolve → 400 + `prompt_not_published`.

## Assumptions

- 프롬프트 content는 plain text 또는 마크다운. 바이너리 첨부 불가.
- A/B 테스트 트래픽 분할은 요청 단위 결정 (stateless). 동일 사용자가 다른 세션에서 다른 변형을 받을 수 있음.
- 프롬프트 사용 통계는 resolve 호출 시 동기적으로 증가. 정밀 분석은 F005(Request Logging)에 위임.
- F002 게이트웨이 통합은 F010 scope 외. F010은 독립 resolve API를 제공하고, 게이트웨이 파이프라인 주입은 향후 통합.
- 변수 파싱은 `{{` `}}` 쌍만 인식. Mustache/Handlebars 전체 구문은 미지원 (helpers, partials, loops 등 불가).
