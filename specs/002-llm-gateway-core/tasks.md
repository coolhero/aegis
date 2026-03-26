# Tasks: F002 — LLM Gateway Core

**Input**: `/specs/002-llm-gateway-core/`의 설계 문서
**Prerequisites**: plan.md (필수), spec.md (사용자 스토리에 필요), research.md, data-model.md, contracts/
**Status**: 모든 작업 완료. F002가 완전히 구현되었다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (파일이 다르고, 의존성 없음)
- **[Story]**: 이 작업이 속하는 사용자 스토리 (예: US1, US2, US3, US4)
- 설명에 정확한 파일 경로를 포함

---

## Phase 1: Setup (의존성 및 공유 타입)

**Purpose**: 프로바이더 SDK 설치, 공유 인터페이스 및 타입 정의

- [x] T001 [P] [US1] `package.json`에 `openai` 및 `@anthropic-ai/sdk` 의존성 추가
- [x] T002 [P] [US1] `chat()` 및 `chatStream()` 메서드를 가진 `ProviderAdapter` 인터페이스 정의 — `libs/common/src/gateway/provider.interface.ts`
- [x] T003 [P] [US1] OpenAI 호환 요청/응답 타입 정의 (`ChatCompletionRequest`, `ChatCompletionResponse`, `ChatCompletionChunk`) — `libs/common/src/gateway/gateway.types.ts`
- [x] T004 [P] [US1] `GatewayRequestContext` 인터페이스 정의 — `libs/common/src/gateway/gateway.types.ts`

---

## Phase 2: Foundational (엔티티 및 시드 데이터)

**Purpose**: 모든 사용자 스토리가 라우팅을 위해 의존하는 Provider 및 Model 엔티티

**CRITICAL**: 엔티티가 마련되기 전까지는 어댑터나 서비스 작업을 시작할 수 없다

- [x] T005 [US4] ProviderType enum을 포함한 Provider 엔티티 생성 — `libs/common/src/gateway/provider.entity.ts`
- [x] T006 [US4] Provider 관계를 포함한 Model 엔티티 생성 — `libs/common/src/gateway/model.entity.ts`
- [x] T007 [US4] 환경 변수 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`를 env 검증에 추가 — `libs/common/src/config/env.validation.ts`
- [x] T008 [US4] 기본 프로바이더(openai, anthropic) 및 모델(gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514, claude-haiku-3-5)에 대한 시드 마이그레이션 생성
- [x] T009 [US1] `libs/common/src/index.ts`에서 모든 gateway 타입 및 엔티티 내보내기

**Checkpoint**: Provider 및 Model 테이블이 시드 데이터와 함께 존재하고, env 검증에 API 키가 포함됨

---

## Phase 3: User Story 1 — OpenAI-Compatible Chat Completion (Priority: P1)

**Goal**: OpenAI 프로바이더를 사용한 비스트리밍 `POST /v1/chat/completions`가 유효한 응답을 반환

**Independent Test**: `curl -s localhost:3000/v1/chat/completions -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'`가 OpenAI Chat Completion JSON을 반환

### Implementation for User Story 1

- [x] T010 [US1] `openai` SDK를 사용한 OpenAI 어댑터 `chat()` 메서드 구현 — `apps/api/src/gateway/providers/openai.adapter.ts`
- [x] T011 [US1] 어댑터 해석 및 요청 처리를 포함한 GatewayService `chat()` 구현 — `apps/api/src/gateway/gateway.service.ts`
- [x] T012 [US1] 비스트리밍 요청을 위한 GatewayController `POST /v1/chat/completions` 구현 — `apps/api/src/gateway/gateway.controller.ts`
- [x] T013 [US1] class-validator를 사용한 요청 검증 DTO (`ChatCompletionDto`) 생성 — `apps/api/src/gateway/dto/chat-completion.dto.ts`

**Checkpoint**: OpenAI로 비스트리밍 chat completion 작동 — US1 핵심 경로 기능 확인

---

## Phase 4: User Story 2 — SSE Streaming Proxy (Priority: P2)

**Goal**: `stream: true`로 토큰 단위 전달이 포함된 SSE 이벤트를 반환

**Independent Test**: `curl -N localhost:3000/v1/chat/completions -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Count to 3"}],"stream":true}'`가 `data: [DONE]`으로 끝나는 점진적 SSE 청크를 표시

### Implementation for User Story 2

- [x] T014 [US2] async generator를 반환하는 OpenAI 어댑터 `chatStream()` 메서드 구현 — `apps/api/src/gateway/providers/openai.adapter.ts`
- [x] T015 [US2] async generator 파이프라인을 포함한 GatewayService `chatStream()` 구현 — `apps/api/src/gateway/gateway.service.ts`
- [x] T016 [US2] GatewayController SSE 스트리밍 응답 구현 (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`) — `apps/api/src/gateway/gateway.controller.ts`
- [x] T017 [US2] 스트림 중간 에러 처리 구현 (SSE 에러 이벤트 + `data: [DONE]`) — `apps/api/src/gateway/gateway.controller.ts`
- [x] T018 [US2] 클라이언트 연결 끊김 감지 구현 (클라이언트 종료 시 프로바이더 요청 중단) — `apps/api/src/gateway/gateway.controller.ts`

**Checkpoint**: OpenAI로 SSE 스트리밍 작동, 스트림 중간 에러 처리 완료 — US2 독립 기능 확인

---

## Phase 5: User Story 3 — Anthropic Provider Support (Priority: P3)

**Goal**: Anthropic 모델이 투명한 형식 변환을 통해 동일한 OpenAI 호환 API로 작동

**Independent Test**: `curl -s localhost:3000/v1/chat/completions -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"system","content":"Be brief"},{"role":"user","content":"Hi"}]}'`가 OpenAI 형식 응답을 반환 (Anthropic 형식이 아님)

### Implementation for User Story 3

- [x] T019 [US3] OpenAI에서 Anthropic으로의 요청 변환 구현 (system 메시지 추출, 역할 매핑, max_tokens 기본값) — `apps/api/src/gateway/providers/anthropic.adapter.ts`
- [x] T020 [US3] 응답을 OpenAI로 변환하는 Anthropic 어댑터 `chat()` 메서드 구현 (content block 추출, stop_reason 매핑, usage 필드 매핑) — `apps/api/src/gateway/providers/anthropic.adapter.ts`
- [x] T021 [US3] 스트리밍 이벤트 변환을 포함한 Anthropic 어댑터 `chatStream()` 구현 (`content_block_delta` -> `chat.completion.chunk`) — `apps/api/src/gateway/providers/anthropic.adapter.ts`
- [x] T022 [US3] Anthropic 고유 엣지 케이스 처리: 복수 system 메시지 연결, 누락된 max_tokens 기본값 — `apps/api/src/gateway/providers/anthropic.adapter.ts`

**Checkpoint**: Anthropic 모델이 스트리밍 및 비스트리밍 모두에서 OpenAI 형식 응답을 반환 — US3 독립 기능 확인

---

## Phase 6: User Story 4 — Provider Routing by Model Name (Priority: P4)

**Goal**: DB에서 모델명 조회를 통해 올바른 어댑터로 요청을 라우팅하고, 알 수 없는 모델은 명확한 에러를 반환

**Independent Test**: `model: "gpt-4o"` -> OpenAI, `model: "claude-sonnet-4-20250514"` -> Anthropic, `model: "unknown"` -> 400 에러로 요청

### Implementation for User Story 4

- [x] T023 [US4] 어댑터 등록 및 모델-어댑터 해석을 포함한 ProviderRegistry 구현 — `apps/api/src/gateway/providers/provider.registry.ts`
- [x] T024 [US4] 데이터베이스에서 모델 조회 구현 (Provider 관계를 포함한 Model 엔티티) — `apps/api/src/gateway/providers/provider.registry.ts`
- [x] T025 [US4] 알 수 없는 모델(400, `model_not_found`) 및 비활성화된 프로바이더에 대한 에러 처리 구현 — `apps/api/src/gateway/providers/provider.registry.ts`
- [x] T026 [US4] 어댑터 해석을 위해 ProviderRegistry를 GatewayService에 연결 — `apps/api/src/gateway/gateway.service.ts`

**Checkpoint**: 모델 라우팅이 올바르게 작동하고 에러 케이스 처리 완료 — US4 독립 기능 확인

---

## Phase 7: 모듈 통합 및 테스트

**Purpose**: NestJS 모듈 시스템에 모든 것을 연결하고, 유닛 테스트 및 최종 통합

- [x] T027 [P] [US1] 모든 프로바이더, 서비스, 컨트롤러를 임포트하는 GatewayModule 생성 — `apps/api/src/gateway/gateway.module.ts`
- [x] T028 [P] [US1] AppModule에 GatewayModule 등록 — `apps/api/src/app.module.ts`
- [x] T029 [P] [US1] TypeOrmModule에 Provider 및 Model 엔티티 등록 — `apps/api/src/gateway/gateway.module.ts`
- [x] T030 [US1] GatewayController 유닛 테스트 (서비스 모킹) — `apps/api/src/gateway/gateway.controller.spec.ts`
- [x] T031 [US3] Anthropic 형식 변환 유닛 테스트 — `apps/api/src/gateway/providers/anthropic.adapter.spec.ts`
- [x] T032 [US4] ProviderRegistry 라우팅 유닛 테스트 — `apps/api/src/gateway/providers/provider.registry.spec.ts`

**Checkpoint**: 모든 모듈 통합 완료, 테스트 통과, `npm run build` 성공

---

## Phase 8: 마무리 및 검증

**Purpose**: 문서화, 데모 스크립트, 최종 빌드 검증

- [x] T033 [P] 모든 F002 내보내기로 `libs/common/src/index.ts` 업데이트
- [x] T034 [P] 데모 스크립트 생성 — `demos/F002-llm-gateway-core.sh`
- [x] T035 [P] `npm run build`가 TypeScript 에러 없이 성공하는지 검증
- [x] T036 quickstart.md 검증 실행 (비스트리밍 + 스트리밍 + 에러 케이스)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: F002 내 의존성 없음 — F001 완료 필요
- **Foundational (Phase 2)**: Phase 1에 의존 — 모든 어댑터/서비스 작업을 차단
- **US1 (Phase 3)**: Phase 2에 의존 — OpenAI 비스트리밍 경로
- **US2 (Phase 4)**: Phase 3 (T010 OpenAI 어댑터)에 의존 — 스트리밍 추가
- **US3 (Phase 5)**: Phase 2에 의존 — Anthropic 어댑터 (어댑터 작업은 US1/US2와 병렬 가능)
- **US4 (Phase 6)**: Phase 2에 의존 — 레지스트리 및 라우팅
- **Integration (Phase 7)**: Phase 3, 4, 5, 6에 의존
- **Polish (Phase 8)**: Phase 7에 의존

### User Story Dependencies

- **User Story 1 (P1)**: 엔티티(Phase 2) + OpenAI 어댑터 필요
- **User Story 2 (P2)**: US1 필요 (비스트리밍 경로가 먼저 작동해야 함)
- **User Story 3 (P3)**: 엔티티(Phase 2) 필요 — 어댑터 구현은 US1/US2와 독립적
- **User Story 4 (P4)**: 엔티티(Phase 2) 필요 — 어댑터 구현과 독립적

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004 — 모두 병렬 (파일이 다름)
- Phase 2: T005, T006 병렬 (다른 엔티티 파일); T007 병렬 (다른 모듈)
- Phase 5 (US3)는 Phase 2 완료 후 Phase 4 (US2)와 병렬 실행 가능
- Phase 6 (US4)는 Phase 2 완료 후 Phase 3-5와 병렬 실행 가능
- Phase 7: T027, T028, T029 병렬 (파일이 다름)
- Phase 8: T033, T034, T035 병렬 (파일이 다름)
