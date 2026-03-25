# Tasks: F002 — LLM Gateway Core

**Input**: Design documents from `/specs/002-llm-gateway-core/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Status**: All tasks completed. F002 is fully implemented.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Dependencies & Shared Types)

**Purpose**: Install provider SDKs, define shared interfaces and types

- [x] T001 [P] [US1] Update `package.json` with `openai` and `@anthropic-ai/sdk` dependencies
- [x] T002 [P] [US1] Define `ProviderAdapter` interface with `chat()` and `chatStream()` methods — `libs/common/src/gateway/provider.interface.ts`
- [x] T003 [P] [US1] Define OpenAI-compatible request/response types (`ChatCompletionRequest`, `ChatCompletionResponse`, `ChatCompletionChunk`) — `libs/common/src/gateway/gateway.types.ts`
- [x] T004 [P] [US1] Define `GatewayRequestContext` interface — `libs/common/src/gateway/gateway.types.ts`

---

## Phase 2: Foundational (Entities & Seed Data)

**Purpose**: Provider and Model entities that ALL user stories depend on for routing

**CRITICAL**: No adapter or service work can begin until entities are in place

- [x] T005 [US4] Create Provider entity with ProviderType enum — `libs/common/src/gateway/provider.entity.ts`
- [x] T006 [US4] Create Model entity with Provider relation — `libs/common/src/gateway/model.entity.ts`
- [x] T007 [US4] Add environment variables `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` to env validation — `libs/common/src/config/env.validation.ts`
- [x] T008 [US4] Create seed migration for default providers (openai, anthropic) and models (gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514, claude-haiku-3-5)
- [x] T009 [US1] Export all gateway types and entities from `libs/common/src/index.ts`

**Checkpoint**: Provider and Model tables exist with seed data, env validation includes API keys

---

## Phase 3: User Story 1 — OpenAI-Compatible Chat Completion (Priority: P1)

**Goal**: Non-streaming `POST /v1/chat/completions` with OpenAI provider returns valid response

**Independent Test**: `curl -s localhost:3000/v1/chat/completions -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'` returns OpenAI Chat Completion JSON

### Implementation for User Story 1

- [x] T010 [US1] Implement OpenAI adapter `chat()` method using `openai` SDK — `apps/api/src/gateway/providers/openai.adapter.ts`
- [x] T011 [US1] Implement GatewayService `chat()` with adapter resolution and request processing — `apps/api/src/gateway/gateway.service.ts`
- [x] T012 [US1] Implement GatewayController `POST /v1/chat/completions` for non-streaming requests — `apps/api/src/gateway/gateway.controller.ts`
- [x] T013 [US1] Create request validation DTO (`ChatCompletionDto`) with class-validator — `apps/api/src/gateway/dto/chat-completion.dto.ts`

**Checkpoint**: Non-streaming chat completion works with OpenAI — US1 core path functional

---

## Phase 4: User Story 2 — SSE Streaming Proxy (Priority: P2)

**Goal**: `stream: true` returns SSE events with token-by-token forwarding

**Independent Test**: `curl -N localhost:3000/v1/chat/completions -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Count to 3"}],"stream":true}'` shows incremental SSE chunks ending with `data: [DONE]`

### Implementation for User Story 2

- [x] T014 [US2] Implement OpenAI adapter `chatStream()` method returning async generator — `apps/api/src/gateway/providers/openai.adapter.ts`
- [x] T015 [US2] Implement GatewayService `chatStream()` with async generator pipeline — `apps/api/src/gateway/gateway.service.ts`
- [x] T016 [US2] Implement GatewayController SSE streaming response (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`) — `apps/api/src/gateway/gateway.controller.ts`
- [x] T017 [US2] Implement mid-stream error handling (SSE error event + `data: [DONE]`) — `apps/api/src/gateway/gateway.controller.ts`
- [x] T018 [US2] Implement client disconnect detection (abort provider request on client close) — `apps/api/src/gateway/gateway.controller.ts`

**Checkpoint**: SSE streaming works with OpenAI, errors handled mid-stream — US2 independently functional

---

## Phase 5: User Story 3 — Anthropic Provider Support (Priority: P3)

**Goal**: Anthropic models work through the same OpenAI-compatible API with transparent format conversion

**Independent Test**: `curl -s localhost:3000/v1/chat/completions -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"system","content":"Be brief"},{"role":"user","content":"Hi"}]}'` returns OpenAI-format response (not Anthropic format)

### Implementation for User Story 3

- [x] T019 [US3] Implement OpenAI-to-Anthropic request conversion (system message extraction, role mapping, max_tokens default) — `apps/api/src/gateway/providers/anthropic.adapter.ts`
- [x] T020 [US3] Implement Anthropic adapter `chat()` method with response-to-OpenAI conversion (content block extraction, stop_reason mapping, usage field mapping) — `apps/api/src/gateway/providers/anthropic.adapter.ts`
- [x] T021 [US3] Implement Anthropic adapter `chatStream()` with streaming event conversion (`content_block_delta` -> `chat.completion.chunk`) — `apps/api/src/gateway/providers/anthropic.adapter.ts`
- [x] T022 [US3] Handle Anthropic-specific edge cases: multiple system messages concatenation, missing max_tokens default — `apps/api/src/gateway/providers/anthropic.adapter.ts`

**Checkpoint**: Anthropic models return OpenAI-format responses, both streaming and non-streaming — US3 independently functional

---

## Phase 6: User Story 4 — Provider Routing by Model Name (Priority: P4)

**Goal**: Model name lookup in DB routes requests to the correct adapter, unknown models return clear errors

**Independent Test**: Request with `model: "gpt-4o"` -> OpenAI, `model: "claude-sonnet-4-20250514"` -> Anthropic, `model: "unknown"` -> 400 error

### Implementation for User Story 4

- [x] T023 [US4] Implement ProviderRegistry with adapter registration and model-to-adapter resolution — `apps/api/src/gateway/providers/provider.registry.ts`
- [x] T024 [US4] Implement model lookup from database (Model entity with provider relation) — `apps/api/src/gateway/providers/provider.registry.ts`
- [x] T025 [US4] Implement error handling for unknown models (400, `model_not_found`) and disabled providers — `apps/api/src/gateway/providers/provider.registry.ts`
- [x] T026 [US4] Wire ProviderRegistry into GatewayService for adapter resolution — `apps/api/src/gateway/gateway.service.ts`

**Checkpoint**: Model routing works correctly, error cases handled — US4 independently functional

---

## Phase 7: Module Integration & Tests

**Purpose**: Wire everything into NestJS module system, unit tests, final integration

- [x] T027 [P] [US1] Create GatewayModule importing all providers, services, controllers — `apps/api/src/gateway/gateway.module.ts`
- [x] T028 [P] [US1] Register GatewayModule in AppModule — `apps/api/src/app.module.ts`
- [x] T029 [P] [US1] Register Provider and Model entities in TypeOrmModule — `apps/api/src/gateway/gateway.module.ts`
- [x] T030 [US1] Unit tests for GatewayController (mocked service) — `apps/api/src/gateway/gateway.controller.spec.ts`
- [x] T031 [US3] Unit tests for Anthropic format conversion — `apps/api/src/gateway/providers/anthropic.adapter.spec.ts`
- [x] T032 [US4] Unit tests for ProviderRegistry routing — `apps/api/src/gateway/providers/provider.registry.spec.ts`

**Checkpoint**: All modules integrated, tests pass, `npm run build` succeeds

---

## Phase 8: Polish & Verification

**Purpose**: Documentation, demo script, final build verification

- [x] T033 [P] Update `libs/common/src/index.ts` with all F002 exports
- [x] T034 [P] Create demo script — `demos/F002-llm-gateway-core.sh`
- [x] T035 [P] Verify `npm run build` succeeds without TypeScript errors
- [x] T036 Run quickstart.md validation (non-streaming + streaming + error cases)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies within F002 — requires F001 complete
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all adapter/service work
- **US1 (Phase 3)**: Depends on Phase 2 — OpenAI non-streaming path
- **US2 (Phase 4)**: Depends on Phase 3 (T010 OpenAI adapter) — adds streaming
- **US3 (Phase 5)**: Depends on Phase 2 — Anthropic adapter (parallel with US1/US2 for adapter work)
- **US4 (Phase 6)**: Depends on Phase 2 — registry and routing
- **Integration (Phase 7)**: Depends on Phases 3, 4, 5, 6
- **Polish (Phase 8)**: Depends on Phase 7

### User Story Dependencies

- **User Story 1 (P1)**: Requires entities (Phase 2) + OpenAI adapter
- **User Story 2 (P2)**: Requires US1 (non-streaming path must work first)
- **User Story 3 (P3)**: Requires entities (Phase 2) — independent of US1/US2 for adapter implementation
- **User Story 4 (P4)**: Requires entities (Phase 2) — independent of adapter implementations

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004 — all parallel (different files)
- Phase 2: T005, T006 parallel (different entity files); T007 parallel (different module)
- Phase 5 (US3) can run in parallel with Phase 4 (US2) after Phase 2 is complete
- Phase 6 (US4) can run in parallel with Phases 3-5 after Phase 2 is complete
- Phase 7: T027, T028, T029 parallel (different files)
- Phase 8: T033, T034, T035 parallel (different files)
