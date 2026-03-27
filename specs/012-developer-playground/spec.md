# Feature Specification: F012 — Developer Playground

**Feature Branch**: `012-developer-playground`
**Created**: 2026-03-28
**Status**: Draft
**Input**: 모델 테스트 UI, 비용 추정, API 탐색기, 프롬프트 편집기

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 모델 테스트 (실시간 스트리밍) (Priority: P1)

개발자가 Playground에서 모델을 선택하고 프롬프트를 입력하면, SSE 스트리밍으로 LLM 응답이 실시간으로 토큰 단위로 렌더링된다. 모델 파라미터(temperature, max_tokens 등)를 조정하여 다양한 설정을 실험할 수 있다.

**Why this priority**: Playground의 핵심 기능. 모델 응답 확인 없이는 다른 기능이 무의미.

**Independent Test**: 모델 선택 → 프롬프트 입력 → Send → 스트리밍 응답 실시간 표시 확인.

**Acceptance Scenarios**:

1. **Given** Playground 페이지 로드, **When** 모델 드롭다운에서 모델 선택 + 프롬프트 입력 + Send 클릭, **Then** SSE 스트리밍 연결 → 토큰 단위 실시간 응답 렌더링 → 완료 시 토큰 사용량 표시.
2. **Given** 스트리밍 진행 중, **When** Stop 버튼 클릭, **Then** SSE 연결 중단 → 현재까지의 부분 응답 유지.
3. **Given** temperature=0.1, max_tokens=100 설정, **When** Send 클릭, **Then** 해당 파라미터로 LLM 호출 → 응답 길이 max_tokens 이내.
4. **Given** LLM 에러 발생 (인증 실패, 모델 비활성 등), **When** 요청 전송, **Then** 에러 메시지 표시 (스트리밍 영역에 인라인).

---

### User Story 2 — 비용 추정 (Priority: P1)

개발자가 프롬프트를 입력하면 요청 전에 예상 토큰 수와 비용을 확인할 수 있다. 실제 요청 후에도 사용된 토큰과 비용이 표시된다.

**Why this priority**: 비용 인식은 엔터프라이즈 환경에서 필수. 예상 비용 없이 요청하면 예산 낭비 위험.

**Independent Test**: 프롬프트 입력 → 예상 토큰/비용 표시 → 요청 후 실제 토큰/비용 확인.

**Acceptance Scenarios**:

1. **Given** 프롬프트 입력, **When** 텍스트 변경 시, **Then** 입력 토큰 수 실시간 카운팅 표시 (tiktoken 추정).
2. **Given** 모델 선택 + 프롬프트 입력, **When** max_tokens 설정, **Then** 예상 비용 = (input_tokens × input_price) + (max_tokens × output_price) 표시.
3. **Given** LLM 응답 완료, **When** 사용량 표시, **Then** 실제 input_tokens, output_tokens, cost_usd 표시.

---

### User Story 3 — 프롬프트 에디터 (Priority: P2)

개발자가 F010에서 생성한 프롬프트 템플릿을 불러와 변수를 입력하고 렌더링된 프롬프트를 미리보기한 후 LLM에 전송할 수 있다.

**Why this priority**: 프롬프트 템플릿 테스트는 프롬프트 엔지니어링의 핵심 작업.

**Independent Test**: 템플릿 선택 → 변수 입력 → 렌더링 프리뷰 → LLM 전송.

**Acceptance Scenarios**:

1. **Given** 프롬프트 에디터 탭, **When** F010 템플릿 목록에서 선택, **Then** 템플릿 내용 표시 + 변수 입력 폼 자동 생성.
2. **Given** 변수 입력 완료, **When** "Preview" 클릭, **Then** 변수 치환된 최종 프롬프트 렌더링 표시.
3. **Given** 렌더링된 프롬프트, **When** "Send" 클릭, **Then** 해당 프롬프트로 LLM 호출 (US1과 동일한 스트리밍 응답).

---

### User Story 4 — 요청/응답 히스토리 (Priority: P2)

Playground 세션 내에서 이전 요청과 응답을 확인할 수 있다. 이전 프롬프트를 재사용하여 반복 실험 가능.

**Why this priority**: 반복 실험의 효율성. 히스토리 없이는 매번 프롬프트를 다시 입력해야 함.

**Independent Test**: 여러 요청 전송 → 히스토리 목록에서 이전 요청 선택 → 프롬프트 자동 채움.

**Acceptance Scenarios**:

1. **Given** LLM 요청 완료, **When** 히스토리 패널 확인, **Then** 요청 목록 표시 (모델, 프롬프트 첫 줄, 타임스탬프, 토큰 수).
2. **Given** 히스토리 항목 클릭, **When** 선택, **Then** 해당 프롬프트/파라미터로 입력 필드 자동 채움.
3. **Given** 세션 내 히스토리, **When** 페이지 새로고침, **Then** 히스토리 초기화 (세션 내 임시 데이터).

---

### User Story 5 — 모델 비교 (Priority: P3)

동일한 프롬프트를 최대 3개 모델에 동시 전송하여 응답을 나란히 비교할 수 있다.

**Why this priority**: 모델 선택 의사결정 지원. 코어 기능은 아니나 Playground 가치를 높이는 기능.

**Independent Test**: 2~3개 모델 선택 → 프롬프트 입력 → Compare → 나란히 응답 표시.

**Acceptance Scenarios**:

1. **Given** Compare 모드 활성화, **When** 2~3개 모델 선택 + 프롬프트 입력 + Compare 클릭, **Then** 각 모델에 동시 요청 → 나란히(side-by-side) 스트리밍 응답 표시.
2. **Given** 비교 완료, **When** 결과 확인, **Then** 각 모델별 토큰 수, 비용, 응답 시간 표시.
3. **Given** 4개 이상 모델 선택 시도, **When** 선택, **Then** "최대 3개까지 선택 가능" 경고 표시.

---

### User Story 6 — API 탐색기 (Priority: P3)

AEGIS API 엔드포인트를 탐색하고, 인터랙티브하게 테스트 호출할 수 있는 Swagger-like UI.

**Why this priority**: 개발자 편의 기능. 별도 API 문서 사이트 불필요.

**Independent Test**: API 탐색기 탭 → 엔드포인트 목록 → 엔드포인트 선택 → 파라미터 입력 → 호출 → 응답 표시.

**Acceptance Scenarios**:

1. **Given** API Explorer 탭, **When** 로드, **Then** AEGIS API 엔드포인트 목록 표시 (카테고리별 그룹핑).
2. **Given** 엔드포인트 선택, **When** 클릭, **Then** HTTP 메서드, 경로, 파라미터, 요청 본문 스키마 표시.
3. **Given** 파라미터 입력 완료, **When** "Try it" 클릭, **Then** 실제 API 호출 → 응답 상태 코드 + 본문 표시.

---

### Edge Cases

- **토큰 카운팅 불일치**: 클라이언트 tiktoken 추정과 서버 실제 토큰 수가 다를 수 있음. UI에 "estimated" 라벨 표시.
- **SSE 연결 끊김**: 네트워크 오류 시 "Connection lost" 메시지 + Retry 버튼.
- **예산 초과**: Playground 요청도 BudgetGuard 적용. 429 응답 시 "Budget exceeded" 메시지 표시.
- **빈 프롬프트**: Send 버튼 비활성화.
- **매우 긴 프롬프트**: 모델별 max context 초과 시 서버 에러 → 에러 메시지 표시.
- **동시 비교 중 하나의 모델 에러**: 에러 모델 패널에 에러 메시지 표시, 다른 모델은 정상 계속.
- **인증 만료**: JWT 만료 시 자동 refresh 시도. 실패 시 로그인 페이지 리다이렉트.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Playground 메인 페이지 — `/playground` 경로에 모델 선택, 프롬프트 입력, 파라미터 패널, 응답 영역 렌더링
- **FR-002**: 모델 드롭다운 — F002 `/v1/chat/completions`에서 사용 가능한 모델 목록 표시 (Provider+Model DB에서 enabled 모델만)
- **FR-003**: 파라미터 패널 — temperature (0-2, step 0.1), max_tokens (1-4096), top_p (0-1) 슬라이더/입력
- **FR-004**: SSE 스트리밍 응답 — POST `/v1/chat/completions` (stream=true) → EventSource 연결 → 토큰 단위 실시간 렌더링
- **FR-005**: Stop 기능 — 스트리밍 중 abort 가능 (EventSource.close + AbortController)
- **FR-006**: 입력 토큰 카운팅 — 프롬프트 입력 시 실시간 토큰 수 추정 표시 (tiktoken 호환 라이브러리)
- **FR-007**: 비용 추정 — 모델 선택 + 프롬프트 입력 시 예상 비용 계산 (input_tokens × input_price + max_tokens × output_price)
- **FR-008**: 실제 사용량 표시 — LLM 응답 완료 후 실제 input_tokens, output_tokens, cost_usd 표시
- **FR-009**: 프롬프트 에디터 — F010 템플릿 목록 로드 (GET /prompts) → 선택 → 변수 폼 자동 생성 → POST /prompts/:id/resolve 호출 → 렌더링 프리뷰
- **FR-010**: 요청 히스토리 — 세션 내 요청/응답 목록 (localStorage 아닌 메모리). 프롬프트 재사용 가능.
- **FR-011**: 모델 비교 — 2~3개 모델 동시 요청 (병렬 fetch). Side-by-side 스트리밍 응답 패널.
- **FR-012**: API 탐색기 — AEGIS API 엔드포인트 정적 목록 + 인터랙티브 호출 UI (Try it). JWT 인증 헤더 자동 포함.
- **FR-013**: 대시보드 사이드바 연동 — F007 대시보드 레이아웃에 "Playground" 메뉴 추가. `/playground` 라우트.
- **FR-014**: 에러 표시 — LLM 에러, 네트워크 에러, 예산 초과(429) 등을 스트리밍 영역에 인라인 표시.
- **FR-015**: JWT 인증 — F003 JWT 토큰으로 API 호출. 만료 시 자동 refresh.

### Key Entities

- 없음 (프론트엔드 전용 — 세션 내 임시 데이터만 사용. 영속 엔티티 없음)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/playground` 페이지 로드 → 모델 드롭다운에 enabled 모델 목록 표시 → 모델 선택 가능.
- **SC-002**: 모델 선택 + 프롬프트 입력 + Send → SSE 스트리밍 응답이 토큰 단위로 실시간 렌더링.
- **SC-003**: 스트리밍 중 Stop 클릭 → SSE 연결 중단 + 부분 응답 유지.
- **SC-004**: 프롬프트 입력 시 입력 토큰 수 실시간 카운팅 표시.
- **SC-005**: 모델+프롬프트 선택 시 예상 비용 표시. 응답 후 실제 비용 표시.
- **SC-006**: F010 템플릿 선택 → 변수 폼 자동 생성 → 변수 입력 → 렌더링 프리뷰 → Send.
- **SC-007**: 여러 요청 후 히스토리 패널에서 이전 프롬프트 선택 → 입력 필드 자동 채움.
- **SC-008**: Compare 모드에서 2~3개 모델 선택 → 동시 스트리밍 → side-by-side 응답 표시 + 각 모델별 비용/토큰 비교.
- **SC-009**: API Explorer에서 엔드포인트 선택 → 파라미터 입력 → "Try it" → 실제 API 호출 → 응답 표시.
- **SC-010**: temperature, max_tokens 파라미터 변경 → 해당 값으로 LLM 호출.
- **SC-011**: LLM 에러(401, 429) 시 스트리밍 영역에 에러 메시지 인라인 표시.
- **SC-012**: 대시보드 사이드바에 "Playground" 메뉴 → 클릭 시 `/playground` 이동.

## Assumptions

- 토큰 카운팅은 클라이언트 사이드에서 tiktoken 호환 라이브러리(gpt-tokenizer 등) 사용. 서버 실제 값과 약간의 차이 허용.
- 모델 가격 정보는 F002 Model 엔티티의 input_price_per_token, output_price_per_token 필드에서 가져옴.
- Playground 요청도 일반 API 요청과 동일하게 BudgetGuard, SecurityGuard, RequestLogger 적용 (예외 없음).
- API 탐색기는 정적 엔드포인트 목록 (OpenAPI spec 자동 생성이 아닌 하드코딩된 API 카탈로그). MVP 범위에서 동적 생성은 제외.
- 세션 히스토리는 메모리 (React state) 기반. localStorage/DB 영속화 없음. 새로고침 시 초기화.
- F007 대시보드와 동일한 Next.js + shadcn/ui + Tailwind CSS 사용.
- 모델 비교는 최대 3개. 동시 SSE 연결 3개.
